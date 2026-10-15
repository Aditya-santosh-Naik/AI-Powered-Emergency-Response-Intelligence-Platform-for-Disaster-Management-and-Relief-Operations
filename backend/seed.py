"""Database seed script with realistic sample disaster and relief operation data.

All synthetic event records are explicitly marked `is_sample = True`.
Can be run via:
    python seed.py
"""

import asyncio
import logging
from datetime import UTC, datetime, timedelta

from shapely.geometry import Point
from sqlalchemy import select

from app.db import Base, async_session, engine
from app.models import (
    Depot,
    DisasterEvent,
    Donation,
    Donor,
    FieldOperation,
    InventoryItem,
    ResourceType,
)
from app.services.grid import generate_grid_cells_for_impact_zone
from app.services.impact import assess_event_impact

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

RESOURCE_TYPES = [
    {"name": "food_packets", "unit": "packets"},
    {"name": "water", "unit": "liters"},
    {"name": "medical_kits", "unit": "kits"},
    {"name": "rescue_vehicles", "unit": "vehicles"},
    {"name": "personnel", "unit": "persons"},
]

DEPOTS = [
    {
        "name": "NDMA National Logistics Depot - New Delhi",
        "latitude": 28.6139,
        "longitude": 77.2090,
        "address": "Safdarjung Airport Area, New Delhi, 110003",
        "status": "active",
        "inventory": {
            "food_packets": 50000,
            "water": 120000,
            "medical_kits": 2500,
            "rescue_vehicles": 35,
            "personnel": 180,
        },
    },
    {
        "name": "SDRF Regional Relief Hub - Guwahati",
        "latitude": 26.1445,
        "longitude": 91.7362,
        "address": "Beltola Depot Complex, Guwahati, Assam, 781028",
        "status": "active",
        "inventory": {
            "food_packets": 25000,
            "water": 60000,
            "medical_kits": 1200,
            "rescue_vehicles": 22,
            "personnel": 95,
        },
    },
    {
        "name": "Coastal Emergency Staging Base - Bhubaneswar",
        "latitude": 20.2961,
        "longitude": 85.8245,
        "address": "Chandrasekharpur Industrial Area, Bhubaneswar, Odisha, 751024",
        "status": "active",
        "inventory": {
            "food_packets": 35000,
            "water": 85000,
            "medical_kits": 1800,
            "rescue_vehicles": 28,
            "personnel": 120,
        },
    },
    {
        "name": "Southern Disaster Response Depot - Kochi",
        "latitude": 9.9312,
        "longitude": 76.2673,
        "address": "Willingdon Island Port Zone, Kochi, Kerala, 682003",
        "status": "active",
        "inventory": {
            "food_packets": 20000,
            "water": 45000,
            "medical_kits": 950,
            "rescue_vehicles": 18,
            "personnel": 75,
        },
    },
    {
        "name": "Western Emergency Logistics Hub - Mumbai",
        "latitude": 19.0760,
        "longitude": 72.8777,
        "address": "Kurla West Central Depot, Mumbai, Maharashtra, 400070",
        "status": "active",
        "inventory": {
            "food_packets": 40000,
            "water": 90000,
            "medical_kits": 2000,
            "rescue_vehicles": 30,
            "personnel": 140,
        },
    },
]

