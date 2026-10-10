"""
PWA Asset Generator for Fluent Tindahan
Generates high-resolution, pixel-perfect, crisp icons and rich install screenshots.
"""
import os
import math
from PIL import Image, ImageDraw, ImageFont, ImageFilter

def create_fluent_tindahan_icon(size=512, is_maskable=False):
    # Render at 2x for supersampling antialiasing
    scale = 2
    canvas_size = size * scale
    img = Image.new('RGBA', (canvas_size, canvas_size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    pad = 0 if is_maskable else int(canvas_size * 0.06)
    bg_box = [pad, pad, canvas_size - pad, canvas_size - pad]
    radius = 0 if is_maskable else int(canvas_size * 0.22)

    # Gradient background: #0f7b51 (top) to #08432b (bottom)
    # We draw subtle gradient bands or rounded rect with smooth gradient
    bg = Image.new('RGBA', (canvas_size, canvas_size), (0, 0, 0, 0))
    bg_draw = ImageDraw.Draw(bg)
    
    steps = canvas_size
    top_color = (15, 123, 81)    # #0f7b51
    bottom_color = (8, 67, 43)   # #08432b
    
    for y in range(canvas_size):
        ratio = y / canvas_size
        r = int(top_color[0] + (bottom_color[0] - top_color[0]) * ratio)
        g = int(top_color[1] + (bottom_color[1] - top_color[1]) * ratio)
        b = int(top_color[2] + (bottom_color[2] - top_color[2]) * ratio)
        bg_draw.line([(0, y), (canvas_size, y)], fill=(r, g, b, 255))

    # Mask for rounded corners (if not maskable)
    mask = Image.new('L', (canvas_size, canvas_size), 0)
    mask_draw = ImageDraw.Draw(mask)
    if is_maskable:
        mask_draw.rectangle([0, 0, canvas_size, canvas_size], fill=255)
    else:
        mask_draw.rounded_rectangle(bg_box, radius=radius, fill=255)

    img.paste(bg, (0, 0), mask)
    draw = ImageDraw.Draw(img)

    # Inner glow / ambient border
    if not is_maskable:
        draw.rounded_rectangle(bg_box, radius=radius, outline=(255, 255, 255, 45), width=int(3 * scale))

    # Content safe zone: for maskable icons, keep within 80% circle
    # Center coordinates
    cx = canvas_size / 2
    cy = canvas_size / 2

    content_scale = 0.72 if is_maskable else 0.82
    cw = canvas_size * content_scale
    ch = canvas_size * content_scale
    left = cx - cw / 2
    right = cx + cw / 2
    top = cy - ch / 2 + int(canvas_size * 0.02)
    bottom = cy + ch / 2 + int(canvas_size * 0.02)

    # 1. Awning (Tindahan Roof Canopy)
    awning_top = top + int(ch * 0.08)
    awning_bottom = awning_top + int(ch * 0.32)
    awning_left = left + int(cw * 0.08)
    awning_right = right - int(cw * 0.08)
    awning_width = awning_right - awning_left

    # Store Awning stripes (5 stripes: Green & Golden/White)
    num_stripes = 5
    stripe_w = awning_width / num_stripes
    
    # Awning shadow underneath
    draw.rounded_rectangle(
        [awning_left + int(4*scale), awning_top + int(4*scale), awning_right - int(4*scale), awning_bottom + int(12*scale)],
        radius=int(12 * scale),
        fill=(0, 0, 0, 50)
    )

    # Store building body
    bldg_top = awning_bottom - int(ch * 0.06)
    bldg_bottom = bottom - int(ch * 0.04)
    bldg_left = awning_left + int(awning_width * 0.06)
    bldg_right = awning_right - int(awning_width * 0.06)
    
    # Store front wall (clean white-emerald tinted)
    draw.rounded_rectangle(
        [bldg_left, bldg_top, bldg_right, bldg_bottom],
        radius=int(16 * scale),
        fill=(248, 250, 249, 255),
        outline=(220, 235, 225, 255),
        width=int(2 * scale)
    )

    # Awning scalloped segments
    colors = [
        (16, 124, 65, 255),   # Emerald
        (255, 195, 45, 255),  # Warm Sari-sari Gold
        (16, 124, 65, 255),   # Emerald
        (255, 195, 45, 255),  # Gold
        (16, 124, 65, 255)    # Emerald
    ]

    for i in range(num_stripes):
        s_left = awning_left + i * stripe_w
        s_right = s_left + stripe_w
        # Polygon with scalloped bottom
        poly = [
            (s_left, awning_top),
            (s_right, awning_top),
            (s_right, awning_bottom - int(10 * scale)),
            (s_left + stripe_w/2, awning_bottom),
            (s_left, awning_bottom - int(10 * scale))
        ]
        draw.polygon(poly, fill=colors[i])
        # Outline for crisp definition
        draw.polygon(poly, outline=(0, 0, 0, 25))

    # Awning top bar
    draw.rounded_rectangle(
        [awning_left - int(2*scale), awning_top - int(4*scale), awning_right + int(2*scale), awning_top + int(4*scale)],
        radius=int(4*scale),
        fill=(255, 255, 255, 230)
    )

    # Inside the Tindahan Counter: Digital Screen / Peso Badge
    counter_top = bldg_top + int((bldg_bottom - bldg_top) * 0.18)
    counter_bottom = bldg_bottom - int((bldg_bottom - bldg_top) * 0.12)
    counter_left = bldg_left + int((bldg_right - bldg_left) * 0.12)
    counter_right = bldg_right - int((bldg_right - bldg_left) * 0.12)

    # Digital Screen / Card container
    draw.rounded_rectangle(
        [counter_left, counter_top, counter_right, counter_bottom],
        radius=int(12 * scale),
        fill=(15, 123, 81, 235),
        outline=(20, 160, 105, 255),
        width=int(2 * scale)
    )

    # Filipino Peso (₱) Symbol inside counter screen
    # Draw stylized ₱
    center_px = (counter_left + counter_right) / 2
    center_py = (counter_top + counter_bottom) / 2
    peso_h = (counter_bottom - counter_top) * 0.65
    peso_w = peso_h * 0.55
    stroke_w = max(int(6 * scale), int(peso_h * 0.14))

    p_left = center_px - peso_w / 2
    p_top = center_py - peso_h / 2
    p_bottom = center_py + peso_h / 2

    # Vertical bar of P
    draw.rounded_rectangle(
        [p_left, p_top, p_left + stroke_w, p_bottom],
        radius=int(stroke_w / 2),
        fill=(255, 255, 255, 255)
    )

    # Loop of P (half circle / rounded rect)
    loop_h = peso_h * 0.55
    draw.rounded_rectangle(
        [p_left, p_top, p_left + peso_w, p_top + loop_h],
        radius=int(loop_h * 0.45),
        outline=(255, 255, 255, 255),
        width=stroke_w
    )

    # Double crossbars of Philippine Peso ₱
    bar1_y = p_top + loop_h * 0.32
    bar2_y = p_top + loop_h * 0.68
    cross_left = p_left - int(stroke_w * 0.8)
    cross_right = p_left + peso_w * 0.85

    draw.rounded_rectangle(
        [cross_left, bar1_y - int(stroke_w * 0.22), cross_right, bar1_y + int(stroke_w * 0.22)],
        radius=int(stroke_w * 0.2),
        fill=(255, 195, 45, 255)
    )
    draw.rounded_rectangle(
        [cross_left, bar2_y - int(stroke_w * 0.22), cross_right, bar2_y + int(stroke_w * 0.22)],
        radius=int(stroke_w * 0.2),
        fill=(255, 195, 45, 255)
    )

    # Subtle POS indicators (WiFi / Online dot, barcode scanner lines)
    dot_x = counter_right - int(12 * scale)
    dot_y = counter_top + int(12 * scale)
    dot_r = int(5 * scale)
    draw.ellipse([dot_x - dot_r, dot_y - dot_r, dot_x + dot_r, dot_y + dot_r], fill=(34, 197, 94, 255))

    # Resize down to requested size with high quality LANCZOS
    final_img = img.resize((size, size), Image.Resampling.LANCZOS)
    return final_img

def create_screenshots(output_dir):
    os.makedirs(output_dir, exist_ok=True)

    # 1. Narrow screenshot (540x960 - mobile portrait)
    narrow = Image.new('RGB', (540, 960), (248, 250, 249))
    ndraw = ImageDraw.Draw(narrow)

    # Top App Bar / Header
    ndraw.rectangle([0, 0, 540, 72], fill=(15, 123, 81))
    # Header title FT icon
    ndraw.rounded_rectangle([16, 16, 56, 56], radius=8, fill=(255, 255, 255, 40))
    # Online badge
    ndraw.rounded_rectangle([380, 20, 520, 52], radius=16, fill=(34, 197, 94))
    
    # Dashboard summary cards
    # Card 1: Today's Sales
    ndraw.rounded_rectangle([20, 92, 520, 210], radius=14, fill=(255, 255, 255), outline=(225, 235, 230), width=2)
    # Card 2: Quick Action Tiles (POS, GCash, Utang, Inventory)
    tiles = [
        ("POS", (16, 124, 65), [20, 230, 260, 360]),
        ("GCash", (0, 122, 255), [280, 230, 520, 360]),
        ("Utang", (234, 88, 12), [20, 380, 260, 510]),
        ("Inventory", (107, 114, 128), [280, 380, 520, 510]),
    ]
    for label, col, box in tiles:
        ndraw.rounded_rectangle(box, radius=14, fill=col)
        # Inner white indicator
        ndraw.rounded_rectangle([box[0]+20, box[1]+20, box[0]+70, box[1]+70], radius=10, fill=(255, 255, 255, 50))

    # Product list preview
    ndraw.rounded_rectangle([20, 530, 520, 850], radius=14, fill=(255, 255, 255), outline=(225, 235, 230), width=2)
    for i in range(4):
        item_y = 550 + i * 72
        ndraw.rounded_rectangle([36, item_y, 96, item_y + 56], radius=8, fill=(240, 244, 242))
        ndraw.rounded_rectangle([116, item_y + 10, 340, item_y + 26], radius=4, fill=(210, 220, 215))
        ndraw.rounded_rectangle([116, item_y + 34, 220, item_y + 46], radius=4, fill=(230, 238, 234))
        ndraw.rounded_rectangle([400, item_y + 16, 500, item_y + 42], radius=6, fill=(16, 124, 65))

    # Bottom navigation bar
    ndraw.rectangle([0, 880, 540, 960], fill=(255, 255, 255), outline=(230, 235, 232), width=1)
    for i in range(5):
        cx = 54 + i * 108
        ndraw.ellipse([cx - 16, 904, cx + 16, 936], fill=(15, 123, 81) if i == 0 else (200, 210, 205))

    narrow.save(os.path.join(output_dir, "screenshot-narrow.png"), "PNG")

    # 2. Wide screenshot (1280x720 - desktop landscape)
    wide = Image.new('RGB', (1280, 720), (248, 250, 249))
    wdraw = ImageDraw.Draw(wide)

    # Top Header
    wdraw.rectangle([0, 0, 1280, 60], fill=(15, 123, 81))
    wdraw.rounded_rectangle([24, 12, 180, 48], radius=8, fill=(255, 255, 255, 40))
    wdraw.rounded_rectangle([1120, 14, 1256, 46], radius=16, fill=(34, 197, 94))

    # Main POS split layout: Left Catalog (780px), Right Cart / Checkout (440px)
    wdraw.rounded_rectangle([24, 80, 800, 700], radius=12, fill=(255, 255, 255), outline=(225, 235, 230), width=1)
    # Search bar & category chips
    wdraw.rounded_rectangle([44, 100, 780, 140], radius=8, fill=(245, 248, 246))
    for c in range(5):
        wdraw.rounded_rectangle([44 + c * 130, 154, 160 + c * 130, 184], radius=15, fill=(16, 124, 65) if c == 0 else (240, 244, 242))

    # Product cards grid (3 cols x 3 rows)
    for row in range(3):
        for col in range(3):
            px = 44 + col * 248
            py = 200 + row * 155
            wdraw.rounded_rectangle([px, py, px + 236, py + 140], radius=10, fill=(255, 255, 255), outline=(230, 238, 234), width=1)
            wdraw.rounded_rectangle([px + 12, py + 12, px + 72, py + 72], radius=6, fill=(242, 247, 244))
            wdraw.rounded_rectangle([px + 84, py + 16, px + 220, py + 32], radius=4, fill=(200, 210, 205))
            wdraw.rounded_rectangle([px + 84, py + 42, px + 170, py + 56], radius=4, fill=(225, 235, 230))
            wdraw.rounded_rectangle([px + 12, py + 92, px + 224, py + 128], radius=6, fill=(16, 124, 65))

    # Right Cart Checkout Panel
    wdraw.rounded_rectangle([824, 80, 1256, 700], radius=12, fill=(255, 255, 255), outline=(225, 235, 230), width=1)
    wdraw.rounded_rectangle([848, 100, 1232, 140], radius=8, fill=(245, 248, 246))
    # Cart items
    for item in range(4):
        iy = 160 + item * 70
        wdraw.rounded_rectangle([848, iy, 1232, iy + 58], radius=8, fill=(250, 252, 251), outline=(235, 240, 238), width=1)
    # Total & Checkout button
    wdraw.rounded_rectangle([848, 540, 1232, 610], radius=8, fill=(240, 247, 243))
    wdraw.rounded_rectangle([848, 626, 1232, 680], radius=8, fill=(15, 123, 81))

    wide.save(os.path.join(output_dir, "screenshot-wide.png"), "PNG")

def main():
    public_dir = os.path.abspath(r"d:\Projects\fluent-tindahan\frontend\public")
    os.makedirs(public_dir, exist_ok=True)
    screenshots_dir = os.path.join(public_dir, "screenshots")
    os.makedirs(screenshots_dir, exist_ok=True)

    print(f"Generating PWA assets in {public_dir}...")

    # 1. 64x64 PNG
    icon_64 = create_fluent_tindahan_icon(64, is_maskable=False)
    icon_64.save(os.path.join(public_dir, "pwa-64x64.png"), "PNG")
    print("[OK] Created pwa-64x64.png")

    # 2. 180x180 Apple Touch Icon
    apple_icon = create_fluent_tindahan_icon(180, is_maskable=False)
    apple_icon.save(os.path.join(public_dir, "apple-touch-icon.png"), "PNG")
    print("[OK] Created apple-touch-icon.png")

    # 3. 192x192 Standard & Maskable
    icon_192 = create_fluent_tindahan_icon(192, is_maskable=False)
    icon_192.save(os.path.join(public_dir, "pwa-192x192.png"), "PNG")
    print("[OK] Created pwa-192x192.png")

    icon_192_m = create_fluent_tindahan_icon(192, is_maskable=True)
    icon_192_m.save(os.path.join(public_dir, "pwa-192x192-maskable.png"), "PNG")
    print("[OK] Created pwa-192x192-maskable.png")

    # 4. 512x512 Standard & Maskable
    icon_512 = create_fluent_tindahan_icon(512, is_maskable=False)
    icon_512.save(os.path.join(public_dir, "pwa-512x512.png"), "PNG")
    print("[OK] Created pwa-512x512.png")

    icon_512_m = create_fluent_tindahan_icon(512, is_maskable=True)
    icon_512_m.save(os.path.join(public_dir, "pwa-512x512-maskable.png"), "PNG")
    print("[OK] Created pwa-512x512-maskable.png")

    # 5. multi-size favicon.ico (16, 32, 48)
    ico_16 = create_fluent_tindahan_icon(16, is_maskable=False)
    ico_32 = create_fluent_tindahan_icon(32, is_maskable=False)
    ico_48 = create_fluent_tindahan_icon(48, is_maskable=False)
    ico_16.save(
        os.path.join(public_dir, "favicon.ico"),
        format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48)],
        append_images=[ico_32, ico_48]
    )
    print("[OK] Created favicon.ico")

    # 6. Screenshots
    create_screenshots(screenshots_dir)
    print("[OK] Created rich install screenshots (narrow & wide)")

if __name__ == "__main__":
    main()
