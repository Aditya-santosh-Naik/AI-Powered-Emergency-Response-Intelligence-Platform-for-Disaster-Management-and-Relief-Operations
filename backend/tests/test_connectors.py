"""Unit tests for disaster data connectors."""


import httpx
import pytest
import respx

from app.connectors.firms import FIRMSConnector
from app.connectors.gdacs import GDACS_API, GDACSConnector
from app.connectors.ndma import NDMAConnector
from app.connectors.usgs import USGS_FEED, USGSConnector


@pytest.mark.asyncio
@respx.mock
async def test_usgs_connector_fetch_and_normalize():
    sample_geojson = {
        "type": "FeatureCollection",
        "features": [
            {
                "id": "us7000test",
                "properties": {
                    "mag": 6.2,
                    "place": "28 km NE of Tezpur, India",
                    "time": 1712102400000,
                    "url": "https://earthquake.usgs.gov/earthquakes/eventpage/us7000test",
                    "alert": "orange",
                },
                "geometry": {
                    "type": "Point",
                    "coordinates": [92.8, 26.6, 15.0],
                },
            }
        ],
    }

    respx.get(USGS_FEED).mock(return_value=httpx.Response(200, json=sample_geojson))

    connector = USGSConnector()
    events = await connector.fetch_events()
    assert len(events) == 1

    normalized = connector.normalize(events[0])
    assert normalized["external_id"] == "us7000test"
    assert normalized["event_type"] == "earthquake"
    assert normalized["magnitude"] == 6.2
    assert normalized["depth_km"] == 15.0
    assert normalized["alert_level"] == "orange"
    assert normalized["is_sample"] is False
    assert "POINT (92.8 26.6)" in normalized["geometry"]


@pytest.mark.asyncio
@respx.mock
async def test_gdacs_connector_fetch_and_normalize():
    sample_gdacs = {
        "type": "FeatureCollection",
        "features": [
            {
                "properties": {
                    "eventid": 10001,
                    "episodeid": 1,
                    "eventtype": "FL",
                    "name": "Flood in Bangladesh",
                    "description": "Monsoon flooding affecting Sylhet division",
                    "fromdate": "2024-06-18T00:00:00Z",
                    "alertlevel": "Red",
                    "country": "Bangladesh",
                    "severitydata": {"severity": 3.0},
                    "url": {"report": "https://www.gdacs.org/report.aspx?eventid=10001"},
                },
                "geometry": {
                    "type": "Point",
                    "coordinates": [91.87, 24.89],
                },
            }
        ],
    }

    respx.get(GDACS_API).mock(return_value=httpx.Response(200, json=sample_gdacs))

    connector = GDACSConnector()
    events = await connector.fetch_events()
    assert len(events) == 1

    normalized = connector.normalize(events[0])
    assert normalized["external_id"] == "10001-1"
    assert normalized["event_type"] == "flood"
    assert normalized["title"] == "Flood in Bangladesh"
    assert normalized["alert_level"] == "Red"
    assert normalized["is_sample"] is False
    assert "POINT (91.87 24.89)" in normalized["geometry"]


@pytest.mark.asyncio
async def test_ndma_connector_loads_fixture_with_sample_flag():
    connector = NDMAConnector()
    events = await connector.fetch_events()
    assert len(events) > 0

    first = events[0]
    normalized = connector.normalize(first)
    assert normalized["country"] == "India"
    assert normalized["is_sample"] is True
    assert normalized["geometry"] is not None


@pytest.mark.asyncio
async def test_firms_connector_gracefully_skips_when_no_key(monkeypatch):
    from app.config import settings
    monkeypatch.setattr(settings, "firms_map_key", "")

    connector = FIRMSConnector()
    events = await connector.fetch_events()
    assert events == []