SAMPLE_EVENTS = [
    {
        "source": "NDMA",
        "external_id": "SEED-2024-FL-01",
        "event_type": "flood",
        "title": "Brahmaputra Basin Severe Inundation - Assam",
        "description": "Massive seasonal monsoon flooding submerging farmland and 45 villages across Barpeta and Morigaon.",
        "latitude": 26.3200,
        "longitude": 91.0000,
        "magnitude": 4.5,
        "depth_km": None,
        "alert_level": "Red",
        "country": "India",
        "started_at": datetime.now(UTC) - timedelta(days=2),
    },
    {
        "source": "USGS",
        "external_id": "SEED-2024-EQ-02",
        "event_type": "earthquake",
        "title": "M5.8 Earthquake - Hindu Kush Border Region",
        "description": "Moderate depth tectonic displacement felt in northern Jammu & Kashmir and Punjab.",
        "latitude": 34.5000,
        "longitude": 74.0000,
        "magnitude": 5.8,
        "depth_km": 35.0,
        "alert_level": "Orange",
        "country": "India",
        "started_at": datetime.now(UTC) - timedelta(days=4),
    },
    {
        "source": "GDACS",
        "external_id": "SEED-2024-TC-03",
        "event_type": "cyclone",
        "title": "Tropical Cyclone - Bay of Bengal Staging",
        "description": "Deep depression advancing northwestward towards North Andhra and South Odisha coasts.",
        "latitude": 18.1000,
        "longitude": 84.5000,
        "magnitude": 3.8,
        "depth_km": None,
        "alert_level": "Red",
        "country": "India",
        "started_at": datetime.now(UTC) - timedelta(days=1),
    },
]

DONORS = [
    {
        "name": "Indian Red Cross Society",
        "organization": "IRCS Disaster Response Wing",
        "email": "relief@indianredcross.org",
        "phone": "+91-11-23716441",
        "latitude": 28.6219,
        "longitude": 77.2144,
    },
    {
        "name": "Tata Relief Committee",
        "organization": "Tata Trusts Disaster Response",
        "email": "disasterresponse@tatatrusts.org",
        "phone": "+91-22-66658282",
        "latitude": 18.9322,
        "longitude": 72.8335,
    },
    {
        "name": "UNICEF India Emergency Supply",
        "organization": "UNICEF South Asia Logistics",
        "email": "supplyindia@unicef.org",
        "phone": "+91-11-24690401",
        "latitude": 28.5910,
        "longitude": 77.2280,
    },
]


