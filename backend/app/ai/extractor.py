"""AI document extraction — turn an uploaded file (PDF or photo) into study text.

The materials feature lets a learner upload a worksheet, a textbook page, or a
screenshot instead of pasting text (docs/api-contract.md §4). A file has no place in
the rest of the pipeline — quiz generation, material_stats, and the understanding % all
read the plain-text ``raw_text`` column — so before anything is stored the file is
transcribed into that plain text here.

Transcription uses the same Anthropic model as generation/remediation: Claude reads
PDFs and images natively (a document/image content block), so there is no OCR
dependency and a scanned worksheet, a photo, and a born-digital PDF share one path.

Unlike the generator and explainer, there is **no offline fallback**: reading an
arbitrary PDF/photo genuinely needs the model. With no API key configured the caller
gets :class:`DocumentExtractionError` (surfaced as "add a key / paste text instead")
rather than silently storing an empty material.
"""

import base64
import io
import logging

from flask import current_app

try:  # optional dependency — only needed when an API key is configured
    import anthropic
except ImportError:  # pragma: no cover - exercised only in a stripped install
    anthropic = None

try:  # pure-python PDF trim; without it a long PDF is sent whole and may be rejected
    import pypdf
except ImportError:  # pragma: no cover
    pypdf = None

logger = logging.getLogger(__name__)

# The model rejects PDFs over 100 pages. We trim to a smaller cap anyway (config
# KNOWLEDGE_PDF_MAX_PAGES) — the stored text is length-capped downstream, so a couple
# dozen pages is plenty, and reading fewer pages is faster and cheaper.
_HARD_PDF_PAGE_LIMIT = 100

# The media types the model can read as a document/image block. PDFs go in a `document`
# block; the raster formats go in an `image` block (see _content_block).
PDF_MEDIA_TYPE = "application/pdf"
IMAGE_MEDIA_TYPES = ("image/jpeg", "image/png", "image/gif", "image/webp")
SUPPORTED_MEDIA_TYPES = (PDF_MEDIA_TYPE, *IMAGE_MEDIA_TYPES)


class DocumentExtractionError(Exception):
    """Raised when an uploaded file can't be turned into usable study text."""


def _content_block(data_b64: str, media_type: str) -> dict:
    """Wrap the base64 payload in the right content block for its media type."""
    source = {"type": "base64", "media_type": media_type, "data": data_b64}
    if media_type == PDF_MEDIA_TYPE:
        return {"type": "document", "source": source}
    return {"type": "image", "source": source}


def _trim_pdf(data_b64: str, max_pages: int) -> str:
    """Keep only the first ``max_pages`` pages of a PDF, re-encoded as base64.

    Long decks (a full lecture) exceed the model's 100-page limit, and only the first
    stretch is needed to fill the length-capped stored text. Best-effort: if pypdf isn't
    installed or the PDF won't parse, the original is returned and the model handles it.
    """
    if pypdf is None:
        return data_b64
    try:
        raw = base64.b64decode(data_b64, validate=True)
        reader = pypdf.PdfReader(io.BytesIO(raw))
        if len(reader.pages) <= max_pages:
            return data_b64
        writer = pypdf.PdfWriter()
        for page in reader.pages[:max_pages]:
            writer.add_page(page)
        buf = io.BytesIO()
        writer.write(buf)
        return base64.b64encode(buf.getvalue()).decode()
    except Exception as exc:  # best-effort: any parse/encode failure → send as-is
        logger.warning("PDF trim failed (%s); sending the file as-is", exc)
        return data_b64


_SYSTEM = (
    "You transcribe study material from documents and photos into clean plain text so "
    "it can be used to write quiz questions. Output ONLY the educational content — the "
    "definitions, facts, worked examples, vocabulary, and explanations present in the "
    "file. Preserve headings and the order of the material. Silently skip page "
    "numbers, running headers/footers, watermarks, and answer-key markings. Do not add "
    "commentary, do not summarise, and do not invent anything not in the file. If the "
    "file contains no readable study material, reply with exactly: NO_TEXT_FOUND"
)


class ClaudeDocumentExtractor:
    """Transcribes an uploaded file to plain study text via the Anthropic API."""

    def __init__(
        self, api_key: str, model: str, max_tokens: int = 8000, max_pdf_pages: int = 20
    ):
        if anthropic is None:  # pragma: no cover - guarded by get_document_extractor()
            raise DocumentExtractionError("anthropic package is not installed")
        self._client = anthropic.Anthropic(api_key=api_key)
        self._model = model
        self._max_tokens = max_tokens
        self._max_pdf_pages = max(1, min(max_pdf_pages, _HARD_PDF_PAGE_LIMIT))

    def extract(self, *, data_b64: str, media_type: str) -> str:
        if media_type not in SUPPORTED_MEDIA_TYPES:
            raise DocumentExtractionError(f"Unsupported file type: {media_type}")
        if media_type == PDF_MEDIA_TYPE:
            data_b64 = _trim_pdf(data_b64, self._max_pdf_pages)
        try:
            response = self._client.messages.create(
                model=self._model,
                max_tokens=self._max_tokens,
                system=_SYSTEM,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            _content_block(data_b64, media_type),
                            {
                                "type": "text",
                                "text": "Transcribe the study material from this file.",
                            },
                        ],
                    }
                ],
            )
        except (
            anthropic.APIError
        ) as exc:  # network / auth / rate-limit / 5xx / bad file
            # Never surface the raw API error to the learner (it leaks request internals
            # and reads as a crash) — log it and return one plain, actionable line.
            logger.warning("document extraction API error: %s", exc)
            raise DocumentExtractionError(
                "We couldn't read that file. Try a shorter section or a clearer photo, "
                "or paste the text instead."
            ) from exc

        if response.stop_reason == "refusal":
            raise DocumentExtractionError("The model declined to read that file.")

        text = "".join(b.text for b in response.content if b.type == "text").strip()
        if not text or text == "NO_TEXT_FOUND":
            raise DocumentExtractionError(
                "No study text could be read from that file. Try a clearer photo, or "
                "paste the text instead."
            )
        return text


def get_document_extractor() -> ClaudeDocumentExtractor:
    """Return the active extractor, or raise if AI isn't configured.

    There is no offline path: without a model there is no way to read an arbitrary file,
    so the endpoint returns a clean error instead of pretending the upload worked.
    """
    api_key = current_app.config.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise DocumentExtractionError(
            "File upload needs AI to read the file. Paste the text instead, or "
            "configure an ANTHROPIC_API_KEY."
        )
    return ClaudeDocumentExtractor(
        api_key,
        current_app.config["ANTHROPIC_MODEL"],
        current_app.config.get("KNOWLEDGE_EXTRACT_MAX_TOKENS", 8000),
        current_app.config.get("KNOWLEDGE_PDF_MAX_PAGES", 20),
    )
