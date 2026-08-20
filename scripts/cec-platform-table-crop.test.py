import importlib.util
import pathlib
import unittest

from PIL import Image, ImageDraw

MODULE_PATH = pathlib.Path(__file__).with_name('cec-platform-table-crop.py')
SPEC = importlib.util.spec_from_file_location('cec_platform_table_crop', MODULE_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class TableCropTest(unittest.TestCase):
    def make_table(self):
        image = Image.new('RGB', (1000, 1200), 'white')
        draw = ImageDraw.Draw(image)
        color = (230, 0, 120)
        bounds = (50, 250, 950, 800)
        columns = [50, 120, 320, 620, 950]
        rows = [250, 285, 500, 800]
        for x in columns:
            draw.line((x, bounds[1], x, bounds[3]), fill=color, width=3)
        for y in rows:
            draw.line((bounds[0], y, bounds[2], y), fill=color, width=3)
        return image

    def test_locates_second_candidate_platform_cell(self):
        result = MODULE.locate_crop(self.make_table(), 2, 2)
        self.assertEqual(result['status'], 'located')
        self.assertGreater(result['crop']['xMin'], 600)
        self.assertLess(result['crop']['xMax'], 950)
        self.assertGreater(result['crop']['yMin'], 500)
        self.assertLess(result['crop']['yMax'], 800)

    def test_rejects_candidate_number_outside_race(self):
        result = MODULE.locate_crop(self.make_table(), 3, 2)
        self.assertEqual(result['status'], 'invalid_candidate_number')

    def test_stops_when_table_is_absent(self):
        image = Image.new('RGB', (1000, 1200), 'white')
        result = MODULE.locate_crop(image, 1, 1)
        self.assertEqual(result['status'], 'table_not_found')


if __name__ == '__main__':
    unittest.main()
