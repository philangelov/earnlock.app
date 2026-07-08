"""Fetch a URL and reduce it to plain text, for Knowledge Import (api-contract.md §4).

POST /knowledge/import does the scraping server-side so the client never has to (issue
#12): download the page (bounded time + bytes), strip markup down to visible text, then
the same whitespace-normalize/length-cap step in routes/knowledge.py runs for pasted
text and fetched links alike, so /quiz/generate's "material_text" never sees raw HTML.
"""

import re
import urllib.error
import urllib.parse
import urllib.request
from html.parser import HTMLParser

_SKIP_TAGS = {"script", "style", "noscript", "svg", "template"}


class FetchError(Exception):
    """Raised when a URL can't be fetched or doesn't yield readable text."""


class _TextExtractor(HTMLParser):
    def __init__(self):
        super().__init__()
        self._skip_depth = 0
        self.chunks = []

    def handle_starttag(self, tag, attrs):
        if tag in _SKIP_TAGS:
            self._skip_depth += 1

    def handle_endtag(self, tag):
        if tag in _SKIP_TAGS and self._skip_depth:
            self._skip_depth -= 1

    def handle_data(self, data):
        if not self._skip_depth and data.strip():
            self.chunks.append(data)


def strip_html(html: str) -> str:
    """Reduce an HTML document to its visible text (drops script/style/etc.)."""
    parser = _TextExtractor()
    parser.feed(html)
    parser.close()
    return " ".join(parser.chunks)


def normalize_whitespace(text: str) -> str:
    """Collapse any run of whitespace (including newlines) to a single space."""
    return re.sub(r"\s+", " ", text).strip()


def is_valid_http_url(url: str) -> bool:
    try:
        parsed = urllib.parse.urlparse(url)
    except ValueError:
        return False
    return parsed.scheme in ("http", "https") and bool(parsed.netloc)


def fetch_url_text(url: str, *, timeout: float, max_bytes: int) -> str:
    """Download a URL and return its sanitized plain text, or raise FetchError."""
    req = urllib.request.Request(url, headers={"User-Agent": "EarnLockBot/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as res:
            content_type = res.headers.get_content_type()
            if content_type and not content_type.startswith("text/"):
                raise FetchError(f"Unsupported content type: {content_type}")
            charset = res.headers.get_content_charset() or "utf-8"
            raw = res.read(max_bytes)
    except urllib.error.HTTPError as e:
        raise FetchError(f"Fetch failed ({e.code}).") from e
    except urllib.error.URLError as e:
        raise FetchError(f"Fetch failed: {e.reason}") from e
    except TimeoutError as e:
        raise FetchError("Fetch timed out.") from e

    try:
        html = raw.decode(charset, errors="replace")
    except LookupError:
        html = raw.decode("utf-8", errors="replace")

    text = strip_html(html)
    if not text.strip():
        raise FetchError("No readable text found at that URL.")
    return text
