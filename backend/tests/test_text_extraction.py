"""Unit tests for app.text_extraction — HTML stripping, URL validation, and fetching.

fetch_url_text's network call is mocked at urllib.request.urlopen so these run with no
real network access.
"""

import urllib.error
from unittest.mock import MagicMock, patch

import pytest

from app.text_extraction import (
    FetchError,
    fetch_url_text,
    is_valid_http_url,
    normalize_whitespace,
    strip_html,
)


def test_strip_html_drops_script_and_style():
    html = (
        "<html><head><style>body{color:red}</style></head>"
        "<body><script>alert('x')</script><h1>Title</h1>"
        "<p>Hello <b>world</b>.</p></body></html>"
    )
    text = strip_html(html)
    assert "alert" not in text
    assert "color:red" not in text
    assert "Title" in text
    assert "Hello" in text and "world" in text


def test_normalize_whitespace_collapses_runs():
    assert normalize_whitespace("  a   b\n\nc\t d  ") == "a b c d"


@pytest.mark.parametrize(
    "url,expected",
    [
        ("https://example.com/article", True),
        ("http://example.com", True),
        ("ftp://example.com/file", False),
        ("not-a-url", False),
        ("javascript:alert(1)", False),
        ("", False),
    ],
)
def test_is_valid_http_url(url, expected):
    assert is_valid_http_url(url) is expected


def _fake_response(body: bytes, content_type="text/html", charset="utf-8"):
    resp = MagicMock()
    resp.__enter__.return_value = resp
    resp.__exit__.return_value = False
    resp.read.return_value = body
    resp.headers.get_content_type.return_value = content_type
    resp.headers.get_content_charset.return_value = charset
    return resp


def test_fetch_url_text_strips_and_returns_text():
    html = b"<html><body><script>evil()</script><p>Clean text.</p></body></html>"
    with patch("urllib.request.urlopen", return_value=_fake_response(html)):
        text = fetch_url_text("https://example.com", timeout=5, max_bytes=1000)
    assert text == "Clean text."


def test_fetch_url_text_rejects_non_text_content_type():
    with patch(
        "urllib.request.urlopen",
        return_value=_fake_response(b"\x89PNG", content_type="image/png"),
    ):
        with pytest.raises(FetchError):
            fetch_url_text("https://example.com/pic.png", timeout=5, max_bytes=1000)


def test_fetch_url_text_raises_on_empty_result():
    with patch(
        "urllib.request.urlopen",
        return_value=_fake_response(b"<html><body></body></html>"),
    ):
        with pytest.raises(FetchError):
            fetch_url_text("https://example.com/blank", timeout=5, max_bytes=1000)


def test_fetch_url_text_wraps_http_error():
    err = urllib.error.HTTPError(
        url="https://example.com", code=404, msg="Not Found", hdrs=None, fp=None
    )
    with patch("urllib.request.urlopen", side_effect=err):
        with pytest.raises(FetchError):
            fetch_url_text("https://example.com/missing", timeout=5, max_bytes=1000)


def test_fetch_url_text_wraps_url_error():
    err = urllib.error.URLError("connection refused")
    with patch("urllib.request.urlopen", side_effect=err):
        with pytest.raises(FetchError):
            fetch_url_text("https://example.com/down", timeout=5, max_bytes=1000)
