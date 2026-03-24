"""Tests for the three search providers: Arxiv, OpenAlex, SemanticScholar."""

from __future__ import annotations

import httpx
import pytest
import respx

from analyst_mcp.config import Settings
from analyst_mcp.models import PaperRecord
from analyst_mcp.providers import ArxivProvider, OpenAlexProvider, SemanticScholarProvider


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture()
def settings(tmp_path) -> Settings:
    return Settings(
        api_key="test-key",
        contact_email="test@example.com",
        data_dir=tmp_path / "data",
        storage_root=tmp_path / "articles",
        index_root=tmp_path / "indexes",
        raw_root=tmp_path / "raw",
        postgres_dsn=None,
        semantic_scholar_api_key=None,
        openalex_api_key=None,
    )


ARXIV_XML_RESPONSE = """\
<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom"
      xmlns:arxiv="http://arxiv.org/schemas/atom">
  <entry>
    <id>http://arxiv.org/abs/2401.00001v1</id>
    <title>Test Paper on Machine Learning</title>
    <summary>This paper explores novel approaches to ML.</summary>
    <published>2024-01-15T00:00:00Z</published>
    <updated>2024-01-16T00:00:00Z</updated>
    <author><name>Jane Doe</name></author>
    <author><name>John Smith</name></author>
    <category term="cs.LG"/>
    <link href="http://arxiv.org/abs/2401.00001v1"/>
    <link href="http://arxiv.org/pdf/2401.00001v1" title="pdf"/>
    <arxiv:doi>10.1234/test.2024</arxiv:doi>
  </entry>
</feed>
"""

OPENALEX_JSON_RESPONSE = {
    "results": [
        {
            "id": "https://openalex.org/W1234567890",
            "doi": "https://doi.org/10.5555/example",
            "display_name": "OpenAlex Test Paper",
            "abstract": "An abstract from OpenAlex.",
            "publication_date": "2024-03-01",
            "updated_date": "2024-03-02T00:00:00Z",
            "cited_by_count": 42,
            "referenced_works_count": 15,
            "authorships": [
                {
                    "author": {"display_name": "Alice Researcher"},
                    "institutions": [{"display_name": "MIT"}],
                }
            ],
            "concepts": [{"display_name": "Artificial Intelligence"}],
            "primary_location": {"source": {"display_name": "Nature"}},
            "open_access": {"is_oa": True, "oa_url": "https://example.com/paper.pdf"},
        }
    ],
    "meta": {"next_cursor": None},
}

SEMANTIC_SCHOLAR_JSON_RESPONSE = {
    "data": [
        {
            "paperId": "abc123def456",
            "title": "Semantic Scholar Test Paper",
            "abstract": "A test abstract from S2.",
            "year": 2024,
            "publicationDate": "2024-02-10",
            "citationCount": 7,
            "referenceCount": 20,
            "venue": "ICML",
            "url": "https://www.semanticscholar.org/paper/abc123def456",
            "authors": [
                {"name": "Bob Scientist", "authorId": "12345"}
            ],
            "externalIds": {"DOI": "10.9999/s2test"},
            "openAccessPdf": {"url": "https://example.com/s2paper.pdf"},
            "fieldsOfStudy": ["Computer Science"],
            "publicationVenue": {"name": "ICML"},
        }
    ]
}


# ---------------------------------------------------------------------------
# ArxivProvider
# ---------------------------------------------------------------------------

