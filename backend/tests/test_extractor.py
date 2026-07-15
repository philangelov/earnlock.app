"""Document extractor helpers — the PDF page-trim (pure, no network).

The model rejects PDFs over 100 pages, so a long deck is trimmed to
KNOWLEDGE_PDF_MAX_PAGES before it's sent. These cover the trim itself; the live
model call is exercised separately.
"""

import base64
import io

import pypdf

from app.ai.extractor import _trim_pdf


def _pdf_b64(num_pages: int) -> str:
    writer = pypdf.PdfWriter()
    for _ in range(num_pages):
        writer.add_blank_page(width=612, height=792)
    buf = io.BytesIO()
    writer.write(buf)
    return base64.b64encode(buf.getvalue()).decode()


def _page_count(data_b64: str) -> int:
    return len(pypdf.PdfReader(io.BytesIO(base64.b64decode(data_b64))).pages)


def test_trim_reduces_long_pdf_to_cap():
    trimmed = _trim_pdf(_pdf_b64(50), 20)
    assert _page_count(trimmed) == 20


def test_trim_leaves_short_pdf_untouched():
    original = _pdf_b64(5)
    # A PDF already within the cap is returned byte-for-byte (no re-encode).
    assert _trim_pdf(original, 20) == original


def test_trim_handles_non_pdf_bytes_gracefully():
    junk = base64.b64encode(b"this is not a pdf at all").decode()
    # Unparseable input is returned as-is; the model then reports it cleanly.
    assert _trim_pdf(junk, 20) == junk


def test_trim_handles_bad_base64_gracefully():
    assert _trim_pdf("not@@base64", 20) == "not@@base64"
