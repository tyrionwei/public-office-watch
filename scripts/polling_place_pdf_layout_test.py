import unittest

from polling_place_pdf_layout import (
    first_row_lower_bound,
    is_page_footer_word,
    is_page_number,
    last_row_upper_bound,
    page_footer_bounds,
    station_anchor_bounds,
    validate_station_sequence,
)


class StationAnchorBoundsTests(unittest.TestCase):
    def test_uses_wrapped_label_edges_to_split_adjacent_rows(self):
        previous = {"text": "臺中市南區第1499", "x": 79.0, "y": 145.54}
        previous_suffix = {"text": "投開票所", "x": 79.0, "y": 155.62}
        anchor = {"text": "臺中市南區第1500", "x": 79.0, "y": 165.10}
        suffix = {"text": "投開票所", "x": 79.0, "y": 175.18}
        following = {"text": "臺中市南區第1501", "x": 79.0, "y": 184.66}
        following_suffix = {"text": "投開票所", "x": 79.0, "y": 194.74}
        words = [previous, previous_suffix, anchor, suffix, following, following_suffix]
        previous_bounds = station_anchor_bounds(previous, words, "66000", 110)
        bounds = station_anchor_bounds(anchor, words, "66000", 110)
        following_bounds = station_anchor_bounds(following, words, "66000", 110)
        lower = (previous_bounds[1] + bounds[0]) / 2
        upper = (bounds[1] + following_bounds[0]) / 2
        self.assertLess(lower, 165.10)
        self.assertLess(175.18, upper)
        self.assertLess(upper, 184.66)

    def test_associates_a_prefix_on_the_previous_text_line(self):
        anchor = {"text": "0200投開票所", "x": 79.0, "y": 295.26}
        prefix = {"text": "新竹市北區第", "x": 79.0, "y": 281.79}
        self.assertEqual(
            station_anchor_bounds(anchor, [prefix, anchor], "10018", 120),
            (281.79, 295.26),
        )

    def test_keeps_single_line_label_edges_unchanged(self):
        anchor = {"text": "0001投開票所", "x": 80.0, "y": 100.0}
        self.assertEqual(
            station_anchor_bounds(anchor, [anchor], "10018", 120),
            (100.0, 100.0),
        )

    def test_splits_first_row_after_the_last_header_line(self):
        words = [
            {"text": "所屬鄰別", "x": 420.0, "y": 89.07},
            {"text": "桃園區大樹里３鄰延平路", "x": 280.0, "y": 106.35},
        ]
        lower = first_row_lower_bound(words, 113.91)
        self.assertLess(106.35, lower + 10)
        self.assertLess(lower, 106.35)
        self.assertGreater(lower, 89.07)

    def test_excludes_isolated_numeric_page_footer(self):
        self.assertTrue(is_page_number("2", 295.0, 818.33, 595.0, 841.89))
        self.assertFalse(is_page_number("19", 430.0, 818.33, 595.0, 841.89))
        self.assertFalse(is_page_number("第2頁", 295.0, 818.33, 595.0, 841.89))


    def test_excludes_all_words_from_a_split_page_footer_line(self):
        words = [
            {"text": "\\u7b2c", "x": 261.18, "y": 813.11},
            {"text": "14", "x": 274.44, "y": 813.74},
            {"text": "\\u9801\\uff0c\\u5171", "x": 297.66, "y": 813.11},
            {"text": "27", "x": 320.88, "y": 813.74},
            {"text": "\\u9801", "x": 334.14, "y": 813.11},
        ]
        bounds = page_footer_bounds(words, 595.0, 841.92)
        self.assertEqual(bounds, (813.11, 813.74))
        self.assertTrue(all(
            is_page_footer_word(word, bounds, 595.0)
            for word in words
        ))
        self.assertEqual(last_row_upper_bound(words, 595.0, 841.92), 813.11)

    def test_last_row_reaches_continuation_lines_before_page_footer(self):
        words = [
            {"text": "0060", "x": 94.56, "y": 751.45},
            {"text": "19,21,22,", "x": 425.35, "y": 751.45},
            {"text": "24-26", "x": 425.35, "y": 766.45},
            {"text": "3", "x": 297.68, "y": 812.78},
            {"text": "\\u7b2c", "x": 287.57, "y": 813.23},
            {"text": "\\u9801", "x": 307.73, "y": 813.23},
        ]
        upper = last_row_upper_bound(words, 595.0, 841.68)
        self.assertLess(766.45, upper)
        self.assertEqual(upper, 812.78)
        self.assertGreater(upper, 751.45 + 14)


class StationSequenceTests(unittest.TestCase):
    def test_accepts_verified_count_last_station_and_continuity(self):
        validate_station_sequence([1, 2, 3, 4], 4, "0004")

    def test_rejects_a_complete_missing_trailing_page(self):
        with self.assertRaisesRegex(ValueError, "anchor count mismatch"):
            validate_station_sequence([1, 2, 3], 4, "0004")

    def test_rejects_the_wrong_final_station(self):
        with self.assertRaisesRegex(ValueError, "last station mismatch"):
            validate_station_sequence([1, 2, 3, 5], 4, "0004")

    def test_rejects_an_interior_gap_even_when_count_and_last_match(self):
        with self.assertRaisesRegex(ValueError, "complete sequential series"):
            validate_station_sequence([1, 2, 2, 4], 4, "0004")


if __name__ == "__main__":
    unittest.main()
