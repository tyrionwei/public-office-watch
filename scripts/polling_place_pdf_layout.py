"""Helpers for locating table rows in CEC polling-place PDF text."""

COUNTY_NAMES = {
    "63000": "臺北市",
    "68000": "桃園市",
    "66000": "臺中市",
    "67000": "臺南市",
    "10014": "臺東縣",
    "10018": "新竹市",
    "10010": "嘉義縣",
}


def station_anchor_bounds(word, words, county_code, name_column_start):
    """Return the top and bottom baselines of a possibly wrapped station label."""
    points = [word["y"]]
    county_name = COUNTY_NAMES[county_code]
    for candidate in words:
        if candidate is word or candidate["x"] >= name_column_start:
            continue
        delta = candidate["y"] - word["y"]
        if abs(delta) >= 18:
            continue
        text = candidate["text"]
        is_prefix = (
            delta <= 0
            and text.startswith(county_name)
            and text.endswith("第")
        )
        is_suffix = (
            delta >= 0
            and text == "投開票所"
            and not word["text"].endswith("投開票所")
        )
        if is_prefix or is_suffix:
            points.append(candidate["y"])
    return min(points), max(points)


HEADER_MARKERS = (
    "投開票所編號",
    "投開票所名稱",
    "投開票所地址",
    "所屬村里",
    "所屬里別",
    "所屬鄰別",
    "所編號",
)


def first_row_lower_bound(words, anchor_top):
    """Split the table header from content that may start above the station label."""
    header_lines = [
        word["y"]
        for word in words
        if word["y"] < anchor_top
        and any(marker in word["text"] for marker in HEADER_MARKERS)
    ]
    return ((max(header_lines) + anchor_top) / 2) if header_lines else anchor_top - 12


def page_footer_bounds(words, page_width, page_height):
    """Return the vertical bounds of a split page-number footer."""
    page_numbers = [
        word
        for word in words
        if is_page_number(
            word["text"],
            word["x"],
            word["y"],
            page_width,
            page_height,
        )
    ]
    if not page_numbers:
        return None
    footer_words = [
        word
        for word in words
        if word["y"] > page_height - 30
        and abs(word["x"] - page_width / 2) < page_width * 0.1
        and any(abs(word["y"] - number["y"]) < 2 for number in page_numbers)
    ]
    return min(word["y"] for word in footer_words), max(word["y"] for word in footer_words)


def is_page_footer_word(word, footer_bounds, page_width):
    """Return whether a word belongs to the detected centered footer line."""
    if footer_bounds is None:
        return False
    footer_top, footer_bottom = footer_bounds
    return (
        footer_top <= word["y"] <= footer_bottom
        and abs(word["x"] - page_width / 2) < page_width * 0.1
    )


def last_row_upper_bound(words, page_width, page_height):
    """End the final table row before the complete page-number footer."""
    footer_bounds = page_footer_bounds(words, page_width, page_height)
    return footer_bounds[0] if footer_bounds is not None else page_height


def is_page_number(text, x, y, page_width, page_height):
    """Identify an isolated numeric footer centered below the table."""
    return (
        text.isdigit()
        and y > page_height - 30
        and abs(x - page_width / 2) < page_width * 0.1
    )
