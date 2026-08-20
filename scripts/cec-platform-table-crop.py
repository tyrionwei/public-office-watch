#!/usr/bin/env python3
import argparse
import json
import sys

import numpy as np
from PIL import Image


def true_runs(values, minimum):
    padded = np.pad(values.astype(np.int8), (1, 1))
    changes = np.diff(padded)
    starts = np.flatnonzero(changes == 1)
    ends = np.flatnonzero(changes == -1)
    return [(int(start), int(end - 1)) for start, end in zip(starts, ends) if end - start >= minimum]


def colored_mask(image):
    pixels = np.asarray(image.convert('RGB'), dtype=np.int16)
    maximum = pixels.max(axis=2)
    minimum = pixels.min(axis=2)
    return ((maximum > 115) & ((maximum - minimum) > 45)) | (maximum < 105)


def line_segments(mask, scan_bottom_ratio=0.92):
    height, width = mask.shape
    minimum = max(80, int(width * 0.18))
    raw = []
    for y in range(int(height * 0.08), min(height, int(height * scan_bottom_ratio))):
        for x_min, x_max in true_runs(mask[y], minimum):
            raw.append({'yMin': y, 'yMax': y, 'xMin': x_min, 'xMax': x_max})

    groups = []
    for segment in raw:
        match = next((group for group in reversed(groups[-12:])
                      if segment['yMin'] <= group['yMax'] + 2
                      and abs(segment['xMin'] - group['xMin']) < width * 0.025
                      and abs(segment['xMax'] - group['xMax']) < width * 0.025), None)
        if match:
            match['yMax'] = segment['yMax']
            match['xMin'] = min(match['xMin'], segment['xMin'])
            match['xMax'] = max(match['xMax'], segment['xMax'])
        else:
            groups.append(segment.copy())
    return groups


def overlap(left, right):
    shared = max(0, min(left['xMax'], right['xMax']) - max(left['xMin'], right['xMin']))
    return shared / max(1, min(left['xMax'] - left['xMin'], right['xMax'] - right['xMin']))


def choose_table(segments, candidate_count, width, height, mask):
    required = candidate_count + 1
    choices = []
    for top in segments:
        compatible = [segment for segment in segments
                      if segment['yMin'] >= top['yMin'] and overlap(top, segment) > 0.88]
        compatible.sort(key=lambda item: item['yMin'])
        if len(compatible) < required:
            continue
        boundaries = compatible[:required]
        gaps = [boundaries[index + 1]['yMin'] - boundaries[index]['yMax']
                for index in range(len(boundaries) - 1)]
        if not gaps or any(gap < height * 0.03 for gap in gaps) or max(gaps) / min(gaps) > 3:
            continue
        choices.append((top['yMin'] + (top['xMin'] * 0.2), boundaries))
    for _, boundaries in sorted(choices, key=lambda item: item[0]):
        if len(vertical_lines(mask, boundaries, width)) >= 4:
            return boundaries
    return None


def vertical_lines(mask, table, width):
    y_min = table[0]['yMin']
    y_max = table[-1]['yMax']
    x_min = max(0, min(item['xMin'] for item in table) - 4)
    x_max = min(width - 1, max(item['xMax'] for item in table) + 4)
    column_counts = mask[y_min:y_max + 1, x_min:x_max + 1].sum(axis=0)
    threshold = (y_max - y_min + 1) * 0.72
    indexes = np.flatnonzero(column_counts >= threshold)
    if len(indexes) == 0:
        return []
    runs = true_runs(np.isin(np.arange(x_max - x_min + 1), indexes), 1)
    return [int(round((start + end) / 2)) + x_min for start, end in runs]


def locate_crop(image, candidate_number, candidate_count):
    if candidate_number < 1 or candidate_number > candidate_count:
        return {'status': 'invalid_candidate_number'}
    mask = colored_mask(image)
    height, width = mask.shape
    segments = line_segments(mask)
    table = choose_table(segments, candidate_count, width, height, mask)
    if not table:
        return {'status': 'table_not_found', 'horizontalSegmentCount': len(segments)}
    columns = vertical_lines(mask, table, width)
    if len(columns) < 4:
        return {'status': 'platform_columns_not_found', 'table': table, 'verticalLines': columns}
    row_top = table[candidate_number - 1]['yMax'] + 4
    row_bottom = table[candidate_number]['yMin'] - 4
    platform_left = columns[-2] + 4
    platform_right = columns[-1] - 4
    if row_bottom <= row_top or platform_right <= platform_left:
        return {'status': 'invalid_crop_geometry', 'table': table, 'verticalLines': columns}
    return {
        'status': 'located',
        'imageSize': {'width': width, 'height': height},
        'table': table,
        'verticalLines': columns,
        'crop': {
            'xMin': platform_left,
            'yMin': row_top,
            'xMax': platform_right,
            'yMax': row_bottom,
        },
    }


def main(argv=None):
    parser = argparse.ArgumentParser()
    parser.add_argument('image')
    parser.add_argument('--candidate-number', type=int, required=True)
    parser.add_argument('--candidate-count', type=int, required=True)
    args = parser.parse_args(argv)
    image = Image.open(args.image)
    print(json.dumps(locate_crop(image, args.candidate_number, args.candidate_count), ensure_ascii=False))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(json.dumps({'status': 'failed', 'error': str(error)}, ensure_ascii=False))
        sys.exit(1)
