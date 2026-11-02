#!/usr/bin/env python3
"""The terrain build's two helpers (build-terrain.sh).

  terrain-tiles.py list <w,s,e,n> <max-zoom>
      prints "z x y" for every Web Mercator tile over the box, zooms 0 to max
  terrain-tiles.py pack <tiles-dir> <tiles.txt> <out.mbtiles>
      writes the PNGs under tiles-dir (z/x/y.png) into one MBTiles file,
      with the metadata a raster-dem source needs (format png, the box,
      the zooms, and the terrarium encoding noted), for `pmtiles convert`
"""
import math
import os
import sqlite3
import sys


def tiles(w, s, e, n, max_zoom):
    for z in range(max_zoom + 1):
        k = 2 ** z
        def x_of(lng): return int((lng + 180) / 360 * k)
        def y_of(lat):
            r = math.radians(lat)
            return int((1 - math.log(math.tan(r) + 1 / math.cos(r)) / math.pi) / 2 * k)
        for x in range(max(0, x_of(w)), min(k - 1, x_of(e)) + 1):
            for y in range(max(0, y_of(n)), min(k - 1, y_of(s)) + 1):
                yield z, x, y


def main():
    cmd = sys.argv[1]
    if cmd == "list":
        w, s, e, n = map(float, sys.argv[2].split(","))
        for z, x, y in tiles(w, s, e, n, int(sys.argv[3])):
            print(z, x, y)
        return
    if cmd == "pack":
        tiles_dir, listing, out = sys.argv[2:5]
        if os.path.exists(out):
            os.remove(out)
        db = sqlite3.connect(out)
        db.executescript("""
            CREATE TABLE metadata (name TEXT, value TEXT);
            CREATE TABLE tiles (zoom_level INTEGER, tile_column INTEGER, tile_row INTEGER, tile_data BLOB);
            CREATE UNIQUE INDEX tile_index ON tiles (zoom_level, tile_column, tile_row);
        """)
        zooms, count, missing = set(), 0, 0
        rows = []
        for line in open(listing):
            if not line.strip():
                continue
            z, x, y = map(int, line.split())
            path = os.path.join(tiles_dir, str(z), str(x), f"{y}.png")
            if not os.path.exists(path):
                missing += 1
                continue
            with open(path, "rb") as f:
                data = f.read()
            # MBTiles rows are TMS: y counted from the south
            rows.append((z, x, (2 ** z - 1) - y, data))
            zooms.add(z)
            count += 1
            if len(rows) >= 500:
                db.executemany("INSERT INTO tiles VALUES (?, ?, ?, ?)", rows)
                rows = []
        if rows:
            db.executemany("INSERT INTO tiles VALUES (?, ?, ?, ?)", rows)
        box = os.environ.get("TERRAIN_BOX", "-126,23.5,-65,50.5")
        meta = {
            "name": "Catholic Almanacs terrain",
            "description": "Elevation (terrarium-encoded) over the lower 48 for hillshading; "
                           "United States 3DEP and global GMTED2010 and SRTM terrain data courtesy of the U.S. Geological Survey, "
                           "tiles by Mapzen/Tilezen (AWS Open Data)",
            "format": "png", "type": "baselayer", "version": "1",
            "encoding": "terrarium",
            "bounds": box, "minzoom": str(min(zooms)), "maxzoom": str(max(zooms)),
            "attribution": "Terrain: U.S. 3DEP, SRTM and GMTED2010 data courtesy of the U.S. Geological Survey; tiles by Mapzen",
        }
        db.executemany("INSERT INTO metadata VALUES (?, ?)", meta.items())
        db.commit()
        db.close()
        print(f"[terrain] packed {count} tiles, zooms {min(zooms)}-{max(zooms)}; {missing} listed tiles were missing", file=sys.stderr)
        return
    raise SystemExit(__doc__)


if __name__ == "__main__":
    main()
