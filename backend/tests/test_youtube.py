"""Tests for YouTubeService.extract_youtube_id."""

import pytest

from app.services.youtube import YouTubeService


class TestExtractYouTubeId:
    """Tests for extract_youtube_id covering all supported URL formats."""

    def setup_method(self):
        self.service = YouTubeService()

    # --- Valid URLs ---

    def test_standard_watch_url(self):
        url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
        assert self.service.extract_youtube_id(url) == "dQw4w9WgXcQ"

    def test_standard_watch_url_no_www(self):
        url = "https://youtube.com/watch?v=dQw4w9WgXcQ"
        assert self.service.extract_youtube_id(url) == "dQw4w9WgXcQ"

    def test_short_url(self):
        url = "https://youtu.be/dQw4w9WgXcQ"
        assert self.service.extract_youtube_id(url) == "dQw4w9WgXcQ"

    def test_embed_url(self):
        url = "https://www.youtube.com/embed/dQw4w9WgXcQ"
        assert self.service.extract_youtube_id(url) == "dQw4w9WgXcQ"

    def test_shorts_url(self):
        url = "https://www.youtube.com/shorts/dQw4w9WgXcQ"
        assert self.service.extract_youtube_id(url) == "dQw4w9WgXcQ"

    def test_live_url(self):
        url = "https://www.youtube.com/live/dQw4w9WgXcQ"
        assert self.service.extract_youtube_id(url) == "dQw4w9WgXcQ"

    def test_mobile_url(self):
        url = "https://m.youtube.com/watch?v=dQw4w9WgXcQ"
        assert self.service.extract_youtube_id(url) == "dQw4w9WgXcQ"

    def test_url_with_playlist_and_timestamp(self):
        url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf&t=42"
        assert self.service.extract_youtube_id(url) == "dQw4w9WgXcQ"

    def test_url_with_extra_params_before_v(self):
        url = "https://www.youtube.com/watch?feature=share&v=dQw4w9WgXcQ"
        assert self.service.extract_youtube_id(url) == "dQw4w9WgXcQ"

    def test_http_url(self):
        url = "http://www.youtube.com/watch?v=dQw4w9WgXcQ"
        assert self.service.extract_youtube_id(url) == "dQw4w9WgXcQ"

    def test_short_url_with_timestamp(self):
        url = "https://youtu.be/dQw4w9WgXcQ?t=120"
        assert self.service.extract_youtube_id(url) == "dQw4w9WgXcQ"

    def test_url_with_whitespace(self):
        url = "  https://youtu.be/dQw4w9WgXcQ  "
        assert self.service.extract_youtube_id(url) == "dQw4w9WgXcQ"

    def test_id_with_hyphens_and_underscores(self):
        url = "https://youtu.be/a-B_c1D2e3F"
        assert self.service.extract_youtube_id(url) == "a-B_c1D2e3F"

    # --- Invalid URLs ---

    def test_empty_string_raises(self):
        with pytest.raises(ValueError, match="Could not extract"):
            self.service.extract_youtube_id("")

    def test_random_string_raises(self):
        with pytest.raises(ValueError, match="Could not extract"):
            self.service.extract_youtube_id("not-a-url-at-all")

    def test_non_youtube_url_raises(self):
        with pytest.raises(ValueError, match="Could not extract"):
            self.service.extract_youtube_id("https://www.vimeo.com/12345678")

    def test_youtube_url_without_video_id_raises(self):
        with pytest.raises(ValueError, match="Could not extract"):
            self.service.extract_youtube_id("https://www.youtube.com/")

    def test_youtube_channel_url_raises(self):
        with pytest.raises(ValueError, match="Could not extract"):
            self.service.extract_youtube_id("https://www.youtube.com/channel/UCxxxxxxx")
