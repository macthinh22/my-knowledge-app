"""Whisper-based fallback transcription for videos without captions."""

import tempfile
from pathlib import Path

import yt_dlp
import httpx
from openai import AsyncOpenAI
from pydub import AudioSegment

from app.config import settings
from app.logging_config import get_logger

# Whisper API hard limit
_WHISPER_MAX_MB = 25
# Target chunk size — kept under the limit with headroom
_CHUNK_TARGET_MB = 20


class TranscriptionService:
    """Service for Whisper-based fallback transcription."""

    def __init__(self) -> None:
        self.logger = get_logger(__name__)
        self.client = AsyncOpenAI(
            api_key=settings.openai_api_key,
            timeout=httpx.Timeout(300.0, connect=10.0),  # 5 min for large uploads
        )

    async def transcribe_with_whisper(self, youtube_id: str) -> tuple[str, str]:
        """Download audio via yt-dlp and transcribe with OpenAI Whisper API.

        This is the fallback path — used only when youtube-transcript-api
        finds no captions for the video.

        For audio files exceeding the 25 MB Whisper API limit the file is
        split into chunks and each chunk is transcribed separately before
        the results are joined.

        Args:
            youtube_id: The 11-character YouTube video ID.

        Returns:
            A tuple of (transcript_text, ``"whisper"``).

        Raises:
            RuntimeError: If audio download or transcription fails.
        """
        video_url = f"https://www.youtube.com/watch?v={youtube_id}"

        try:
            self.logger.info(
                "Downloading audio for Whisper transcription: %s", youtube_id
            )

            with tempfile.TemporaryDirectory() as tmp_dir:
                output_template = str(Path(tmp_dir) / "%(id)s.%(ext)s")

                ydl_opts = {
                    "format": "bestaudio/best",
                    "quiet": True,
                    "no_warnings": True,
                    "outtmpl": output_template,
                    "postprocessors": [
                        {
                            "key": "FFmpegExtractAudio",
                            "preferredcodec": "mp3",
                            "preferredquality": "128",
                        }
                    ],
                }

                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    ydl.download([video_url])

                audio_files = list(Path(tmp_dir).glob("*.mp3"))
                if not audio_files:
                    raise RuntimeError(
                        f"Audio download produced no mp3 file for video: {youtube_id}"
                    )

                audio_path = audio_files[0]
                file_size_mb = audio_path.stat().st_size / (1024 * 1024)
                self.logger.info(
                    "Audio downloaded: %s (%.1f MB)", audio_path.name, file_size_mb
                )

                if file_size_mb > _WHISPER_MAX_MB:
                    transcript_text = await self._transcribe_in_chunks(
                        audio_path, file_size_mb, tmp_dir
                    )
                else:
                    transcript_text = await self._transcribe_file(audio_path)

                if not transcript_text:
                    raise RuntimeError(
                        f"Whisper returned empty transcription for video: {youtube_id}"
                    )

                self.logger.info(
                    "Whisper transcription complete — %d characters",
                    len(transcript_text),
                )
                return transcript_text, "whisper"

        except RuntimeError:
            raise
        except Exception as exc:
            self.logger.error(
                "Whisper transcription failed for %s: %s", youtube_id, exc
            )
            raise RuntimeError(
                f"Whisper transcription failed for video {youtube_id}: {exc}"
            ) from exc

    async def _transcribe_file(self, audio_path: Path) -> str:
        """Send a single audio file to the Whisper API and return the text."""
        with open(audio_path, "rb") as audio_file:
            transcription = await self.client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file,
                response_format="text",
            )
        return str(transcription).strip()

    async def _transcribe_in_chunks(
        self, audio_path: Path, file_size_mb: float, tmp_dir: str
    ) -> str:
        """Split the audio into chunks and transcribe each one.

        Args:
            audio_path: Path to the full MP3 file.
            file_size_mb: Known size of the file in MB.
            tmp_dir: Temporary directory to write chunk files into.

        Returns:
            Combined transcript text from all chunks.
        """
        num_chunks = int(file_size_mb / _CHUNK_TARGET_MB) + 1
        self.logger.info(
            "File is %.1f MB — splitting into %d chunks for Whisper",
            file_size_mb,
            num_chunks,
        )

        audio = AudioSegment.from_mp3(audio_path)
        chunk_duration_ms = len(audio) // num_chunks

        parts: list[str] = []
        for i in range(num_chunks):
            start_ms = i * chunk_duration_ms
            # Last chunk takes whatever remains
            end_ms = len(audio) if i == num_chunks - 1 else start_ms + chunk_duration_ms

            chunk = audio[start_ms:end_ms]
            chunk_path = Path(tmp_dir) / f"chunk_{i}.mp3"
            chunk.export(chunk_path, format="mp3")

            chunk_size_mb = chunk_path.stat().st_size / (1024 * 1024)
            self.logger.info(
                "Transcribing chunk %d/%d (%.1f MB)...", i + 1, num_chunks, chunk_size_mb
            )

            part = await self._transcribe_file(chunk_path)
            parts.append(part)

        return " ".join(parts)
