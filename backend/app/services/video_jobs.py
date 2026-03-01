import uuid

from sqlalchemy import select

from app.database import async_session
from app.logging_config import get_logger
from app.models import Video, VideoJob
from app.services.summarizer import SummarizerService
from app.services.tags import canonicalize_keywords
from app.services.transcription import TranscriptionService
from app.services.youtube import TranscriptNotAvailableError, YouTubeService


JOB_STEPS = [
    "Fetching video information",
    "Transcribing content",
    "Analyzing knowledge",
    "Saving results",
]

ACTIVE_JOB_STATUSES = {"queued", "processing"}
TERMINAL_JOB_STATUSES = {"completed", "failed"}

logger = get_logger(__name__)

youtube_service = YouTubeService()
summarizer_service = SummarizerService()
transcription_service = TranscriptionService()


async def run_video_job(job_id: uuid.UUID) -> None:
    async with async_session() as db:
        job = await db.get(VideoJob, job_id)
        if not job or job.status in TERMINAL_JOB_STATUSES:
            return

        try:
            await _set_job_state(
                db,
                job,
                status="processing",
                current_step=0,
                step_label=JOB_STEPS[0],
                error_message=None,
            )

            metadata = await youtube_service.fetch_metadata(job.youtube_id)

            await _set_job_state(
                db,
                job,
                status="processing",
                current_step=1,
                step_label=JOB_STEPS[1],
            )

            try:
                transcript, transcript_source = await youtube_service.fetch_transcript(
                    job.youtube_id
                )
            except TranscriptNotAvailableError:
                (
                    transcript,
                    transcript_source,
                ) = await transcription_service.transcribe_with_whisper(job.youtube_id)

            await _set_job_state(
                db,
                job,
                status="processing",
                current_step=2,
                step_label=JOB_STEPS[2],
            )

            analysis = await summarizer_service.analyze(transcript, metadata.title)
            canonical_keywords = await canonicalize_keywords(db, analysis.keywords)

            await _set_job_state(
                db,
                job,
                status="processing",
                current_step=3,
                step_label=JOB_STEPS[3],
            )

            existing = await db.execute(
                select(Video).where(Video.youtube_id == job.youtube_id)
            )
            video = existing.scalar_one_or_none()

            if video is None:
                video = Video(
                    youtube_url=job.youtube_url,
                    youtube_id=job.youtube_id,
                    title=metadata.title,
                    thumbnail_url=metadata.thumbnail_url,
                    channel_name=metadata.channel_name,
                    duration=metadata.duration,
                    explanation=analysis.explanation,
                    key_knowledge=analysis.key_knowledge,
                    critical_analysis=analysis.critical_analysis,
                    real_world_applications=analysis.real_world_applications,
                    keywords=canonical_keywords,
                    transcript_source=transcript_source,
                )
                db.add(video)
                await db.flush()
                await db.refresh(video)
            else:
                video.keywords = canonical_keywords

            await _set_job_state(
                db,
                job,
                status="completed",
                current_step=len(JOB_STEPS) - 1,
                step_label=JOB_STEPS[-1],
                video_id=video.id,
                error_message=None,
            )

            logger.info("Video job completed: %s", job_id)
        except Exception as exc:
            logger.exception("Video job failed: %s", job_id)
            await _set_job_state(
                db,
                job,
                status="failed",
                step_label="Failed",
                error_message=str(exc),
            )


async def _set_job_state(
    db,
    job: VideoJob,
    *,
    status: str,
    current_step: int | None = None,
    step_label: str | None = None,
    error_message: str | None = None,
    video_id: uuid.UUID | None = None,
) -> None:
    job.status = status
    if current_step is not None:
        job.current_step = current_step
    if step_label is not None:
        job.step_label = step_label
    job.error_message = error_message
    if video_id is not None:
        job.video_id = video_id
    await db.flush()
    await db.commit()
    await db.refresh(job)
