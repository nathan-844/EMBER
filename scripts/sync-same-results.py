#!/usr/bin/env python3
"""Stores the per-test results of SAME and SAME-R from NASA's results workbook.

NASA's PSI record for SAME-R (PSI-101) holds "SAME, SAME-R_Results.xlsx", which lists every flight
test of both experiments with its conditions and the particle sizes measured. This script downloads
it from PSI, records its SHA-256, and stores the sheet "Reduced data sheet" as src/data/tables/
PSI-101-1.json in the same form as the CSV run tables (header plus rows of cells as written).
Numbers are written at the precision the workbook stores them.

Usage: python3 scripts/sync-same-results.py [--from FILE]
       (needs the package pinned in scripts/requirements.txt; network access to psi.nasa.gov
       unless --from names a local copy of the workbook)
Then: npm run data:all

The sheet's results are Excel formulas. This script reads the values Excel last calculated and
saved with the file ("cached values"); it does not recalculate them. A formula cell with no cached
value would silently look blank, so the script counts formula cells and stops if any lacks one.
"""
import hashlib
import io
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
    if src:
        with open(src, "rb") as f:
            data = f.read()
    else:
        data = download()
    sha = hashlib.sha256(data).hexdigest()
    # Read from memory: no temporary file, so the script behaves the same on every platform.
    values = openpyxl.load_workbook(io.BytesIO(data), read_only=True, data_only=True)[SHEET]
    formulas = openpyxl.load_workbook(io.BytesIO(data), read_only=True, data_only=False)[SHEET]
    rows = list(values.iter_rows(values_only=True))
    formula_rows = list(formulas.iter_rows(values_only=True))
    header = [cell(h).strip() for h in rows[HEADER_ROW - 1]]
    while header and not header[-1]:
        header.pop()
    out = []
    formula_cells = 0
    uncached = []
    for n, r in enumerate(rows[HEADER_ROW:], start=HEADER_ROW + 1):
        if r[0] not in (1, 2):  # flight 1 = SAME, 2 = SAME-R; blank lines and notes are skipped
            continue
        out.append({"sourceRow": n, "cells": [cell(v) for v in r[: len(header)]]})
        for c, f in enumerate(formula_rows[n - 1][: len(header)]):
            if isinstance(f, str) and f.startswith("="):
                formula_cells += 1
                if r[c] is None:
                    uncached.append(f"row {n}, column {header[c]!r}")
    if uncached:
        sys.exit("Formula cells with no value saved by Excel (open and re-save the workbook, or report it): " + "; ".join(uncached[:10]))
    with open(f"src/data/tables/{TABLE_ID}.json", "w", encoding="utf-8", newline="\n") as f:
        json.dump({"header": header, "rows": out}, f)

    with open("src/data/table-manifest.json", encoding="utf-8") as f:
        manifest = json.load(f)
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
        "formulaCells": formula_cells,
        "values": "values Excel last calculated and saved in the file; not recalculated",
    }
    manifest["tables"] = [t for t in manifest["tables"] if t["id"] != TABLE_ID] + [entry]
    manifest["tables"].sort(key=lambda t: (int(t["accession"].split("-")[1]), t["id"]))
    with open("src/data/table-manifest.json", "w", encoding="utf-8", newline="\n") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)
        f.write("\n")
    print(f"{TABLE_ID}: {len(out)} rows from {SHEET!r}, {formula_cells} formula cells all with saved values, SHA-256 {sha[:12]}")


if __name__ == "__main__":
    main()
