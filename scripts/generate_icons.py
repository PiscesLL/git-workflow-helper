#!/usr/bin/env python3
"""Generate placeholder icon files for Tauri build.
Run this after npm install but before `npm run tauri dev`."""

import struct, zlib, os

def create_png(width, height, r, g, b):
    """Create a minimal valid PNG with a solid color and a subtle shape."""
    def chunk(chunk_type, data):
        c = chunk_type + data
        crc = struct.pack('>I', zlib.crc32(c) & 0xFFFFFFFF)
        return struct.pack('>I', len(data)) + c + crc

    header = b'\x89PNG\r\n\x1a\n'
    ihdr = chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0))

    # Build pixel data with a rounded rectangle shape
    raw = b''
    radius = max(4, width // 8)
    for y in range(height):
        raw += b'\x00'  # filter byte
        for x in range(width):
            # Simple rounded rect
            cx, cy = width / 2, height / 2
            rx, ry = width / 2 - radius, height / 2 - radius
            dx = max(0, abs(x - cx) - rx)
            dy = max(0, abs(y - cy) - ry)
            in_corner = dx * dx + dy * dy <= radius * radius
            in_rect = (radius <= x < width - radius or radius <= y < height - radius) and \
                      radius < x < width - radius and radius < y < height - radius
            inside = in_rect or in_corner

            if inside:
                # Gradient: darker towards bottom-right
                factor = 1.0 - (x + y) / (width + height) * 0.3
                rr = min(255, int(r * factor))
                gg = min(255, int(g * factor))
                bb = min(255, int(b * factor))
                raw += bytes([rr, gg, bb, 255])
            else:
                raw += bytes([0, 0, 0, 0])

    idat = chunk(b'IDAT', zlib.compress(raw))
    iend = chunk(b'IEND', b'')

    return header + ihdr + idat + iend


def create_ico(png_32_data):
    """Wrap a 32x32 PNG in an ICO container."""
    # ICO header
    ico = struct.pack('<HHH', 0, 1, 1)  # reserved=0, type=1(ico), count=1
    # Directory entry
    data_size = len(png_32_data)
    offset = 6 + 16  # header + 1 entry
    ico += struct.pack('<BBBBHHII', 32, 32, 0, 0, 1, 32, data_size, offset)
    ico += png_32_data
    return ico


def create_icns(png_128_data):
    """Create a minimal ICNS with ic07 (128x128) entry."""
    icon_type = b'ic07'
    icon_size = 8 + len(png_128_data)
    entry = icon_type + struct.pack('>I', icon_size) + png_128_data
    total_size = 8 + len(entry)
    icns = b'icns' + struct.pack('>I', total_size) + entry
    return icns


if __name__ == '__main__':
    base = os.path.join(os.path.dirname(__file__), '..', 'src-tauri', 'icons')
    os.makedirs(base, exist_ok=True)

    # Primary color: indigo (#6366f1)
    r, g, b = 99, 102, 241

    png_32 = create_png(32, 32, r, g, b)
    png_128 = create_png(128, 128, r, g, b)
    png_256 = create_png(256, 256, r, g, b)

    with open(os.path.join(base, '32x32.png'), 'wb') as f:
        f.write(png_32)
    with open(os.path.join(base, '128x128.png'), 'wb') as f:
        f.write(png_128)
    with open(os.path.join(base, '128x128@2x.png'), 'wb') as f:
        f.write(png_256)

    with open(os.path.join(base, 'icon.ico'), 'wb') as f:
        f.write(create_ico(png_32))

    with open(os.path.join(base, 'icon.icns'), 'wb') as f:
        f.write(create_icns(png_128))

    print(f"✓ Icons generated in {base}/")
    print("  32x32.png, 128x128.png, 128x128@2x.png, icon.ico, icon.icns")
