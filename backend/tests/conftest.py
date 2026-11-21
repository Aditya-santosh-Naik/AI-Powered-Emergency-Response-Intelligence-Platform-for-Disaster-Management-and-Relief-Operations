"""Pytest configuration and common fixtures."""

import os
import sys

import pytest
from starlette.testclient import TestClient

# Ensure backend root and workspace root are on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

# Ensure tests use the local SQLite database
db_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "emergency_response.db")).replace("\\", "/")
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{db_path}"

from app.main import app  # noqa: E402


@pytest.fixture
def client():
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c
