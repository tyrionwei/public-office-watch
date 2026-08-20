import importlib.util
import pathlib
import unittest

from PIL import Image, ImageDraw

MODULE_PATH = pathlib.Path(__file__).with_name('cec-profile-card-geometry.py')
SPEC = importlib.util.spec_from_file_location('cec_profile_card_geometry', MODULE_PATH)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class ProfileCardGeometryTest(unittest.TestCase):
    def make_card(self):
        image = Image.new('RGB', (2000, 2400), 'white')
        draw = ImageDraw.Draw(image)
        color = (230, 0, 120)
        columns = [100, 350, 650, 1050]
        top = 300
        lines = {
            'header': 330,
            'education': 650,
            'platform_header': 710,
            'profile': 850,
            'party': 1050,
            'bottom': 1200,
        }
        for x in [columns[0], columns[1], columns[3]]:
            draw.line((x, top, x, lines['bottom']), fill=color, width=3)
        draw.line((columns[2], top, columns[2], lines['education']), fill=color, width=3)
        for y in [top, lines['header'], lines['bottom']]:
            draw.line((columns[0], y, columns[3], y), fill=color, width=3)
        for y in [lines['education'], lines['platform_header']]:
            draw.line((columns[1], y, columns[3], y), fill=color, width=3)
        for y in [lines['profile'], lines['party']]:
            draw.line((columns[0], y, columns[1], y), fill=color, width=3)
        return image

    def test_locates_card_profile_fields(self):
        result = MODULE.locate_cards(self.make_card())
        self.assertEqual(result['status'], 'located')
        self.assertEqual(len(result['cards']), 1)
        boxes = result['cards'][0]['boxes']
        self.assertLess(boxes['education']['xMax'], boxes['experience']['xMin'])
        self.assertGreater(boxes['personal']['yMin'], boxes['identity']['yMax'])

    def test_stops_when_cards_are_absent(self):
        result = MODULE.locate_cards(Image.new('RGB', (2000, 2400), 'white'))
        self.assertEqual(result['status'], 'cards_not_found')

    def test_locates_cards_in_both_page_columns(self):
        source = self.make_card()
        image = Image.new('RGB', (2200, source.height), 'white')
        card = source.crop((0, 0, 1100, 1300))
        image.paste(card, (0, 0))
        image.paste(card, (1100, 0))
        result = MODULE.locate_cards(image)
        self.assertEqual(result['status'], 'located')
        self.assertEqual(len(result['cards']), 2)
        self.assertLess(result['cards'][0]['boxes']['identity']['xMax'], result['cards'][1]['boxes']['identity']['xMin'])


if __name__ == '__main__':
    unittest.main()
