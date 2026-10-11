"""Render the project-owned geometric leaf mark. Requires Pillow."""
from pathlib import Path
from PIL import Image, ImageDraw
for size in (192, 512):
    image = Image.new('RGB', (size, size), '#e8eee2')
    draw = ImageDraw.Draw(image)
    scale = size / 512
    def coordinates(values):
        return tuple(round(value * scale) for value in values)
    draw.ellipse(coordinates((126, 105, 310, 425)), fill='#326950')
    draw.ellipse(coordinates((208, 78, 378, 336)), fill='#a9c3a0')
    image.save(Path(__file__).resolve().parent.parent / 'public' / f'icon-{size}.png')
