"""APScheduler daily cron job for sending review digest emails."""

import random

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy import select

from app.config import settings
from app.database import async_session
from app.logging_config import get_logger
from app.models import Video
from app.services.email_service import EmailService

logger = get_logger(__name__)

_scheduler: AsyncIOScheduler | None = None


async def _send_daily_review() -> None:
    """Pick 1-3 random past entries and send a review digest email."""
    logger.info("Running daily review job...")

    try:
        async with async_session() as session:
            result = await session.execute(select(Video))
            all_videos = result.scalars().all()

        if not all_videos:
            logger.info("No videos in database — skipping review digest")
            return

        count = min(random.randint(1, 3), len(all_videos))
        selected = random.sample(list(all_videos), count)

        logger.info(
            "Selected %d video(s) for review: %s", count, [v.title for v in selected]
        )

        email_service = EmailService()
        await email_service.send_review_digest(selected)

    except Exception as exc:
        logger.error("Daily review job failed: %s", exc)


def start_scheduler() -> None:
    """Create and start the APScheduler with the daily review cron job."""
    global _scheduler

    _scheduler = AsyncIOScheduler()
    _scheduler.add_job(
        _send_daily_review,
        trigger=CronTrigger(hour=settings.review_email_hour, minute=0),
        id="daily_review",
        name="Daily Knowledge Review Digest",
        replace_existing=True,
    )
    _scheduler.start()

    logger.info(
        "Scheduler started — daily review at %02d:00", settings.review_email_hour
    )


def stop_scheduler() -> None:
    """Shut down the scheduler gracefully."""
    global _scheduler

    if _scheduler:
        _scheduler.shutdown(wait=False)
        _scheduler = None
        logger.info("Scheduler stopped")
