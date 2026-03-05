from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.services.summarizer import SummarizerService


@pytest.mark.asyncio
async def test_analyze_accepts_categories_and_returns_category_slug():
    service = object.__new__(SummarizerService)
    service.logger = MagicMock()

    parsed = SimpleNamespace(
        explanation="exp",
        key_knowledge="key",
        critical_analysis="crit",
        real_world_applications="apps",
        keywords=["python"],
        category="technology",
    )
    parse_mock = AsyncMock(
        return_value=SimpleNamespace(
            choices=[SimpleNamespace(message=SimpleNamespace(parsed=parsed))]
        )
    )

    service.client = SimpleNamespace(
        beta=SimpleNamespace(
            chat=SimpleNamespace(completions=SimpleNamespace(parse=parse_mock))
        )
    )

    result = await SummarizerService.analyze(
        service,
        transcript="sample transcript",
        title="sample title",
        categories=[{"slug": "technology", "name": "Technology"}],
    )

    assert result.category == "technology"

    call_kwargs = parse_mock.await_args.kwargs
    assert "technology" in call_kwargs["messages"][0]["content"]


@pytest.mark.asyncio
async def test_analyze_requests_up_to_five_keywords_without_forcing_five():
    service = object.__new__(SummarizerService)
    service.logger = MagicMock()

    parsed = SimpleNamespace(
        explanation="exp",
        key_knowledge="key",
        critical_analysis="crit",
        real_world_applications="apps",
        keywords=["python"],
        category="technology",
    )
    parse_mock = AsyncMock(
        return_value=SimpleNamespace(
            choices=[SimpleNamespace(message=SimpleNamespace(parsed=parsed))]
        )
    )

    service.client = SimpleNamespace(
        beta=SimpleNamespace(
            chat=SimpleNamespace(completions=SimpleNamespace(parse=parse_mock))
        )
    )

    await SummarizerService.analyze(
        service,
        transcript="sample transcript",
        title="sample title",
        categories=[{"slug": "technology", "name": "Technology"}],
    )

    system_prompt = parse_mock.await_args.kwargs["messages"][0]["content"]
    assert (
        "Generate 1-5 lowercase tags relevant to the video's content." in system_prompt
    )
    assert "Do not force exactly 5 tags" in system_prompt
