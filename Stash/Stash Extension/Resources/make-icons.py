"""Generate Stash extension icons. Run once: python make-icons.py"""
import struct, zlib, os, math

def png(size, bg=(26,26,26), fg=(255,255,255)):
    """Pure-stdlib PNG generator — no dependencies."""
    r = size // 5          # corner radius
    cx, cy = size / 2, size / 2
    inbox_w = size * 0.52
    inbox_h = size * 0.38
    arrow_h  = size * 0.28

    def in_rounded_rect(x, y):
        rx = min(max(x, r), size - r)
        ry = min(max(y, r), size - r)
        return (x - rx)**2 + (y - ry)**2 <= r**2 or (r <= x <= size-r or r <= y <= size-r)

    def draw_inbox(x, y):
        """Return True if pixel (x,y) is part of the inbox / arrow icon."""
        lx = x - cx
        ly = y - cy + size * 0.04

        # Arrow shaft
        shaft_w = inbox_w * 0.18
        shaft_top = -arrow_h * 0.55
        shaft_bot = arrow_h * 0.15
        if abs(lx) <= shaft_w / 2 and shaft_top <= ly <= shaft_bot:
            return True

        # Arrowhead (triangle pointing down)
        head_h = arrow_h * 0.52
        head_w = inbox_w * 0.42
        if ly >= shaft_bot and ly <= shaft_bot + head_h:
            prog = (ly - shaft_bot) / head_h
            if abs(lx) <= head_w * (1 - prog) / 2:
                return True

        # Inbox tray (U-shape via outer rect minus inner cut)
        tray_top = arrow_h * 0.28
        tray_bot = inbox_h * 0.74
        tray_lx  = -inbox_w / 2
        tray_rx  =  inbox_w / 2
        wall_t   = inbox_w * 0.12
        if tray_top <= ly <= tray_bot:
            in_outer = tray_lx <= lx <= tray_rx
            in_inner = tray_lx + wall_t <= lx <= tray_rx - wall_t and ly <= tray_bot - wall_t
            # side cut (open top)
            cut_top = tray_top + wall_t * 0.3
            in_top_open = ly < cut_top
            if in_outer and not (in_inner and not in_top_open):
                return True
        return False

    rows = []
    for y in range(size):
        row = bytearray()
        for x in range(size):
            if not in_rounded_rect(x, y):
                row += bytes([0, 0, 0, 0])   # transparent outside
            elif draw_inbox(x + 0.5, y + 0.5):
                row += bytes([*fg, 255])      # icon white
            else:
                row += bytes([*bg, 255])      # dark background
        rows.append(b'\x00' + bytes(row))

    raw = zlib.compress(b''.join(rows))
    def chunk(tag, data):
        c = struct.pack('>I', len(data)) + tag + data
        return c + struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff)

    return (
        b'\x89PNG\r\n\x1a\n'
        + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0))
        + chunk(b'IDAT', raw)
        + chunk(b'IEND', b'')
    )

os.makedirs('icons', exist_ok=True)
for s in (16, 32, 48, 128):
    path = f'icons/icon-{s}.png'
    with open(path, 'wb') as f:
        f.write(png(s))
    print(f'  {path}')
print('Done.')
