#!/usr/bin/env python3
"""Extracts a zip whose central directory points to the wrong offsets.

The Newberry's county download (US_AtlasHCB_Counties_Gen001.zip) has every
entry intact, but its directory's offsets are 12,104 bytes off, so unzip,
Python's zipfile and GDAL all refuse it. This takes each entry's name and
sizes from the directory, finds its local header by name, and reads the data
from there. Paths are kept inside the output directory.

Usage: unzip-lenient.py <archive.zip> <out-dir>
"""
import os
import struct
import sys
import zipfile
import zlib

archive, out = sys.argv[1], os.path.abspath(sys.argv[2])
data = open(archive, 'rb').read()
for info in zipfile.ZipFile(archive).infolist():
    if info.is_dir():
        continue
    target = os.path.abspath(os.path.join(out, info.filename))
    if not target.startswith(out + os.sep):
        sys.exit(f'refusing to write outside {out}: {info.filename}')
    name = info.filename.encode('utf-8')
    # the local header: signature, then 26 bytes of fields, then the name
    start = 0
    while True:
        at = data.find(b'PK\x03\x04', start)
        if at < 0:
            sys.exit(f'no local header for {info.filename}')
        n, extra = struct.unpack('<HH', data[at + 26:at + 30])
        if data[at + 30:at + 30 + n] == name:
            break
        start = at + 4
    method = struct.unpack('<H', data[at + 8:at + 10])[0]
    begin = at + 30 + n + extra
    raw = data[begin:begin + info.compress_size]
    body = zlib.decompress(raw, -15) if method == 8 else raw
    if len(body) != info.file_size or zlib.crc32(body) & 0xffffffff != info.CRC:
        sys.exit(f'{info.filename}: size or checksum does not match')
    os.makedirs(os.path.dirname(target), exist_ok=True)
    with open(target, 'wb') as f:
        f.write(body)
print(f'extracted {archive}', file=sys.stderr)
