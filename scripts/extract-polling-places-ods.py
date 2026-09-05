"""Read official ODS rows into JSON without editing the source workbook."""
import argparse
import json
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

parser = argparse.ArgumentParser()
parser.add_argument('input')
parser.add_argument('output')
args = parser.parse_args()
ns = {'t': 'urn:oasis:names:tc:opendocument:xmlns:table:1.0',
      'x': 'urn:oasis:names:tc:opendocument:xmlns:text:1.0'}
with zipfile.ZipFile(args.input) as archive:
    root = ET.fromstring(archive.read('content.xml'))
sheets = []
for table in root.findall('.//t:table', ns):
    rows = []
    for row in table.findall('t:table-row', ns):
        cells = []
        for cell in row:
            value = '\n'.join(''.join(p.itertext()) for p in cell.findall('x:p', ns))
            repeat = int(cell.get('{' + ns['t'] + '}number-columns-repeated', '1'))
            cells.extend([value] * min(repeat, 256))
        while cells and not cells[-1]:
            cells.pop()
        if any(cells):
            repeat = int(row.get('{' + ns['t'] + '}number-rows-repeated', '1'))
            if repeat > 10000:
                raise ValueError('Unexpected populated row repetition')
            rows.extend([cells] * repeat)
    sheets.append({'name': table.get('{' + ns['t'] + '}name'), 'rows': rows})
Path(args.output).write_text(json.dumps(sheets, ensure_ascii=False), encoding='utf-8')
