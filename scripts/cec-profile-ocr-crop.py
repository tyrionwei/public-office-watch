#!/usr/bin/env python3
import argparse
from pathlib import Path

import numpy as np
from PIL import Image, ImageOps


def trim_single_glyph(image):
    grayscale = image.convert('L')
    pixels = np.asarray(grayscale)
    mask = pixels < 150
    mask[:5, :] = False
    mask[-5:, :] = False
    mask[:, :5] = False
    mask[:, -5:] = False
    dense_rows = mask.sum(axis=1) >= max(1, round(mask.shape[1] * 0.8))
    dense_columns = mask.sum(axis=0) >= max(1, round(mask.shape[0] * 0.8))
    mask[dense_rows, :] = False
    mask[:, dense_columns] = False
    rows, columns = np.nonzero(mask)
    if len(rows) == 0:
        return grayscale
    pad = 10
    left = max(0, int(columns.min()) - pad)
    top = max(0, int(rows.min()) - pad)
    right = min(grayscale.width, int(columns.max()) + pad + 1)
    bottom = min(grayscale.height, int(rows.max()) + pad + 1)
    glyph = grayscale.crop((left, top, right, bottom))
    target_height = 160
    width = max(1, round(glyph.width * target_height / glyph.height))
    glyph = glyph.resize((width, target_height), Image.LANCZOS)
    canvas = Image.new('L', (width + 40, target_height + 40), 255)
    canvas.paste(glyph, (20, 20))
    return canvas


def split_vertical_glyphs(image, count):
    if count < 1:
        return []
    boundaries = vertical_glyph_boundaries(image, count)
    return [
        trim_single_glyph(image.crop((0, boundaries[index], image.width, boundaries[index + 1])))
        for index in range(count)
    ]


def vertical_glyph_boundaries(image, count):
    if count < 1:
        return [0, image.height]
    pixels = np.asarray(image.convert('L'))
    mask = pixels < 180
    dense_rows = mask.sum(axis=1) >= max(1, round(mask.shape[1] * 0.8))
    dense_columns = mask.sum(axis=0) >= max(1, round(mask.shape[0] * 0.8))
    mask[dense_rows, :] = False
    mask[:, dense_columns] = False
    ink_rows = np.flatnonzero(mask.sum(axis=1) >= max(2, round(mask.shape[1] * 0.02)))
    if len(ink_rows) == 0:
        return [round(image.height * index / count) for index in range(count + 1)]
    top = int(ink_rows.min())
    bottom = int(ink_rows.max())
    blank = mask.sum(axis=1) <= max(1, round(mask.shape[1] * 0.01))
    gaps = []
    start = None
    for row in range(top + 1, bottom):
        if blank[row] and start is None:
            start = row
        elif not blank[row] and start is not None:
            if row - start >= max(3, round(image.height * 0.015)):
                gaps.append((start, row - 1))
            start = None
    if start is not None and bottom - start >= max(3, round(image.height * 0.015)):
        gaps.append((start, bottom - 1))
    selected = sorted(sorted(gaps, key=lambda gap: gap[1] - gap[0], reverse=True)[:count - 1])
    if len(selected) != count - 1:
        return [round(image.height * index / count) for index in range(count + 1)]
    return [0, *[round((start + end) / 2) for start, end in selected], image.height]


def candidate_card_name_band(image):
    left = round(image.width * 0.08)
    top = round(image.height * 0.18)
    right = round(image.width * 0.92)
    bottom = round(image.height * 0.43)
    band = ImageOps.autocontrast(ImageOps.grayscale(image.crop((left, top, right, bottom))))
    return band.resize((band.width * 2, band.height * 2), Image.LANCZOS)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('image')
    parser.add_argument('output_dir')
    parser.add_argument('--pdf-width', type=float, required=True)
    parser.add_argument('--pdf-height', type=float, required=True)
    parser.add_argument('--crop', action='append', default=[])
    parser.add_argument('--name-glyph-count', type=int, default=0)
    parser.add_argument('--candidate-card-name-band', action='store_true')
    args = parser.parse_args()

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    with Image.open(args.image) as image:
        scale_x = image.width / args.pdf_width
        scale_y = image.height / args.pdf_height
        for value in args.crop:
            name, x_min, y_min, x_max, y_max = value.split(':')
            box = (
                round(float(x_min) * scale_x),
                round(float(y_min) * scale_y),
                round(float(x_max) * scale_x),
                round(float(y_max) * scale_y),
            )
            crop = image.crop(box)
            crop.save(output_dir / f'{name}.png', dpi=(200, 200))
            if name == 'name' and args.name_glyph_count > 0:
                for index, glyph in enumerate(split_vertical_glyphs(crop, args.name_glyph_count), start=1):
                    glyph.save(output_dir / f'name-glyph-{index}.png', dpi=(200, 200))
            if name == 'name' and args.candidate_card_name_band:
                candidate_card_name_band(crop).save(output_dir / 'name-band.png', dpi=(200, 200))
            if name == 'number':
                trim_single_glyph(crop).save(output_dir / 'number-glyph.png', dpi=(200, 200))
            if name == 'gender':
                trim_single_glyph(crop).save(output_dir / 'gender-glyph.png', dpi=(200, 200))


if __name__ == '__main__':
    main()