class TestArxivProvider:
    @respx.mock
    async def test_search_returns_paper_records(self, settings):
        respx.get(settings.arxiv_base_url).respond(200, text=ARXIV_XML_RESPONSE)
        async with httpx.AsyncClient() as client:
            provider = ArxivProvider(settings, client)
            results = await provider.search("machine learning", limit=10)

        assert len(results) == 1
        paper = results[0]
        assert isinstance(paper, PaperRecord)
        assert paper.provider == "arxiv"
        assert paper.title == "Test Paper on Machine Learning"
        assert paper.abstract == "This paper explores novel approaches to ML."
        assert paper.doi == "10.1234/test.2024"
        assert len(paper.authors) == 2
        assert paper.authors[0].name == "Jane Doe"
        assert paper.venue == "arXiv"
        assert paper.pdf_url == "http://arxiv.org/pdf/2401.00001v1"
        assert "cs.LG" in paper.topics

    @respx.mock
    async def test_search_empty_feed(self, settings):
        empty_xml = '<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"></feed>'
        respx.get(settings.arxiv_base_url).respond(200, text=empty_xml)
        async with httpx.AsyncClient() as client:
            provider = ArxivProvider(settings, client)
            results = await provider.search("nonexistent topic", limit=5)

        assert results == []

    @respx.mock
    async def test_search_http_error(self, settings):
        respx.get(settings.arxiv_base_url).respond(503)
        async with httpx.AsyncClient() as client:
            provider = ArxivProvider(settings, client)
            with pytest.raises(httpx.HTTPStatusError):
                await provider.search("test", limit=5)

    @respx.mock
    async def test_get_paper(self, settings):
        respx.get(settings.arxiv_base_url).respond(200, text=ARXIV_XML_RESPONSE)
        async with httpx.AsyncClient() as client:
            provider = ArxivProvider(settings, client)
            paper = await provider.get_paper("2401.00001v1")

        assert paper is not None
        assert paper.title == "Test Paper on Machine Learning"


# ---------------------------------------------------------------------------
# OpenAlexProvider
# ---------------------------------------------------------------------------

class TestOpenAlexProvider:
    @respx.mock
    async def test_search_returns_paper_records(self, settings):
        respx.get(f"{settings.openalex_base_url}/works").respond(200, json=OPENALEX_JSON_RESPONSE)
        async with httpx.AsyncClient() as client:
            provider = OpenAlexProvider(settings, client)
            results = await provider.search("artificial intelligence", limit=10)

        assert len(results) == 1
        paper = results[0]
        assert isinstance(paper, PaperRecord)
        assert paper.provider == "openalex"
        assert paper.title == "OpenAlex Test Paper"
        assert paper.doi == "10.5555/example"
        assert paper.citation_count == 42
        assert paper.reference_count == 15
        assert paper.venue == "Nature"
        assert len(paper.authors) == 1
        assert paper.authors[0].name == "Alice Researcher"
        assert paper.authors[0].affiliation == "MIT"
        assert paper.pdf_url == "https://example.com/paper.pdf"

    @respx.mock
    async def test_search_empty_results(self, settings):
        respx.get(f"{settings.openalex_base_url}/works").respond(200, json={"results": [], "meta": {}})
        async with httpx.AsyncClient() as client:
            provider = OpenAlexProvider(settings, client)
            results = await provider.search("nothing", limit=5)

        assert results == []

    @respx.mock
    async def test_search_http_error(self, settings):
        respx.get(f"{settings.openalex_base_url}/works").respond(500)
        async with httpx.AsyncClient() as client:
            provider = OpenAlexProvider(settings, client)
            with pytest.raises(httpx.HTTPStatusError):
                await provider.search("test", limit=5)

    @respx.mock
    async def test_get_paper(self, settings):
        single_work = OPENALEX_JSON_RESPONSE["results"][0]
        respx.get(url__regex=rf".*/works/.+").respond(200, json=single_work)
        async with httpx.AsyncClient() as client:
            provider = OpenAlexProvider(settings, client)
            paper = await provider.get_paper("W1234567890")

        assert paper is not None
        assert paper.title == "OpenAlex Test Paper"

    @respx.mock
    async def test_inverted_index_abstract(self, settings):
        response_with_inverted = {
            "results": [
                {
                    **OPENALEX_JSON_RESPONSE["results"][0],
                    "abstract": None,
                    "abstract_inverted_index": {"hello": [0], "world": [1]},
                }
            ],
            "meta": {"next_cursor": None},
        }
        respx.get(f"{settings.openalex_base_url}/works").respond(200, json=response_with_inverted)
        async with httpx.AsyncClient() as client:
            provider = OpenAlexProvider(settings, client)
            results = await provider.search("test", limit=5)

        assert results[0].abstract == "hello world"


