"""Synthetic text-layout regression tests; no official PDF or network required."""
import importlib.util
import unittest
import xml.etree.ElementTree as ET
from pathlib import Path

SCRIPT = Path(__file__).with_name('extract-hualien-polling-places-pdf.py')
spec = importlib.util.spec_from_file_location('hualien_polling_parser', SCRIPT)
parser = importlib.util.module_from_spec(spec)
spec.loader.exec_module(parser)


def add_word(page, text, x, y):
    ET.SubElement(page, 'word', {'xMin': str(x), 'yMin': str(y)}).text = text


def add_station(page, number, y, district='花蓮市', neighborhood='全里'):
    add_word(page, f'{number:04d}', 47.64, y)
    add_word(page, '社區活動中心', 86.64, y - 7.4)
    add_word(page, f'花蓮縣{district}示範里１鄰中正路１號', 160.1, y - 7.4)
    add_word(page, '示範里', 315.79, y)
    add_word(page, neighborhood, 380.0, y)
    add_word(page, '原住民別村', 450.22, y)


def make_xml(pages):
    root = ET.Element('html')
    doc = ET.SubElement(root, 'doc')
    for fill in pages:
        page = ET.SubElement(doc, 'page')
        fill(page)
    return ET.tostring(root, encoding='utf-8')


class HualienLayoutTests(unittest.TestCase):
    def test_first_table_page_and_continuation_first_row_keep_all_columns(self):
        def first(page):
            add_word(page, '花蓮市', 270.53, 119)
            add_word(page, '0001', 47.64, 155.5)
            add_word(page, '保祿牧', 86.64, 148.5)
            add_word(page, '靈中心', 102.86, 162.5)
            add_word(page, '花蓮縣花蓮市民德里１鄰民權', 160.1, 148.5)
            add_word(page, '一街２號', 160.1, 162.5)
            add_word(page, '民德里', 315.79, 155.5)
            add_word(page, '1-8,14,18-', 372.19, 148.5)
            add_word(page, '19,22-23', 366.79, 162.5)
            add_word(page, '不同原住民村', 450.22, 155.5)

        def continuation(page):
            add_station(page, 2, 53.7, neighborhood='全村')

        rows = parser.extract_from_xml(make_xml([lambda p: None, first, continuation]), expected_count=2)[0]['rows']
        self.assertEqual(rows[1], ['花蓮縣花蓮市第0001投開票所', '保祿牧靈中心',
                                  '花蓮縣花蓮市民德里１鄰民權一街２號', '民德里',
                                  '1-8,14,18-19,22-23'])
        self.assertEqual(rows[2][0], '花蓮縣花蓮市第0002投開票所')
        self.assertEqual(rows[2][4], '全村')
        self.assertNotIn('原住民', str(rows))

    def test_0093_0094_heading_precedes_anchor_but_not_midpoint(self):
        pages = [lambda p: None]
        for page_index in range(2, 8):
            numbers = range(1, 17) if page_index == 2 else range(17 + (page_index - 3) * 18,
                                                                  min(35 + (page_index - 3) * 18, 95))
            def fill(page, page_index=page_index, numbers=tuple(numbers)):
                if page_index == 2:
                    add_word(page, '花蓮市', 270.53, 119)
                for offset, number in enumerate(numbers):
                    y = (155.5 if page_index == 2 else 53.7) + offset * 41.52
                    if number == 94:
                        y = 286.3
                    add_station(page, number, y, district='新城鄉' if number == 94 else '花蓮市')
                if page_index == 7:
                    add_word(page, '新城鄉', 270.53, 249.3)
            pages.append(fill)
        rows = parser.extract_from_xml(make_xml(pages), expected_count=94)[0]['rows']
        self.assertEqual(rows[-2][0], '花蓮縣花蓮市第0093投開票所')
        self.assertEqual(rows[-1][0], '花蓮縣新城鄉第0094投開票所')

    def test_missing_station_rejected(self):
        def table(page):
            add_word(page, '花蓮市', 270.53, 119)
            add_station(page, 1, 155.5)
            add_station(page, 3, 197.0)
        with self.assertRaisesRegex(ValueError, 'Incomplete station sequence'):
            parser.extract_from_xml(make_xml([lambda p: None, table]), expected_count=3)


if __name__ == '__main__':
    unittest.main()
