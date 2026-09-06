"""Extract reviewed column layouts from text-based 2026 CEC polling-place PDFs."""

import argparse
import json
import re
import subprocess
import tempfile
from pathlib import Path
from xml.etree import ElementTree as ET

from polling_place_pdf_layout import (
    first_row_lower_bound,
    is_page_footer_word,
    last_row_upper_bound,
    page_footer_bounds,
    station_anchor_bounds,
    validate_station_sequence,
)

CONFIGS = {
    "63000": {
        "anchor": re.compile(r"^臺北市.+第(\d{4})$"),
        "columns": {"name": (115, 195), "address": (195, 350), "village": (350, 400), "neighborhood": (400, 450)},
    },
    "68000": {
        "anchor": re.compile(r"^(\d{4})$"),
        "columns": {"district": (0, 75), "name": (110, 220), "address": (220, 340), "village": (340, 395), "neighborhood": (395, 460)},
    },
    "66000": {
        "anchor": re.compile(r"^(?:(?:臺中市.+第)(\d{4})|(\d{4})投開票所)$"),
        "columns": {"name": (110, 225), "address": (225, 365), "village": (365, 415), "neighborhood": (415, 510)},
    },
    "67000": {
        "anchor": re.compile(r"^臺南市.+第(\d{4})投開票所$"),
        "columns": {"name": (190, 330), "address": (330, 630), "village": (630, 730), "neighborhood": (730, 842)},
    },
    "10014": {
        "anchor": re.compile(r"^臺東縣.+第(\d{4})投開票所$"),
        "columns": {"name": (185, 300), "address": (300, 525), "village": (525, 625), "neighborhood": (625, 730)},
    },
    "10018": {
        "anchor": re.compile(r"^(\d{4})投開票所$"),
        "columns": {"name": (120, 240), "address": (240, 410), "village": (410, 480), "neighborhood": (480, 560)},
    },
    "10010": {
        "anchor": re.compile(r"^(?:(?:嘉義縣.+第)(\d{4})|(\d{4})投開票所|第(\d{4})投開票所)$"),
        "columns": {"name": (105, 230), "address": (230, 390), "village": (390, 460), "neighborhood": (460, 535)},
    },
}


def valid_neighborhood_text(value):
    normalized = value.replace("鄰", "").replace(" ", "").replace("、", ",").replace("，", ",")
    normalized = re.sub(r"[–—－~～至]", "-", normalized)
    if normalized in ("全里", "全村", "未分鄰"):
        return True
    if not re.fullmatch(r"\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*", normalized):
        return False
    seen = set()
    for part in normalized.split(","):
        bounds = [int(number) for number in part.split("-")]
        start, end = bounds[0], bounds[-1]
        if start < 1 or end > 999 or end < start:
            return False
        for number in range(start, end + 1):
            if number in seen:
                return False
            seen.add(number)
    return True


def join_neighborhood_lines(lines):
    candidates = [("", 0)]
    for _, line in lines:
        next_candidates = []
        for value, inserted in candidates:
            if not value or value.endswith(("-", "－", "、", ",")) or line.startswith(("、", ",")):
                next_candidates.append((value + line, inserted))
            else:
                next_candidates.append((value + line, inserted))
                next_candidates.append((value + "," + line, inserted + 1))
        candidates = next_candidates
    valid = sorted((item for item in candidates if valid_neighborhood_text(item[0])), key=lambda item: item[1])
    return valid[0][0] if valid else "需覆核:" + "".join(line for _, line in lines)

parser = argparse.ArgumentParser()
parser.add_argument("input")
parser.add_argument("output")
parser.add_argument("--county-code", required=True)
parser.add_argument("--expected-station-count", required=True, type=int)
parser.add_argument("--expected-last-station-no", required=True)
args = parser.parse_args()
config = CONFIGS.get(args.county_code)
if not config:
    raise SystemExit("No reviewed PDF column layout for " + args.county_code)

with tempfile.NamedTemporaryFile(suffix=".html") as bbox:
    subprocess.run(["pdftotext", "-bbox-layout", args.input, bbox.name], check=True)
    xml = Path(bbox.name).read_bytes().decode("utf-8", errors="replace")
    xml = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", xml)
    root = ET.fromstring(xml)

namespace = {"x": "http://www.w3.org/1999/xhtml"}
rows = [["投開票所編號", "投開票所名稱", "投開票所地址", "一般選舉人所屬村里", "一般選舉人所屬鄰別"]]
station_numbers = []

