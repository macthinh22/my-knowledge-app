"""Gmail SMTP email service for sending review digest emails."""

import asyncio
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from functools import partial

from app.config import settings
from app.logging_config import get_logger
from app.models import Video


class EmailService:
    """Service for sending styled HTML review digest emails via Gmail SMTP."""

    def __init__(self) -> None:
        self.logger = get_logger(__name__)
        self.email_address = settings.email_address
        self.email_password = settings.email_password
        self.recipient_email = settings.recipient_email

    async def send_review_digest(self, videos: list[Video]) -> None:
        """Build and send a review digest email with the given videos.

        Args:
            videos: List of Video ORM models to include in the digest.

        Raises:
            RuntimeError: If email sending fails.
        """
        if not videos:
            self.logger.warning("No videos to send in review digest")
            return

        self.logger.info("Sending review digest with %d video(s)", len(videos))

        html_body = self._build_html(videos)

        msg = MIMEMultipart("alternative")
        msg["Subject"] = (
            f"🎓 Daily Knowledge Review — {len(videos)} video(s) to revisit"
        )
        msg["From"] = self.email_address
        msg["To"] = self.recipient_email
        msg.attach(MIMEText(html_body, "html"))

        # Run SMTP in a thread executor to avoid blocking the event loop
        try:
            loop = asyncio.get_running_loop()
            await loop.run_in_executor(None, partial(self._send_smtp, msg))
            self.logger.info("Review digest sent successfully")
        except Exception as exc:
            self.logger.error("Failed to send review digest: %s", exc)
            raise RuntimeError(f"Failed to send review digest: {exc}") from exc

    def _send_smtp(self, msg: MIMEMultipart) -> None:
        """Send the email via Gmail SMTP SSL (blocking)."""
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(self.email_address, self.email_password)
            server.send_message(msg)

    def _build_html(self, videos: list[Video]) -> str:
        """Generate a dark-themed HTML email body with video cards."""
        video_cards = "\n".join(self._build_card(v) for v in videos)

        return f"""\
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0; padding:0; background-color:#0f172a; font-family:'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px; margin:0 auto; padding:32px 16px;">

    <!-- Header -->
    <div style="text-align:center; margin-bottom:32px;">
      <h1 style="color:#e2e8f0; font-size:24px; margin:0 0 8px 0;">🎓 Knowledge Review</h1>
      <p style="color:#94a3b8; font-size:14px; margin:0;">
        Time to revisit what you've learned
      </p>
    </div>

    <!-- Video Cards -->
    {video_cards}

    <!-- Footer -->
    <div style="text-align:center; margin-top:32px; padding-top:24px; border-top:1px solid #1e293b;">
      <p style="color:#64748b; font-size:12px; margin:0;">
        YouTube Knowledge Extractor — Daily Digest
      </p>
    </div>

  </div>
</body>
</html>"""

    def _build_card(self, video: Video) -> str:
        """Build a single video card HTML block."""
        keywords_html = ""
        if video.keywords:
            badges = " ".join(
                f'<span style="display:inline-block; background:#1e293b; color:#818cf8; '
                f'font-size:11px; padding:3px 8px; border-radius:12px; margin:2px;">{kw}</span>'
                for kw in video.keywords[:6]
            )
            keywords_html = f'<div style="margin-top:12px;">{badges}</div>'

        overview_html = ""
        if video.overview:
            overview_html = (
                f'<p style="color:#cbd5e1; font-size:13px; line-height:1.5; margin:12px 0 0 0;">'
                f"{video.overview}</p>"
            )

        channel_html = ""
        if video.channel_name:
            channel_html = (
                f'<p style="color:#64748b; font-size:12px; margin:4px 0 0 0;">'
                f"{video.channel_name}</p>"
            )

        thumbnail_html = ""
        if video.thumbnail_url:
            thumbnail_html = (
                f'<img src="{video.thumbnail_url}" alt="{video.title}" '
                f'style="width:100%; border-radius:8px 8px 0 0; display:block;">'
            )

        return f"""\
    <div style="background:#1e293b; border-radius:12px; margin-bottom:20px; overflow:hidden; border:1px solid #334155;">
      {thumbnail_html}
      <div style="padding:16px 20px;">
        <a href="{video.youtube_url}" style="color:#e2e8f0; font-size:16px; font-weight:600; text-decoration:none; line-height:1.4;">
          {video.title or "Untitled Video"}
        </a>
        {channel_html}
        {overview_html}
        {keywords_html}
      </div>
    </div>"""
