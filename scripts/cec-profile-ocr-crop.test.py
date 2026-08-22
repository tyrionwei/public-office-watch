import importlib.util
import pathlib
import unittest

from PIL import Image, ImageDraw

MODULE_PATH = pathlib.Path(__file__).with_name('cec-profile-ocr-crop.py')
SPEC = importlib.util.spec_from_file_location('cec_profile_ocr_crop', MODULE_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class ProfileOcrCropTest(unittest.TestCase):
    def test_splits_a_vertical_name_into_the_expected_glyph_count(self):
        image = Image.new('RGB', (60, 180), 'white')
        draw = ImageDraw.Draw(image)
        for top in (10, 70, 130):
            draw.rectangle((15, top, 45, top + 35), fill='black')
        glyphs = MODULE.split_vertical_glyphs(image, 3)
        self.assertEqual(len(glyphs), 3)
        self.assertTrue(all(min(glyph.getdata()) < 50 for glyph in glyphs))
        self.assertTrue(all(glyph.width > 40 and glyph.height == 200 for glyph in glyphs))

    def test_splits_vertical_glyphs_at_the_largest_whitespace_gaps(self):
        image = Image.new('RGB', (100, 610), 'white')
        draw = ImageDraw.Draw(image)
        draw.rectangle((15, 120, 85, 245), fill='black')
        draw.rectangle((15, 290, 85, 380), fill='black')
        draw.rectangle((15, 420, 85, 525), fill='black')
        boundaries = MODULE.vertical_glyph_boundaries(image, 3)
        self.assertEqual(boundaries[0], 0)
        self.assertEqual(boundaries[-1], 610)
        self.assertTrue(245 < boundaries[1] < 290)
        self.assertTrue(380 < boundaries[2] < 420)

    def test_trims_a_colored_candidate_number_without_the_table_border(self):
        image = Image.new('RGB', (80, 260), 'white')
        draw = ImageDraw.Draw(image)
        draw.rectangle((8, 0, 11, 259), fill=(235, 0, 140))
        draw.rectangle((30, 90, 52, 175), fill=(235, 0, 140))
        glyph = MODULE.trim_single_glyph(image)
        self.assertEqual(glyph.height, 200)
        self.assertLess(glyph.width, 140)
        self.assertLess(min(glyph.getdata()), 100)

    def test_extracts_the_horizontal_name_band_from_a_candidate_card(self):
        image = Image.new('RGB', (400, 800), 'white')
        draw = ImageDraw.Draw(image)
        draw.rectangle((80, 180, 320, 260), fill='black')
        band = MODULE.candidate_card_name_band(image)
        self.assertEqual(band.size, (672, 400))
        self.assertLess(min(band.getdata()), 50)


if __name__ == '__main__':
    unittest.main()