# ---------------------------------------------------------------------------
# SemanticScholarProvider
# ---------------------------------------------------------------------------

class TestSemanticScholarProvider:
    @respx.mock
    async def test_search_returns_paper_records(self, settings):
        respx.get(f"{settings.semantic_scholar_base_url}/paper/search").respond(
            200, json=SEMANTIC_SCHOLAR_JSON_RESPONSE
        )
        async with httpx.AsyncClient() as client:
            provider = SemanticScholarProvider(settings, client)
            results = await provider.search("deep learning", limit=10)

        assert len(results) == 1
        paper = results[0]
        assert isinstance(paper, PaperRecord)
        assert paper.provider == "semantic_scholar"
        assert paper.title == "Semantic Scholar Test Paper"
        assert paper.abstract == "A test abstract from S2."
        assert paper.doi == "10.9999/s2test"
        assert paper.citation_count == 7
        assert paper.reference_count == 20
        assert paper.venue == "ICML"
        assert len(paper.authors) == 1
        assert paper.authors[0].name == "Bob Scientist"
        assert paper.authors[0].author_id == "12345"
        assert paper.pdf_url == "https://example.com/s2paper.pdf"

    @respx.mock
    async def test_search_empty_data(self, settings):
        respx.get(f"{settings.semantic_scholar_base_url}/paper/search").respond(200, json={"data": []})
        async with httpx.AsyncClient() as client:
            provider = SemanticScholarProvider(settings, client)
            results = await provider.search("nothing", limit=5)

        assert results == []

    @respx.mock
    async def test_search_http_error(self, settings):
        respx.get(f"{settings.semantic_scholar_base_url}/paper/search").respond(429)
        async with httpx.AsyncClient() as client:
            provider = SemanticScholarProvider(settings, client)
            with pytest.raises(httpx.HTTPStatusError):
                await provider.search("test", limit=5)

    @respx.mock
    async def test_get_paper(self, settings):
        single_paper = SEMANTIC_SCHOLAR_JSON_RESPONSE["data"][0]
        respx.get(url__regex=r".*/paper/.+").respond(200, json=single_paper)
        async with httpx.AsyncClient() as client:
            provider = SemanticScholarProvider(settings, client)
            paper = await provider.get_paper("abc123def456")

        assert paper is not None
        assert paper.title == "Semantic Scholar Test Paper"

    @respx.mock
    async def test_malformed_response_missing_data_key(self, settings):
        respx.get(f"{settings.semantic_scholar_base_url}/paper/search").respond(200, json={"unexpected": "shape"})
        async with httpx.AsyncClient() as client:
            provider = SemanticScholarProvider(settings, client)
            results = await provider.search("test", limit=5)

        assert results == []


# ---------------------------------------------------------------------------
# Timeout / network error handling
# ---------------------------------------------------------------------------

class TestProviderErrorHandling:
    @respx.mock
    async def test_arxiv_timeout(self, settings):
        """Verify that a connection timeout propagates as an error."""
        respx.get(settings.arxiv_base_url).mock(side_effect=httpx.ConnectTimeout("timed out"))
        async with httpx.AsyncClient() as client:
            provider = ArxivProvider(settings, client)
            with pytest.raises(httpx.ConnectTimeout):
                await provider.search("test", limit=5)

    @respx.mock
    async def test_openalex_malformed_json(self, settings):
        """Verify that malformed JSON triggers an appropriate error."""
        respx.get(f"{settings.openalex_base_url}/works").respond(200, text="not-json")
        async with httpx.AsyncClient() as client:
            provider = OpenAlexProvider(settings, client)
            with pytest.raises(Exception):
                await provider.search("test", limit=5)
