"""Extract ordinary-voter polling assignments from Hualien CEC 2026 PDF.

Usage: python3 extract-hualien-polling-places-pdf.py SOURCE.pdf OUTPUT.json
Requires only Poppler's pdftotext and Python standard library.
"""
import json
import re
import subprocess
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

DISTRICTS = ("花蓮市", "鳳林鎮", "玉里鎮", "新城鄉", "吉安鄉", "壽豐鄉", "光復鄉", "豐濱鄉", "瑞穗鄉", "富里鄉", "秀林鄉", "萬榮鄉", "卓溪鄉")
HEADERS = ["投開票所編號", "投開票所名稱", "投開票所地址", "所屬村里", "所屬鄰別"]


def words_for_page(page):
    return [dict(text=''.join(word.itertext()).strip(), x=float(word.attrib['xMin']),
                 y=float(word.attrib['yMin'])) for word in page.findall('.//{*}word')]


def join_words(words):
    return ''.join(word['text'] for word in sorted(words, key=lambda word: (word['y'], word['x'])))


def district_before_station(headings, anchor_y, current_district):
    """Apply headings before the anchor, even when they fall in an earlier row window."""
    for word in headings:
        if word['y'] < anchor_y:
            current_district = word['text']
    return current_district


def extract_from_xml(xml, expected_count=344):
    if not isinstance(expected_count, int) or expected_count < 1:
        raise ValueError('Expected station count must be a positive integer')
    root = ET.fromstring(xml)
    rows = []
    current_district = None
    for page_no, page in enumerate(root.findall('.//{*}page'), 1):
        words = words_for_page(page)
        if page_no == 1:
            continue  # announcement, table starts on physical page 2
        district_headings = sorted((word for word in words if word['text'] in DISTRICTS and 250 < word['x'] < 310), key=lambda w: w['y'])
        anchors = sorted((word for word in words if re.fullmatch(r'\d{4}', word['text']) and word['x'] < 80), key=lambda w: w['y'])
        if not anchors:
            raise ValueError(f'No station numbers on PDF page {page_no}')
        for i, anchor in enumerate(anchors):
            number = anchor['text']
            previous_y = anchors[i - 1]['y'] if i else None
            next_y = anchors[i + 1]['y'] if i + 1 < len(anchors) else None
            top = (previous_y + anchor['y']) / 2 if previous_y is not None else (115 if page_no == 2 else 0)
            bottom = (next_y + anchor['y']) / 2 if next_y is not None else 800
            current_district = district_before_station(district_headings, anchor['y'], current_district)
            if current_district is None:
                raise ValueError(f'No district heading before station {number}')
            group = [w for w in words if top < w['y'] < bottom and w is not anchor]
            name = join_words(w for w in group if 80 <= w['x'] < 155)
            address = join_words(w for w in group if 155 <= w['x'] < 305 and w['text'] not in DISTRICTS)
            villages = [w for w in group if 305 <= w['x'] < 355]
            neighborhoods = [w for w in group if 355 <= w['x'] < 440]
            if not name or not address.startswith('花蓮縣') or not villages or not neighborhoods:
                raise ValueError(f'Incomplete station {number} on PDF page {page_no}: {name!r} {address!r} {villages!r} {neighborhoods!r}')
            # Multiple villages can share one station; match each village to
            # the closest neighborhood row when the official table has one.
            unique_villages = []
            for word in villages:
                if word['text'] not in [v['text'] for v in unique_villages]:
                    unique_villages.append(word)
            if len(unique_villages) == 1:
                pairs = [(unique_villages[0]['text'], join_words(neighborhoods))]
            else:
                pairs = []
                for village in unique_villages:
                    matching = [w for w in neighborhoods if abs(w['y'] - village['y']) < 8]
                    if not matching:
                        raise ValueError(f'Cannot pair villages at station {number}: {villages!r} {neighborhoods!r}')
                    pairs.append((village['text'], join_words(matching)))
            for village, neighbor in pairs:
                rows.append([f'花蓮縣{current_district}第{number}投開票所', name, address, village, neighbor])
    station_numbers = list(dict.fromkeys(int(re.search(r'第(\d+)投開票所', row[0]).group(1)) for row in rows))
    if station_numbers != list(range(1, expected_count + 1)):
        last = station_numbers[-1] if station_numbers else 'none'
        raise ValueError(f'Incomplete station sequence: {len(station_numbers)} stations, last {last}')
    return [{'name': '花蓮縣', 'rows': [HEADERS, *rows]}]


def extract(pdf):
    html = subprocess.check_output(['pdftotext', '-bbox', str(pdf), '-'])
    return extract_from_xml(html)


if __name__ == '__main__':
    sheets = extract(Path(sys.argv[1]))
    Path(sys.argv[2]).write_text(json.dumps(sheets, ensure_ascii=False, indent=2) + '\n')
    print(f'{len(sheets[0]["rows"])-1} assignment rows')
