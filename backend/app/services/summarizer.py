"""GPT-powered knowledge analysis service for video transcripts."""

from dataclasses import dataclass

from openai import AsyncOpenAI
from pydantic import BaseModel, Field

from app.config import settings
from app.logging_config import get_logger

# ---------------------------------------------------------------------------
# Structured output schema for OpenAI response_format
# ---------------------------------------------------------------------------


class _KnowledgeSchema(BaseModel):
    """Pydantic model used as OpenAI structured output format."""

    explanation: str = Field(
        description=(
            "A clear, mentor-like re-explanation of the content with explicit logical flow. "
            "Use plain language to make complex ideas accessible, while preserving technical accuracy."
        )
    )
    key_knowledge: str = Field(
        description=(
            "A concise summary highlighting the most important knowledge points from the video. "
            "Combine a brief overview with the key insights, core principles, and essential takeaways "
            "that the viewer should remember."
        )
    )
    critical_analysis: str = Field(
        description=(
            "An objective analysis of the strengths and weaknesses of the ideas presented. "
            "Strengths: what the concept does well and why it is compelling. "
            "Weaknesses: limitations, hidden assumptions, edge cases, or gaps in the argument."
        )
    )
    real_world_applications: str = Field(
        description=(
            "Concrete examples of how the knowledge can be applied in practice. "
            "Connect ideas to real domains, industries, or personal contexts."
        )
    )
    keywords: list[str] = Field(
        description="5-10 lowercase descriptive tags for search and categorization."
    )


@dataclass(frozen=True)
class KnowledgeResult:
    """Immutable result from the knowledge analysis pipeline."""

    explanation: str
    key_knowledge: str
    critical_analysis: str
    real_world_applications: str
    keywords: list[str]


# ---------------------------------------------------------------------------
# System prompt
# ---------------------------------------------------------------------------

_SYSTEM_PROMPT = """\
You are a knowledgeable mentor and critical thinker. Your job is to take a video transcript \
and transform it into a deep, structured knowledge analysis — not a summary. \
Your goal is to help the viewer truly understand, evaluate, and apply what they watched.

Adopt a tone that is between conversational and technical: clear and accessible, \
but precise and intellectually rigorous. Think of how a great professor explains things.

**IMPORTANT: You MUST write ALL output content in Vietnamese (Tiếng Việt). \
This includes explanation, critical_analysis, real_world_applications, and keywords. \
Even if the original video is in English or another language, your output must be entirely in Vietnamese.**

## Output Requirements

### explanation
- Re-explain the content as if you are teaching it from scratch to an intelligent student.
- Use a clear cause-and-effect or step-by-step logical flow.
- Break down jargon. Use analogies where helpful.
- Preserve technical accuracy — don't oversimplify formulas, code, or precise definitions.
- Write in Markdown with sections and bullet points.

### key_knowledge
- Write a concise summary that captures the most important knowledge from the video.
- Highlight key insights, core principles, essential takeaways, and critical facts.
- Use Markdown bullet points. Each point should be a standalone piece of knowledge worth remembering.
- Aim for 5-8 bullet points that together form a complete picture of what matters most.

### critical_analysis
- Analyze the **strengths** of the ideas: why they are compelling, well-founded, or innovative.
- Analyze the **weaknesses**: limitations, assumptions that may not hold, missing context, \
  counterarguments, or edge cases the video ignores.
- Be objective and specific — cite the actual ideas from the video, not vague generalities.
- Write in Markdown with clearly labeled Strengths and Weaknesses sections.

### real_world_applications
- Give 3-5 concrete examples of how this knowledge can be applied in practice.
- Connect ideas to real domains: industry, research, daily life, or adjacent fields.
- For each application, explain briefly *why* this knowledge is relevant there.
- Write in Markdown with a bullet list or numbered examples.

### keywords
- Generate 5-10 lowercase tags relevant to the video's content.
- Include the main topic, technologies, concepts, and domain.
- Example: ["python", "lập trình bất đồng bộ", "event loop", "đồng thời", "backend"]
"""


# ---------------------------------------------------------------------------
# SummarizerService
# ---------------------------------------------------------------------------


class SummarizerService:
    """Service for analyzing video transcripts using OpenAI GPT."""

    def __init__(self) -> None:
        self.logger = get_logger(__name__)
        self.client = AsyncOpenAI(api_key=settings.openai_api_key)

    async def analyze(self, transcript: str, title: str) -> KnowledgeResult:
        """Analyze a video transcript into structured knowledge sections.

        Args:
            transcript: The full transcript text.
            title: The video title (provides context to the model).

        Returns:
            A KnowledgeResult with explanation, critical_analysis,
            real_world_applications, and keywords.

        Raises:
            RuntimeError: If the OpenAI API call fails.
        """
        self.logger.info(
            "Analyzing transcript for '%s' (%d chars)", title, len(transcript)
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
                response_format=_KnowledgeSchema,
            )

            parsed = response.choices[0].message.parsed

            if parsed is None:
                raise RuntimeError(
                    "OpenAI returned no parsed content — possible refusal or empty response."
                )

            result = KnowledgeResult(
                explanation=parsed.explanation,
                key_knowledge=parsed.key_knowledge,
                critical_analysis=parsed.critical_analysis,
                real_world_applications=parsed.real_world_applications,
                keywords=parsed.keywords,
            )

            self.logger.info(
                "Analysis complete — explanation=%d chars, keywords=%s",
                len(result.explanation),
                result.keywords,
            )
            return result

        except RuntimeError:
            raise
        except Exception as exc:
            self.logger.error("Analysis failed for '%s': %s", title, exc)
            raise RuntimeError(f"Analysis failed: {exc}") from exc
