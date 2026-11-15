#!/usr/bin/env python3
"""Stores the per-test results of SAME and SAME-R from NASA's results workbook.

NASA's PSI record for SAME-R (PSI-101) holds "SAME, SAME-R_Results.xlsx", which lists every flight
test of both experiments with its conditions and the particle sizes measured. This script downloads
it from PSI, records its SHA-256, and stores the sheet "Reduced data sheet" as src/data/tables/
PSI-101-1.json in the same form as the CSV run tables (header plus rows of cells as written).
Numbers are written at the precision the workbook stores them.

Usage: python3 scripts/sync-same-results.py [--from FILE]   (needs openpyxl; network for PSI)
Then: npm run data:all
"""
import hashlib
import json
import sys
import urllib.parse
import urllib.request

import openpyxl

ACCESSION = "PSI-101"
FILE = "PSI-101_Analyzed Data_SAME, SAME-R_Results.xlsx"
SHEET = "Reduced data sheet"
TABLE_ID = "PSI-101-1"
HEADER_ROW = 2  # Excel row holding the column names; row 1 groups them.
BASE = "https://psi.nasa.gov"


def download() -> bytes:
    q = urllib.parse.urlencode({"file": FILE, "version": 1, "redirect": "false"})
    with urllib.request.urlopen(f"{BASE}/geode-py/ws/studies/{ACCESSION}/download?{q}", timeout=60) as r:
        url = r.read().decode().strip().strip('"')
    with urllib.request.urlopen(url, timeout=300) as r:
        return r.read()


def cell(v) -> str:
    if v is None:
        return ""
    if isinstance(v, bool):
        return str(v)
    if isinstance(v, int):
        return str(v)
    if isinstance(v, float):
        return str(int(v)) if v.is_integer() else repr(v)
    return str(v)


def main() -> None:
    src = sys.argv[sys.argv.index("--from") + 1] if "--from" in sys.argv else None
    data = open(src, "rb").read() if src else download()
    sha = hashlib.sha256(data).hexdigest()
    tmp = "/tmp/same-results.xlsx" if not src else src
    if not src:
        open(tmp, "wb").write(data)
    wb = openpyxl.load_workbook(tmp, read_only=True, data_only=True)
    ws = wb[SHEET]
    rows = list(ws.iter_rows(values_only=True))
    header = [cell(h).strip() for h in rows[HEADER_ROW - 1]]
    while header and not header[-1]:
        header.pop()
    out = []
    for n, r in enumerate(rows[HEADER_ROW:], start=HEADER_ROW + 1):
        cells = [cell(v) for v in r[: len(header)]]
        if r[0] in (1, 2):  # flight 1 = SAME, 2 = SAME-R; blank lines and notes are skipped
            out.append({"sourceRow": n, "cells": cells})
    json.dump({"header": header, "rows": out}, open(f"src/data/tables/{TABLE_ID}.json", "w"))

    manifest = json.load(open("src/data/table-manifest.json"))
    entry = {
        "id": TABLE_ID,
        "accession": ACCESSION,
        "file": FILE,
        "sheet": SHEET,
        "version": 1,
        "sha256": sha,
        "rows": len(out),
        "columns": header,
        "url": f"{BASE}/physci/repo/data/investigations/{ACCESSION}",
        "origin": f"Live PSI download of the workbook; sheet \"{SHEET}\", rows with flight 1 (SAME) or 2 (SAME-R)",
    }
    manifest["tables"] = [t for t in manifest["tables"] if t["id"] != TABLE_ID] + [entry]
    manifest["tables"].sort(key=lambda t: (int(t["accession"].split("-")[1]), t["id"]))
    json.dump(manifest, open("src/data/table-manifest.json", "w"), indent=2, ensure_ascii=False)
    open("src/data/table-manifest.json", "a").write("\n")
    print(f"{TABLE_ID}: {len(out)} rows from {SHEET!r}, SHA-256 {sha[:12]}")


if __name__ == "__main__":
    main()
