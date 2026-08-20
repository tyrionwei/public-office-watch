import importlib.util
import pathlib
import sys
import unittest

from PIL import Image, ImageDraw

SCRIPTS_DIR = pathlib.Path(__file__).parent
sys.path.insert(0, str(SCRIPTS_DIR))
MODULE_PATH = SCRIPTS_DIR / 'cec-profile-table-geometry.py'
SPEC = importlib.util.spec_from_file_location('cec_profile_table_geometry', MODULE_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class ProfileTableGeometryTest(unittest.TestCase):
    def make_two_panel_table(self):
        image = Image.new('RGB', (2000, 1200), 'white')
        draw = ImageDraw.Draw(image)
        color = (230, 0, 120)
        columns = [50 + (90 * index) for index in range(11)]
        columns += [950 + (90 * index) for index in range(1, 11)]
        rows = [250, 500, 800]
        for x in columns:
            draw.line((x, rows[0], x, rows[-1]), fill=color, width=3)
        for y in rows:
            draw.line((columns[0], y, columns[-1], y), fill=color, width=3)
        return image

    def test_splits_shared_two_panel_table_into_profile_columns(self):
        result = MODULE.locate_profile_table(self.make_two_panel_table(), 2, 2)
        self.assertEqual(result['status'], 'located')
        self.assertEqual(len(result['panels']), 2)
        self.assertEqual(len(result['panels'][0]['columns']), 11)
        self.assertEqual(result['panels'][0]['xMax'], result['panels'][1]['xMin'])
        self.assertGreater(result['rowTop'], 500)
        self.assertLess(result['rowBottom'], 800)

    def test_rejects_a_shorter_candidate_count_inside_a_longer_table(self):
        image = Image.new('RGB', (1000, 1200), 'white')
        draw = ImageDraw.Draw(image)
        columns = [50 + (90 * index) for index in range(11)]
        rows = [250 + (100 * index) for index in range(7)]
        for x in columns:
            draw.line((x, rows[0], x, rows[-1]), fill=(230, 0, 120), width=3)
        for y in rows:
            draw.line((columns[0], y, columns[-1], y), fill=(230, 0, 120), width=3)
        result = MODULE.locate_profile_table(image, 1, 3)
        self.assertEqual(result['status'], 'table_not_found')

    def test_rejects_non_profile_column_count(self):
        image = Image.new('RGB', (1000, 1200), 'white')
        draw = ImageDraw.Draw(image)
        for x in [50, 250, 500, 750, 950]:
            draw.line((x, 250, x, 800), fill=(230, 0, 120), width=3)
        for y in [250, 500, 800]:
            draw.line((50, y, 950, y), fill=(230, 0, 120), width=3)
        result = MODULE.locate_profile_table(image, 1, 2)
        self.assertEqual(result['status'], 'profile_columns_not_found')

    def test_finds_a_long_candidate_table_that_extends_near_the_page_bottom(self):
        image = Image.new('RGB', (1000, 1200), 'white')
        draw = ImageDraw.Draw(image)
        columns = [50 + (90 * index) for index in range(11)]
        rows = [240 + round((940 / 18) * index) for index in range(19)]
        for x in columns:
            draw.line((x, rows[0], x, rows[-1]), fill=(230, 0, 120), width=3)
        for y in rows:
            draw.line((columns[0], y, columns[-1], y), fill=(230, 0, 120), width=3)
        result = MODULE.locate_profile_table(image, 18, 18)
        self.assertEqual(result['status'], 'located')
        self.assertGreater(result['rowTop'], rows[-2])
        self.assertLess(result['rowBottom'], rows[-1])

    def test_supports_a_separate_district_column(self):
        image = Image.new('RGB', (1100, 1200), 'white')
        draw = ImageDraw.Draw(image)
        columns = [50 + (90 * index) for index in range(12)]
        rows = [250, 500, 800]
        for x in columns:
            draw.line((x, rows[0], x, rows[-1]), fill=(230, 0, 120), width=3)
        for y in rows:
            draw.line((columns[0], y, columns[-1], y), fill=(230, 0, 120), width=3)
        result = MODULE.locate_profile_table(image, 1, 2)
        self.assertEqual(result['status'], 'located')
        self.assertEqual(result['profileColumnCount'], 11)
        self.assertEqual(len(result['panels'][0]['columns']), 12)

    def test_limits_table_search_to_the_requested_vertical_window(self):
        image = Image.new('RGB', (1100, 1600), 'white')
        draw = ImageDraw.Draw(image)
        columns = [50 + (90 * index) for index in range(12)]
        first_rows = [200, 400, 600]
        second_rows = [900, 1100, 1400]
        for rows in (first_rows, second_rows):
            for x in columns:
                draw.line((x, rows[0], x, rows[-1]), fill=(230, 0, 120), width=3)
            for y in rows:
                draw.line((columns[0], y, columns[-1], y), fill=(230, 0, 120), width=3)
        result = MODULE.locate_profile_table(image, 1, 2, after_y=700)
        self.assertEqual(result['status'], 'located')
        self.assertGreater(result['rowTop'], second_rows[0])
        self.assertLess(result['rowBottom'], second_rows[1])

    def test_ignores_short_horizontal_lines_inside_profile_cells(self):
        image = Image.new('RGB', (1100, 1600), 'white')
        draw = ImageDraw.Draw(image)
        columns = [50 + (90 * index) for index in range(12)]
        rows = [250, 470, 690, 910, 1130, 1380]
        for x in columns:
            draw.line((x, rows[0], x, rows[-1]), fill=(230, 0, 120), width=3)
        for y in rows:
            draw.line((columns[0], y, columns[-1], y), fill=(230, 0, 120), width=3)
        for y in (560, 760, 1010):
            draw.line((720, y, 1020, y), fill=(230, 0, 120), width=3)
        result = MODULE.locate_profile_table(image, 5, 5)
        self.assertEqual(result['status'], 'located')
        self.assertGreater(result['rowTop'], rows[-2])
        self.assertLess(result['rowBottom'], rows[-1])

    def test_accepts_candidate_rows_after_a_short_header_row(self):
        image = Image.new('RGB', (1100, 1600), 'white')
        draw = ImageDraw.Draw(image)
        columns = [50 + (90 * index) for index in range(12)]
        rows = [270, 400, 700, 1000, 1300]
        for x in columns:
            draw.line((x, rows[0], x, rows[-1]), fill=(230, 0, 120), width=3)
        for y in rows:
            draw.line((columns[0], y, columns[-1], y), fill=(230, 0, 120), width=3)
        result = MODULE.locate_profile_table(image, 1, 3)
        self.assertEqual(result['status'], 'located')
        self.assertGreater(result['rowTop'], rows[1])
        self.assertLess(result['rowBottom'], rows[2])

    def test_interpolates_one_missing_full_width_row_boundary(self):
        image = Image.new('RGB', (1100, 1500), 'white')
        draw = ImageDraw.Draw(image)
        columns = [50 + (90 * index) for index in range(12)]
        rows = [250, 450, 650, 850, 1050, 1250]
        for x in columns:
            draw.line((x, rows[0], x, rows[-1]), fill=(230, 0, 120), width=3)
        for index, y in enumerate(rows):
            right = columns[-1] if index != 4 else columns[-3]
            draw.line((columns[0], y, right, y), fill=(230, 0, 120), width=3)
        result = MODULE.locate_profile_table(image, 5, 5)
        self.assertEqual(result['status'], 'located')
        self.assertTrue(result['table'][4].get('interpolated'))
        self.assertGreater(result['rowTop'], 1050)
        self.assertLess(result['rowBottom'], 1250)

    def test_locates_a_manual_row_between_nearby_duplicate_segments(self):
        image = Image.new('RGB', (1100, 1200), 'white')
        draw = ImageDraw.Draw(image)
        columns = [50 + (90 * index) for index in range(12)]
        for x in columns:
            draw.line((x, 400, x, 800), fill=(230, 0, 120), width=3)
        draw.line((columns[0], 400, columns[-1], 400), fill=(230, 0, 120), width=3)
        draw.line((columns[1], 405, columns[-1], 405), fill=(230, 0, 120), width=3)
        draw.line((columns[0], 800, columns[-1], 800), fill=(230, 0, 120), width=3)
        result = MODULE.locate_profile_row(image, 400, 800)
        self.assertEqual(result['status'], 'located')
        self.assertEqual(result['profileColumnCount'], 11)
        self.assertGreater(result['rowTop'], 400)
        self.assertLess(result['rowBottom'], 800)

    def test_manual_row_rejects_missing_boundaries(self):
        image = self.make_two_panel_table()
        result = MODULE.locate_profile_row(image, 100, 1100)
        self.assertEqual(result['status'], 'manual_row_boundaries_not_found')


if __name__ == '__main__':
    unittest.main()