for page in root.findall(".//x:page", namespace):
    words = []
    page_width = float(page.get("width"))
    page_height = float(page.get("height"))
    for word in page.findall(".//x:word", namespace):
        text = "".join(word.itertext()).strip()
        if not text:
            continue
        x = (float(word.get("xMin")) + float(word.get("xMax"))) / 2
        y = (float(word.get("yMin")) + float(word.get("yMax"))) / 2
        words.append({"text": text, "x": x, "y": y})

    footer_bounds = page_footer_bounds(words, page_width, page_height)
    page_content_bottom = last_row_upper_bound(words, page_width, page_height)
    words = [
        word for word in words
        if not is_page_footer_word(word, footer_bounds, page_width)
    ]

    anchors = []
    for word in words:
        match = config["anchor"].match(word["text"])
        if not match:
            continue
        if args.county_code == "68000" and not 75 <= word["x"] < 110:
            continue
        number = int(next(group for group in match.groups() if group is not None))
        anchor_top, anchor_bottom = station_anchor_bounds(
            word,
            words,
            args.county_code,
            config["columns"]["name"][0],
        )
        anchors.append({
            "number": number,
            "label": word["text"],
            "top": anchor_top,
            "bottom": anchor_bottom,
        })
    anchors.sort(key=lambda anchor: anchor["top"])
    station_numbers.extend(anchor["number"] for anchor in anchors)
    for index, anchor in enumerate(anchors):
        lower = (
            (anchors[index - 1]["bottom"] + anchor["top"]) / 2
            if index else first_row_lower_bound(words, anchor["top"])
        )
        upper = (
            (anchor["bottom"] + anchors[index + 1]["top"]) / 2
            if index + 1 < len(anchors) else page_content_bottom
        )
        row_words = [word for word in words if lower <= word["y"] < upper]

        def collect(column):
            start, end = config["columns"][column]
            selected = [word for word in row_words if start <= word["x"] < end]
            selected.sort(key=lambda word: (round(word["y"], 1), word["x"]))
            lines = []
            for word in selected:
                line_y = round(word["y"], 1)
                if lines and abs(lines[-1][0] - line_y) < 1:
                    lines[-1][1] += word["text"]
                else:
                    lines.append([line_y, word["text"]])
            if column != "neighborhood":
                return "".join(line[1] for line in lines)
            return join_neighborhood_lines(lines)

        number_text = str(anchor["number"]).zfill(4)
        if args.county_code == "63000":
            station_label = anchor["label"] if anchor["label"].endswith("投開票所") else anchor["label"] + "投開票所"
        elif args.county_code == "68000":
            district = collect("district")
            station_label = "桃園市" + district + "第" + number_text + "投開票所"
        elif args.county_code == "66000" and anchor["label"].startswith("臺中市"):
            station_label = anchor["label"] if anchor["label"].endswith("投開票所") else anchor["label"] + "投開票所"
        elif args.county_code == "10010" and anchor["label"].startswith("嘉義縣"):
            station_label = anchor["label"] if anchor["label"].endswith("投開票所") else anchor["label"] + "投開票所"
        elif args.county_code == "10010" and anchor["label"].startswith("第"):
            prefixes = [
                word["text"] for word in row_words
                if word["text"].startswith("嘉義縣") and word["x"] < 105
            ]
            station_label = (prefixes[0] if prefixes else "") + anchor["label"]
        elif args.county_code in ("66000", "10018", "10010"):
            county_name = {"66000": "臺中市", "10018": "新竹市", "10010": "嘉義縣"}[args.county_code]
            prefixes = [
                word["text"] for word in row_words
                if word["text"].startswith(county_name) and word["text"].endswith("第") and word["x"] < 120
            ]
            station_label = (prefixes[0] if prefixes else "") + number_text + "投開票所"
        else:
            station_label = anchor["label"] if anchor["label"].endswith("投開票所") else anchor["label"] + "投開票所"

        rows.append([
            station_label,
            collect("name"),
            collect("address"),
            collect("village"),
            collect("neighborhood"),
        ])

try:
    validate_station_sequence(
        station_numbers,
        args.expected_station_count,
        args.expected_last_station_no,
    )
except ValueError as error:
    raise SystemExit(str(error)) from error
Path(args.output).write_text(json.dumps([{"name": "pdf", "rows": rows}], ensure_ascii=False), encoding="utf-8")
print(len(station_numbers))
