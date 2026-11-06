"""Tests for AI service — no paid API calls required."""
import os
os.environ.setdefault("MOCK_AI", "true")

import pytest
from fastapi.testclient import TestClient


def test_chunk_page_basic():
    """chunk_page returns chunks with correct page number."""
    from app.main import chunk_page
    chunks = chunk_page("hello world " * 100, 3, 100, 20, 0)
    assert len(chunks) > 1
    assert all(chunk.page_number == 3 for chunk in chunks)


def test_chunk_page_empty():
    from app.main import chunk_page
    chunks = chunk_page("", 1, 100, 20, 0)
    assert chunks == []


def test_chunk_page_indices():
    from app.main import chunk_page
    chunks = chunk_page("a" * 500, 2, 100, 20, 5)
    assert chunks[0].chunk_index == 5


def test_health_endpoint():
    from app.main import app
    client = TestClient(app)
    resp = client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert "status" in data
    assert data["mock"] is True


def test_provider_info_endpoint():
    from app.main import app
    client = TestClient(app)
    resp = client.get("/provider-info")
    assert resp.status_code == 200
    data = resp.json()
    assert data["mock"] is True
    assert data["llm"]["name"] == "mock"
    assert data["embedding"]["name"] == "mock"


def test_extract_invalid_base64():
    from app.main import app
    client = TestClient(app)
    resp = client.post("/extract", json={"content_base64": "not-valid-base64!!!"})
    assert resp.status_code == 400


def test_embed_mock():
    from app.main import app
    client = TestClient(app)
    resp = client.post("/embed", json={"text": "hello world"})
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["embedding"]) == 768
    assert data["provider"] == "mock"


def test_embed_batch_mock():
    from app.main import app
    client = TestClient(app)
    resp = client.post("/embed-batch", json={"texts": ["hello", "world"]})
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["embeddings"]) == 2


def test_answer_no_context():
    from app.main import app
    client = TestClient(app)
    resp = client.post("/answer", json={"question": "What is the GPA requirement?", "context_chunks": []})
    assert resp.status_code == 200
    assert "knowledge base" in resp.json()["answer"]


def test_answer_with_context_mock():
    from app.main import app
    client = TestClient(app)
    resp = client.post("/answer", json={
        "question": "What is the GPA requirement?",
        "context_chunks": ["Students must have a minimum GPA of 3.5 to qualify for the scholarship."],
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "answer" in data
    assert data["provider"] == "mock"
