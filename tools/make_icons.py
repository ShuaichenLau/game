# -*- coding: utf-8 -*-
"""
生成 Chrome 扩展图标（16/48/128），纯标准库实现，无需 PIL。
绘制：圆角木质棋盘 + 楚河汉界网格 + 红黑两枚棋子。
"""
import os
import struct
import zlib


def _crc32(chunk_type, data):
    return zlib.crc32(chunk_type + data) & 0xFFFFFFFF


def _chunk(chunk_type, data):
    return (
        struct.pack('>I', len(data))
        + chunk_type
        + data
        + struct.pack('>I', _crc32(chunk_type, data))
    )


def write_png(path, size, pixels):
    """pixels: size*size 列表，每项为 (r, g, b, a)。"""
    raw = b''
    for y in range(size):
        raw += b'\x00'  # filter type 0
        for x in range(size):
            raw += bytes(pixels[y * size + x])
    ihdr = struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0)
    png = (
        b'\x89PNG\r\n\x1a\n'
        + _chunk(b'IHDR', ihdr)
        + _chunk(b'IDAT', zlib.compress(raw, 9))
        + _chunk(b'IEND', b'')
    )
    with open(path, 'wb') as f:
        f.write(png)


def lerp(a, b, t):
    return a + (b - a) * t


def make_icon(size):
    px = [[0, 0, 0, 0] for _ in range(size * size)]

    def set_px(x, y, r, g, b, a=255):
        if 0 <= x < size and 0 <= y < size:
            i = y * size + x
            px[i] = [int(r), int(g), int(b), int(a)]

    def inside_round(x, y):
        rc = size * 0.22
        cx, cy = x + 0.5, y + 0.5
        for corner_x, corner_y in ((rc, rc), (size - rc, rc),
                                   (rc, size - rc), (size - rc, size - rc)):
            if abs(cx - corner_x) < rc and abs(cy - corner_y) < rc:
                dx, dy = cx - corner_x, cy - corner_y
                if dx * dx + dy * dy > rc * rc:
                    return False
        return True

    # 木质渐变背景
    for y in range(size):
        for x in range(size):
            if not inside_round(x, y):
                continue
            t = y / max(1, size - 1)
            r = lerp(0xF0, 0xE0, t)
            g = lerp(0xD0, 0xB8, t)
            b = lerp(0x9A, 0x78, t)
            set_px(x, y, r, g, b)

    # 外框
    ft = max(1, round(size * 0.06))
    for y in range(size):
        for x in range(size):
            if not inside_round(x, y):
                continue
            if x < ft or x >= size - ft or y < ft or y >= size - ft:
                set_px(x, y, 0x7A, 0x4A, 0x21)

    inner_l, inner_t = ft, ft
    inner_r, inner_b = size - 1 - ft, size - 1 - ft
    inner_w = inner_r - inner_l
    inner_h = inner_b - inner_t

    # 网格：9 条竖线 + 10 条横线
    lt = max(1, round(size * 0.02))
    for col in range(9):
        x0 = round(inner_l + col * inner_w / 8)
        for dx in range(-lt // 2, lt // 2 + 1):
            for y in range(inner_t, inner_b + 1):
                set_px(x0 + dx, y, 0x5A, 0x3A, 0x1A)
    for row in range(10):
        y0 = round(inner_t + row * inner_h / 9)
        for dy in range(-lt // 2, lt // 2 + 1):
            for x in range(inner_l, inner_r + 1):
                set_px(x, y0 + dy, 0x5A, 0x3A, 0x1A)

    # 棋子：黑将（上方中央）、红帅（下方中央）
    pr = max(1.0, size * 0.11)
    edge = max(1.0, pr * 0.16)

    def draw_piece(col, row, fill, edge_col):
        cx = inner_l + col * inner_w / 8
        cy = inner_t + row * inner_h / 9
        for y in range(size):
            for x in range(size):
                dx = (x + 0.5) - cx
                dy = (y + 0.5) - cy
                d2 = dx * dx + dy * dy
                if d2 <= (pr + edge) ** 2:
                    set_px(x, y, *edge_col)
                if d2 <= pr ** 2:
                    set_px(x, y, *fill)

    draw_piece(4, 0, (0x23, 0x20, 0x1D), (0x0F, 0x0D, 0x0B))  # 黑将
    draw_piece(4, 9, (0xB0, 0x35, 0x2B), (0x8F, 0x2A, 0x22))  # 红帅

    return px


def main():
    out_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'icons')
    os.makedirs(out_dir, exist_ok=True)
    for size in (16, 48, 128):
        pixels = make_icon(size)
        path = os.path.join(out_dir, f'icon{size}.png')
        write_png(path, size, pixels)
        print(f'生成 {path} ({size}x{size})')


if __name__ == '__main__':
    main()
