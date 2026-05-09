#!/usr/bin/env python3
"""
customize.py — Substitute agency-info.json values into the 25 master .docx files.

Run from resources/legal-templates/:
    /tmp/legal-templates-venv/bin/python scripts/customize.py

Inputs:
    agency-info.json (sibling of this scripts/ directory)
    client-onboarding/docx/*.docx
    hiring/docx/*.docx
    state-addenda/docx/*.docx

Output:
    customized/<AGENCY_SLUG>/docx/<original-filename>.docx

Strategy: dependency-free zip+XML rewrite (Python 3 standard library only).

A .docx file is a zip archive of XML parts. Every visible piece of text in
Word lives inside <w:t> elements (under <w:r> runs) inside one of:
    word/document.xml
    word/header*.xml
    word/footer*.xml

python-docx splits long strings into many runs/text nodes, which means a
naive XML find/replace on "{{AGENCY_NAME}}" can miss tokens that span runs.
We work on the concatenated *visible* text per paragraph: collect all
<w:t> nodes inside each <w:p>, join their text, do the substitution on the
joined string, and re-distribute the result by collapsing extras into the
first node.

Per-instance markers like {{CLIENT_NAME}}, {{HIRE_DATE}}, etc. are left
untouched: they are deliberately absent from agency-info.json so they remain
as {{...}} markers (or as ____________________ blanks) for hand-fill at signing.
"""

from __future__ import annotations

import json
import re
import sys
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parent.parent
AGENCY_INFO = ROOT / "agency-info.json"
SOURCE_DIRS = [
    ROOT / "client-onboarding" / "docx",
    ROOT / "hiring" / "docx",
    ROOT / "state-addenda" / "docx",
]
OUTPUT_BASE = ROOT / "customized"

W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
ET.register_namespace("w", W_NS)
W = f"{{{W_NS}}}"

_PARAGRAPH_TAG = f"{W}p"
_TEXT_TAG = f"{W}t"
_XML_SPACE_ATTR = "{http://www.w3.org/XML/1998/namespace}space"


def load_replacements(info: dict) -> dict:
    """
    Build a {{KEY}} -> value map from agency-info.json.

    AGENCY_SLUG is excluded from substitution (it is structural — controls
    the output directory — not document content).
    """
    repl = {}
    for key, value in info.items():
        if key == "AGENCY_SLUG":
            continue
        if not isinstance(value, str):
            value = str(value)
        repl[f"{{{{{key}}}}}"] = value
    return repl


def apply_substitutions(text: str, replacements: dict) -> str:
    """Replace every {{KEY}} present in `replacements`. Other {{...}} markers preserved."""
    if not text:
        return text
    out = text
    for token, value in replacements.items():
        if token in out:
            out = out.replace(token, value)
    return out


def _substitute_paragraph(paragraph, replacements):
    """
    Substitute placeholders across all <w:t> children in a paragraph,
    then collapse all replaced text into the first text node.

    Returns the number of placeholder tokens substituted (best-effort).
    """
    text_nodes = [n for n in paragraph.iter() if n.tag == _TEXT_TAG]
    if not text_nodes:
        return 0

    parts = [n.text or "" for n in text_nodes]
    joined = "".join(parts)
    new_text = apply_substitutions(joined, replacements)

    if new_text == joined:
        return 0

    # Count tokens substituted (for reporting).
    count = 0
    for token in replacements:
        count += joined.count(token)

    text_nodes[0].text = new_text
    text_nodes[0].set(_XML_SPACE_ATTR, "preserve")
    for n in text_nodes[1:]:
        n.text = ""

    return count


def _process_xml_bytes(xml_bytes: bytes, replacements: dict):
    """Run paragraph-level substitution over a single document part."""
    try:
        root = ET.fromstring(xml_bytes)
    except ET.ParseError:
        return xml_bytes, 0

    total = 0
    for paragraph in root.iter(_PARAGRAPH_TAG):
        total += _substitute_paragraph(paragraph, replacements)

    # Fallback for any text outside paragraphs (text boxes, SDT controls).
    for t in root.iter(_TEXT_TAG):
        if t.text:
            new = apply_substitutions(t.text, replacements)
            if new != t.text:
                t.text = new
                total += 1

    out = ET.tostring(root, xml_declaration=True, encoding="UTF-8")
    return out, total


def _is_replaceable_part(name: str) -> bool:
    """Apply substitutions to body, headers, footers, footnotes, endnotes."""
    if not name.startswith("word/"):
        return False
    leaf = name[len("word/"):]
    if leaf == "document.xml":
        return True
    return bool(re.match(r"^(header|footer|footnotes|endnotes)\d*\.xml$", leaf))


def customize_docx(src: Path, dst: Path, replacements: dict) -> int:
    """Copy `src` to `dst` with placeholders replaced. Returns # substitutions."""
    dst.parent.mkdir(parents=True, exist_ok=True)
    total = 0

    with zipfile.ZipFile(src, "r") as zin:
        with zipfile.ZipFile(dst, "w", zipfile.ZIP_DEFLATED) as zout:
            for item in zin.infolist():
                data = zin.read(item.filename)
                if _is_replaceable_part(item.filename):
                    data, n = _process_xml_bytes(data, replacements)
                    total += n
                # Preserve original metadata (date, attributes).
                zout.writestr(item, data)

    return total


def main() -> int:
    if not AGENCY_INFO.exists():
        print(f"ERROR: {AGENCY_INFO} not found.", file=sys.stderr)
        return 2

    try:
        info = json.loads(AGENCY_INFO.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        print(f"ERROR: agency-info.json is not valid JSON: {e}", file=sys.stderr)
        return 2

    slug = info.get("AGENCY_SLUG")
    if not slug or not isinstance(slug, str):
        print("ERROR: agency-info.json must define AGENCY_SLUG (kebab-case string).", file=sys.stderr)
        return 2

    replacements = load_replacements(info)
    out_dir = OUTPUT_BASE / slug / "docx"
    out_dir.mkdir(parents=True, exist_ok=True)

    sources = []
    for d in SOURCE_DIRS:
        if not d.exists():
            print(f"WARNING: source directory missing: {d}", file=sys.stderr)
            continue
        sources.extend(sorted(d.glob("*.docx")))

    if not sources:
        print("ERROR: no master .docx files found. Run scripts/generate_docs.py first.", file=sys.stderr)
        return 2

    print(f"Customizing {len(sources)} files for agency '{slug}'")
    print(f"Output: {out_dir}")
    print()

    grand_total = 0
    for src in sources:
        dst = out_dir / src.name
        n = customize_docx(src, dst, replacements)
        grand_total += n
        rel = dst.relative_to(ROOT)
        print(f"  wrote {rel}  ({n} substitutions)")

    print()
    print(f"Done. {len(sources)} files written, {grand_total} placeholder substitutions.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
