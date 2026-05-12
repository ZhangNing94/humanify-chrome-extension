"""Generate Humanify extension icons using PIL"""
from PIL import Image, ImageDraw

def create_icon(size):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    margin = size * 0.1
    cx, cy = size / 2, size / 2
    r = (size - 2 * margin) / 2
    
    # Gradient-style background (violet)
    bg_points = [
        (margin, margin),
        (size - margin, margin),
        (size - margin, size - margin),
        (margin, size - margin)
    ]
    draw.rounded_rectangle(
        [margin, margin, size - margin, size - margin],
        radius=int(size * 0.2),
        fill=(99, 102, 241)
    )
    
    # Draw bold "H" letter
    letter_size = int(r * 1.1)
    stroke = max(2, int(size * 0.12))
    
    # Left vertical
    x_left = cx - letter_size * 0.35
    draw.rectangle(
        [x_left, cy - letter_size * 0.5,
         x_left + stroke, cy + letter_size * 0.5],
        fill=(255, 255, 255)
    )
    
    # Right vertical
    x_right = cx + letter_size * 0.35 - stroke
    draw.rectangle(
        [x_right, cy - letter_size * 0.5,
         x_right + stroke, cy + letter_size * 0.5],
        fill=(255, 255, 255)
    )
    
    # Horizontal bar
    draw.rectangle(
        [x_left, cy - stroke // 2,
         x_right + stroke, cy + stroke // 2],
        fill=(255, 255, 255)
    )
    
    return img

for size in [16, 48, 128]:
    icon = create_icon(size)
    icon.save(f'icons/icon{size}.png')

print("Icons generated: icon16.png, icon48.png, icon128.png")