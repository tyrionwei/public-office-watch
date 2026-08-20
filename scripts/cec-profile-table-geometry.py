#!/usr/bin/env python3
import argparse
import importlib.util
import json
import pathlib
import statistics
import sys

from PIL import Image

PLATFORM_MODULE_PATH = pathlib.Path(__file__).with_name('cec-platform-table-crop.py')
PLATFORM_SPEC = importlib.util.spec_from_file_location('cec_platform_table_crop', PLATFORM_MODULE_PATH)
PLATFORM_MODULE = importlib.util.module_from_spec(PLATFORM_SPEC)
PLATFORM_SPEC.loader.exec_module(PLATFORM_MODULE)
colored_mask = PLATFORM_MODULE.colored_mask
line_segments = PLATFORM_MODULE.line_segments
choose_table = PLATFORM_MODULE.choose_table
vertical_lines = PLATFORM_MODULE.vertical_lines


PROFILE_COLUMN_COUNTS = (10, 11)


def overlap(left, right):
    shared = max(0, min(left['xMax'], right['xMax']) - max(left['xMin'], right['xMin']))
    return shared / max(1, max(left['xMax'] - left['xMin'], right['xMax'] - right['xMin']))


def interpolate_one_missing_boundary(boundaries, required, height):
    if len(boundaries) != required - 1 or len(boundaries) < 4:
        return None
    gaps = [boundaries[index + 1]['yMin'] - boundaries[index]['yMax']
            for index in range(len(boundaries) - 1)]
    largest_index = max(range(len(gaps)), key=gaps.__getitem__)
    ordinary = [gap for index, gap in enumerate(gaps) if index != largest_index]
    typical = statistics.median(ordinary)
    if typical < height * 0.03 or not typical * 1.7 <= gaps[largest_index] <= typical * 2.3:
        return None
    previous = boundaries[largest_index]
    following = boundaries[largest_index + 1]
    y = round((previous['yMax'] + following['yMin']) / 2)
    synthetic = {
        'yMin': y,
        'yMax': y,
        'xMin': max(previous['xMin'], following['xMin']),
        'xMax': min(previous['xMax'], following['xMax']),
        'interpolated': True,
    }
    return boundaries[:largest_index + 1] + [synthetic] + boundaries[largest_index + 1:]


def choose_exact_profile_table(segments, candidate_count, width, height, mask):
    required = candidate_count + 1
    choices = []
    for top in segments:
        compatible = [segment for segment in segments
                      if segment['yMin'] >= top['yMin'] and overlap(top, segment) > 0.88]
        compatible.sort(key=lambda item: item['yMin'])
        boundaries = compatible[:required] if len(compatible) >= required else interpolate_one_missing_boundary(compatible, required, height)
        if not boundaries:
            continue
        gaps = [boundaries[index + 1]['yMin'] - boundaries[index]['yMax']
                for index in range(len(boundaries) - 1)]
        if not gaps or any(gap < height * 0.03 for gap in gaps) or max(gaps) / min(gaps) > 3:
            continue
        typical_gap = statistics.median(gaps)
        previous = [segment for segment in segments
                    if segment['yMin'] < top['yMin'] and overlap(top, segment) > 0.88]
        if previous:
            previous_gap = top['yMin'] - max(previous, key=lambda item: item['yMin'])['yMax']
            if typical_gap * 0.5 <= previous_gap <= typical_gap * 3:
                continue
        if len(compatible) > required:
            next_gap = compatible[required]['yMin'] - boundaries[-1]['yMax']
            if typical_gap * 0.5 <= next_gap <= typical_gap * 3:
                continue
        choices.append((top['yMin'] + (top['xMin'] * 0.2), boundaries))
    for _, boundaries in sorted(choices, key=lambda item: item[0]):
        if len(vertical_lines(mask, boundaries, width)) >= 4:
            return boundaries
    return None


