#!/usr/bin/env python3
import argparse
import importlib.util
import json
import pathlib
import sys

import numpy as np
from PIL import Image

PLATFORM_MODULE_PATH = pathlib.Path(__file__).with_name('cec-platform-table-crop.py')
PLATFORM_SPEC = importlib.util.spec_from_file_location('cec_platform_table_crop', PLATFORM_MODULE_PATH)
PLATFORM_MODULE = importlib.util.module_from_spec(PLATFORM_SPEC)
PLATFORM_SPEC.loader.exec_module(PLATFORM_MODULE)
colored_mask = PLATFORM_MODULE.colored_mask
line_segments = PLATFORM_MODULE.line_segments
true_runs = PLATFORM_MODULE.true_runs
vertical_lines = PLATFORM_MODULE.vertical_lines


def horizontal_segments(mask, minimum):
    height, width = mask.shape
    raw = []
    for y in range(int(height * 0.01), int(height * 0.96)):
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


def card_top_lines(mask):
    height, width = mask.shape
    segments = [segment for segment in horizontal_segments(mask, int(width * 0.28))
                if width * 0.35 <= segment['xMax'] - segment['xMin'] <= width * 0.65]
    segments.sort(key=lambda item: (item['yMin'], item['xMin']))
    tops = []
    for index, segment in enumerate(segments[:-1]):
        following = next((item for item in segments[index + 1:]
                          if abs(item['xMin'] - segment['xMin']) < width * 0.02
                          and abs(item['xMax'] - segment['xMax']) < width * 0.02), None)
        if not following:
            continue
        gap = following['yMin'] - segment['yMax']
        if height * 0.007 <= gap <= height * 0.014:
            if not any(
                abs(segment['yMin'] - item['yMin']) <= height * 0.12
                and abs(segment['xMin'] - item['xMin']) < width * 0.02
                and abs(segment['xMax'] - item['xMax']) < width * 0.02
                for item in tops
            ):
                tops.append(segment)
    return sorted(tops, key=lambda item: (item['yMin'], item['xMin']))


def covered_horizontal_lines(mask, x_min, x_max, y_min, y_max):
    width = max(1, x_max - x_min + 1)
    coverage = mask[y_min:y_max + 1, x_min:x_max + 1].sum(axis=1) / width
    runs = true_runs(coverage >= 0.72, 1)
    return [int(round((start + end) / 2)) + y_min for start, end in runs]


def locate_cards(image):
    mask = colored_mask(image)
    height, width = mask.shape
    tops = card_top_lines(mask)
    cards = []
    for index, top in enumerate(tops):
        following_top = next((item for item in tops
                              if item['yMin'] > top['yMin']
                              and abs(item['xMin'] - top['xMin']) < width * 0.02
                              and abs(item['xMax'] - top['xMax']) < width * 0.02), None)
        next_top = following_top['yMin'] if following_top else min(height - 1, top['yMin'] + int(height * 0.42))
        vertical_range = [{
            'yMin': top['yMin'],
            'yMax': min(next_top - 1, top['yMin'] + int(height * 0.07)),
            'xMin': top['xMin'],
            'xMax': top['xMax'],
        }]
        columns = vertical_lines(mask, vertical_range, width)
        columns = [column for column in columns if top['xMin'] - 5 <= column <= top['xMax'] + 5]
        if len(columns) != 4:
            continue
        line_scan_bottom = min(height - 1, next_top + 6)
        left_lines = covered_horizontal_lines(mask, columns[0], columns[1], top['yMin'], line_scan_bottom)
        right_lines = covered_horizontal_lines(mask, columns[1], columns[3], top['yMin'], line_scan_bottom)
        if len(left_lines) < 5 or len(right_lines) < 5:
            continue
        table_top, header_bottom = left_lines[:2]
        profile_top, party_top = left_lines[2:4]
        education_bottom, platform_header_bottom = right_lines[2:4]
        if not (table_top < header_bottom < education_bottom < platform_header_bottom < next_top
                and header_bottom < profile_top < party_top < next_top):
            continue
        pad = 5
        cards.append({
            'index': len(cards),
            'tableTop': table_top,
            'nextCardTop': next_top,
            'columns': columns,
            'leftLines': left_lines,
            'rightLines': right_lines,
            'boxes': {
                'heading': {
                    'xMin': columns[0], 'xMax': columns[3],
                    'yMin': max(0, table_top - int(height * 0.055)), 'yMax': table_top - pad,
                },
                'identity': {
                    'xMin': columns[0] + pad, 'xMax': columns[1] - pad,
                    'yMin': header_bottom + pad, 'yMax': profile_top - pad,
                },
                'number': {
                    'xMin': columns[0] + pad, 'xMax': columns[1] - pad,
                    'yMin': header_bottom + pad,
                    'yMax': min(profile_top - pad, header_bottom + int(height * 0.03)),
                },
                'education': {
                    'xMin': columns[1] + pad, 'xMax': columns[2] - pad,
                    'yMin': header_bottom + pad, 'yMax': education_bottom - pad,
                },
                'experience': {
                    'xMin': columns[2] + pad, 'xMax': columns[3] - pad,
                    'yMin': header_bottom + pad, 'yMax': education_bottom - pad,
                },
                'personal': {
                    'xMin': columns[0] + pad, 'xMax': columns[1] - pad,
                    'yMin': profile_top + pad, 'yMax': party_top - pad,
                },
            },
        })
    return {
        'status': 'located' if cards else 'cards_not_found',
        'imageSize': {'width': width, 'height': height},
        'cards': cards,
        'candidateTopCount': len(tops),
    }


def main(argv=None):
    parser = argparse.ArgumentParser()
    parser.add_argument('image')
    args = parser.parse_args(argv)
    with Image.open(args.image) as image:
        result = locate_cards(image)
    print(json.dumps(result, ensure_ascii=False))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(json.dumps({'status': 'failed', 'error': str(error)}, ensure_ascii=False))
        sys.exit(1)
