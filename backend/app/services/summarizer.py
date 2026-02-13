"""GPT-powered summarization service for video transcripts."""

from dataclasses import dataclass

from openai import AsyncOpenAI
from pydantic import BaseModel, Field

from app.config import settings
from app.logging_config import get_logger

# ---------------------------------------------------------------------------
# Structured output schema for OpenAI response_format
# ---------------------------------------------------------------------------


class _SummarySchema(BaseModel):
    """Pydantic model used as OpenAI structured output format."""

    overview: str = Field(
        description="A concise 2-3 sentence overview of the video's main topic and purpose."
    )
    detailed_summary: str = Field(
        description="A section-by-section Markdown breakdown following the video's flow."
    )
    key_takeaways: str = Field(
        description="Bullet-point Markdown list of actionable insights worth remembering."
    )
    keywords: list[str] = Field(
        description="5-10 descriptive tags for search and categorization."
    )


@dataclass(frozen=True)
class SummaryResult:
    """Immutable result from the summarization pipeline."""

    overview: str
    detailed_summary: str
    key_takeaways: str
    keywords: list[str]


# ---------------------------------------------------------------------------
# System prompt
# ---------------------------------------------------------------------------

_SYSTEM_PROMPT = """\
You are a knowledge extraction expert. Your job is to transform a video transcript \
into a structured, high-quality summary that helps the user learn and review the content later.

## Output Requirements

### overview
- Write 2-3 sentences that capture the video's main topic, who it's for, and the core value.
- Be specific — mention the subject matter, not just "this video discusses…".

### detailed_summary
- Write in Markdown with `##` section headers that follow the video's natural flow.
- Under each section, use bullet points for key points, examples, and explanations.
- Preserve important details, code snippets, formulas, or specific advice.
- Aim for depth — this should be useful as a standalone study reference.

### key_takeaways
- Write 4-8 bullet points using Markdown (`-` list).
- Focus on actionable insights, surprising facts, or core principles.
- Each point should stand alone and be meaningful without the full context.

### keywords
- Generate 5-10 lowercase tags relevant to the video's content.
- Include the main topic, technologies, concepts, and domain.
- Example: ["python", "web scraping", "beautifulsoup", "data extraction", "tutorial"]
"""


# ---------------------------------------------------------------------------
# SummarizerService
# ---------------------------------------------------------------------------


class SummarizerService:
    """Service for summarizing video transcripts using OpenAI GPT."""

    def __init__(self) -> None:
        self.logger = get_logger(__name__)
        self.client = AsyncOpenAI(api_key=settings.openai_api_key)

    async def summarize(self, transcript: str, title: str) -> SummaryResult:
        """Summarize a video transcript into structured sections.

        Args:
            transcript: The full transcript text.
            title: The video title (provides context to the model).

        Returns:
            A SummaryResult with overview, detailed_summary, key_takeaways, and keywords.

        Raises:
            RuntimeError: If the OpenAI API call fails.
        """
        self.logger.info(
            "Summarizing transcript for '%s' (%d chars)", title, len(transcript)
        )

        user_message = f"## Video Title\n{title}\n\n## Transcript\n{transcript}"

        try:
            response = await self.client.beta.chat.completions.parse(
                model="gpt-5.2",
                temperature=0.3,
                messages=[
                    {"role": "system", "content": _SYSTEM_PROMPT},
                    {"role": "user", "content": user_message},
                ],
                response_format=_SummarySchema,
            )

            parsed = response.choices[0].message.parsed

            if parsed is None:
                raise RuntimeError(
                    "OpenAI returned no parsed content — possible refusal or empty response."
                )

            result = SummaryResult(
                overview=parsed.overview,
                detailed_summary=parsed.detailed_summary,
                key_takeaways=parsed.key_takeaways,
                keywords=parsed.keywords,
            )

            self.logger.info(
                "Summary complete — overview=%d chars, detailed=%d chars, keywords=%s",
                len(result.overview),
                len(result.detailed_summary),
                result.keywords,
            )
            return result

        except RuntimeError:
            raise
        except Exception as exc:
            self.logger.error("Summarization failed for '%s': %s", title, exc)
            raise RuntimeError(f"Summarization failed: {exc}") from exc