async def seed_database() -> None:
    logger.info("Starting database seeding...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with async_session() as session:
        # 1. Resource Types
        rt_map = {}
        for rt_data in RESOURCE_TYPES:
            stmt = select(ResourceType).where(ResourceType.name == rt_data["name"])
            res = await session.execute(stmt)
            existing = res.scalar_one_or_none()
            if not existing:
                existing = ResourceType(name=rt_data["name"], unit=rt_data["unit"])
                session.add(existing)
                await session.flush()
            rt_map[existing.name] = existing

        logger.info("Resource types ready (%d types)", len(rt_map))

        # 2. Depots & Inventory
        depot_map = {}
        for d_data in DEPOTS:
            stmt = select(Depot).where(Depot.name == d_data["name"])
            res = await session.execute(stmt)
            depot = res.scalar_one_or_none()
            point_wkt = Point(d_data["longitude"], d_data["latitude"]).wkt
            if not depot:
                depot = Depot(
                    name=d_data["name"],
                    location=point_wkt,
                    address=d_data["address"],
                    status=d_data["status"],
                )
                session.add(depot)
                await session.flush()
            depot_map[depot.name] = depot

            # Seed inventory items
            for rt_name, qty in d_data["inventory"].items():
                rt = rt_map[rt_name]
                inv_stmt = select(InventoryItem).where(
                    InventoryItem.depot_id == depot.id,
                    InventoryItem.resource_type_id == rt.id,
                )
                inv_res = await session.execute(inv_stmt)
                inv_item = inv_res.scalar_one_or_none()
                if not inv_item:
                    inv_item = InventoryItem(
                        depot_id=depot.id,
                        resource_type_id=rt.id,
                        quantity=qty,
                    )
                    session.add(inv_item)

        logger.info("Depots and initial inventory seeded")

        # 3. Sample Disaster Events, Impact Zones, and Grid Cells
        seeded_events = []
        for ev_data in SAMPLE_EVENTS:
            stmt = select(DisasterEvent).where(
                DisasterEvent.source == ev_data["source"],
                DisasterEvent.external_id == ev_data["external_id"],
            )
            res = await session.execute(stmt)
            ev = res.scalar_one_or_none()
            if not ev:
                point_wkt = Point(ev_data["longitude"], ev_data["latitude"]).wkt
                ev = DisasterEvent(
                    source=ev_data["source"],
                    external_id=ev_data["external_id"],
                    event_type=ev_data["event_type"],
                    title=ev_data["title"],
                    description=ev_data["description"],
                    geometry=point_wkt,
                    magnitude=ev_data["magnitude"],
                    depth_km=ev_data["depth_km"],
                    alert_level=ev_data["alert_level"],
                    country=ev_data["country"],
                    started_at=ev_data["started_at"],
                    is_sample=True,
                    source_url="https://emergency-sample.gov.in",
                )
                session.add(ev)
                await session.flush()

                # Process impact zone & grid cells
                try:
                    impact_zone = await assess_event_impact(ev, session)
                    await generate_grid_cells_for_impact_zone(impact_zone, session)
                except Exception:
                    logger.exception("Could not generate impact zone for seed event %s", ev.title)

            seeded_events.append(ev)

        logger.info("Sample disaster events and grid cells seeded (%d events)", len(seeded_events))

        # 4. Donors & Donations (D1)
        for donor_data in DONORS:
            stmt = select(Donor).where(Donor.name == donor_data["name"])
            res = await session.execute(stmt)
            donor = res.scalar_one_or_none()
            if not donor:
                point_wkt = Point(donor_data["longitude"], donor_data["latitude"]).wkt
                donor = Donor(
                    name=donor_data["name"],
                    organization=donor_data["organization"],
                    email=donor_data["email"],
                    phone=donor_data["phone"],
                    location=point_wkt,
                )
                session.add(donor)
                await session.flush()

                # Record an initial sample donation linked to Delhi or Guwahati depot
                target_depot = list(depot_map.values())[0]
                rt = rt_map["medical_kits"]
                donation = Donation(
                    donor_id=donor.id,
                    depot_id=target_depot.id,
                    resource_type_id=rt.id,
                    quantity=250,
                    donated_at=datetime.now(UTC) - timedelta(days=1),
                    notes="Emergency monsoon relief consignment",
                )
                session.add(donation)

        # 5. Field Operations (R5.3)
        sample_ev = seeded_events[0]
        sample_depot = list(depot_map.values())[1]  # Guwahati
        field_ops = [
            {
                "operation_type": "Search and Rescue Evacuation",
                "description": "Deployment of motorized inflatable boats to evacuate marooned families in Barpeta.",
                "latitude": 26.3150,
                "longitude": 91.0050,
                "status": "in_progress",
                "started_at": datetime.now(UTC) - timedelta(hours=14),
            },
            {
                "operation_type": "Emergency Water Distribution",
                "description": "Mobile purification trucks setting up potable water stations at relief camps.",
                "latitude": 26.2500,
                "longitude": 91.1200,
                "status": "planned",
                "started_at": datetime.now(UTC) - timedelta(hours=4),
            },
        ]
        for fop in field_ops:
            op_stmt = select(FieldOperation).where(FieldOperation.description == fop["description"])
            op_res = await session.execute(op_stmt)
            if not op_res.scalar_one_or_none():
                point_wkt = Point(fop["longitude"], fop["latitude"]).wkt
                op = FieldOperation(
                    event_id=sample_ev.id,
                    depot_id=sample_depot.id,
                    operation_type=fop["operation_type"],
                    description=fop["description"],
                    location=point_wkt,
                    status=fop["status"],
                    started_at=fop["started_at"],
                )
                session.add(op)

        await session.commit()
        logger.info("Database seeding completed successfully.")


if __name__ == "__main__":
    asyncio.run(seed_database())