def locate_profile_table(image, candidate_number, candidate_count, after_y=None, before_y=None):
    if candidate_number < 1 or candidate_number > candidate_count:
        return {'status': 'invalid_candidate_number'}
    mask = colored_mask(image)
    height, width = mask.shape
    segments = line_segments(mask, 0.995)
    if after_y is not None:
        segments = [segment for segment in segments if segment['yMin'] > after_y]
    if before_y is not None:
        segments = [segment for segment in segments if segment['yMax'] < before_y]
    table = choose_exact_profile_table(segments, candidate_count, width, height, mask)
    if not table:
        return {'status': 'table_not_found', 'horizontalSegmentCount': len(segments)}
    columns = vertical_lines(mask, table, width)
    interval_count = len(columns) - 1
    profile_column_count = next((count for count in PROFILE_COLUMN_COUNTS if interval_count % count == 0), None)
    if profile_column_count is None:
        return {
            'status': 'profile_columns_not_found',
            'table': table,
            'verticalLines': columns,
        }
    row_top = table[candidate_number - 1]['yMax'] + 4
    row_bottom = table[candidate_number]['yMin'] - 4
    if row_bottom <= row_top:
        return {'status': 'invalid_row_geometry', 'table': table, 'verticalLines': columns}
    panels = []
    for index in range(interval_count // profile_column_count):
        panel_columns = columns[index * profile_column_count:(index + 1) * profile_column_count + 1]
        panels.append({
            'index': index,
            'xMin': panel_columns[0],
            'xMax': panel_columns[-1],
            'columns': panel_columns,
        })
    return {
        'status': 'located',
        'imageSize': {'width': width, 'height': height},
        'table': table,
        'verticalLines': columns,
        'profileColumnCount': profile_column_count,
        'rowTop': row_top,
        'rowBottom': row_bottom,
        'panels': panels,
    }


def locate_profile_row(image, row_top_y, row_bottom_y):
    if row_bottom_y <= row_top_y:
        return {'status': 'invalid_manual_row'}
    mask = colored_mask(image)
    height, width = mask.shape
    segments = line_segments(mask, 0.995)
    tolerance = height * 0.02

    def nearest(expected):
        candidates = sorted(
            segments,
            key=lambda segment: abs(((segment['yMin'] + segment['yMax']) / 2) - expected),
        )
        if not candidates:
            return None
        candidate = candidates[0]
        center = (candidate['yMin'] + candidate['yMax']) / 2
        return candidate if abs(center - expected) <= tolerance else None

    top = nearest(row_top_y)
    bottom = nearest(row_bottom_y)
    if not top or not bottom or bottom['yMin'] <= top['yMax']:
        return {'status': 'manual_row_boundaries_not_found'}
    table = [top, bottom]
    columns = vertical_lines(mask, table, width)
    interval_count = len(columns) - 1
    profile_column_count = next((count for count in PROFILE_COLUMN_COUNTS if interval_count % count == 0), None)
    if profile_column_count is None:
        return {'status': 'profile_columns_not_found', 'table': table, 'verticalLines': columns}
    panels = []
    for index in range(interval_count // profile_column_count):
        panel_columns = columns[index * profile_column_count:(index + 1) * profile_column_count + 1]
        panels.append({
            'index': index,
            'xMin': panel_columns[0],
            'xMax': panel_columns[-1],
            'columns': panel_columns,
        })
    return {
        'status': 'located',
        'imageSize': {'width': width, 'height': height},
        'table': table,
        'verticalLines': columns,
        'profileColumnCount': profile_column_count,
        'rowTop': top['yMax'] + 4,
        'rowBottom': bottom['yMin'] - 4,
        'panels': panels,
    }


def main(argv=None):
    parser = argparse.ArgumentParser()
    parser.add_argument('image')
    parser.add_argument('--candidate-number', type=int, required=True)
    parser.add_argument('--candidate-count', type=int, required=True)
    parser.add_argument('--after-y', type=float)
    parser.add_argument('--before-y', type=float)
    parser.add_argument('--row-top-y', type=float)
    parser.add_argument('--row-bottom-y', type=float)
    args = parser.parse_args(argv)
    with Image.open(args.image) as image:
        if args.row_top_y is not None or args.row_bottom_y is not None:
            if args.row_top_y is None or args.row_bottom_y is None:
                result = {'status': 'manual_row_requires_both_boundaries'}
            else:
                result = locate_profile_row(image, args.row_top_y, args.row_bottom_y)
        else:
            result = locate_profile_table(
                image,
                args.candidate_number,
                args.candidate_count,
                after_y=args.after_y,
                before_y=args.before_y,
            )
    print(json.dumps(result, ensure_ascii=False))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(json.dumps({'status': 'failed', 'error': str(error)}, ensure_ascii=False))
        sys.exit(1)
