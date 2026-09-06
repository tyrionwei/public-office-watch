"""Read official ODS rows into JSON without editing the source workbook."""

import argparse
import json
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

parser = argparse.ArgumentParser()
parser.add_argument("input")
parser.add_argument("output")
args = parser.parse_args()
ns = {
    "t": "urn:oasis:names:tc:opendocument:xmlns:table:1.0",
    "x": "urn:oasis:names:tc:opendocument:xmlns:text:1.0",
}
table_namespace = "{" + ns["t"] + "}"

with zipfile.ZipFile(args.input) as archive:
    root = ET.fromstring(archive.read("content.xml"))

sheets = []
for table in root.findall(".//t:table", ns):
    rows = []
    vertical_spans = {}
    for row in table.findall("t:table-row", ns):
        cells = []
        new_spans = {}
        column = 0
        for cell in row:
            tag = cell.tag.removeprefix(table_namespace)
            if tag == "covered-table-cell":
                value = vertical_spans.get(column, ("", 0))[0]
            else:
                value = "\n".join("".join(paragraph.itertext()) for paragraph in cell.findall("x:p", ns))
            repeat = int(cell.get(table_namespace + "number-columns-repeated", "1"))
            row_span = int(cell.get(table_namespace + "number-rows-spanned", "1"))
            for _ in range(min(repeat, 256)):
                cells.append(value)
                if row_span > 1:
                    new_spans[column] = (value, row_span - 1)
                column += 1

        while cells and not cells[-1]:
            cells.pop()
        if any(cells):
            repeat = int(row.get(table_namespace + "number-rows-repeated", "1"))
            if repeat > 10000:
                raise ValueError("Unexpected populated row repetition")
            rows.extend([cells] * repeat)

        vertical_spans = {
            column: (value, remaining - 1)
            for column, (value, remaining) in vertical_spans.items()
            if remaining > 1
        }
        vertical_spans.update(new_spans)

    sheets.append({"name": table.get(table_namespace + "name"), "rows": rows})

Path(args.output).write_text(json.dumps(sheets, ensure_ascii=False), encoding="utf-8")
