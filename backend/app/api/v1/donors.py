"""Donors and donations API router (Requirement D1)."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from shapely.geometry import Point
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.v1.utils import geom_to_geojson
from app.db import get_db
from app.models import Donation, Donor, ResourceType
from app.schemas import (
    DonationCreate,
    DonationOut,
    DonorCreate,
    DonorDetail,
    DonorOut,
    DonorUpdate,
)
from app.services.donors import record_donation

router = APIRouter(tags=["donors"])


def _extract_coords(point_geom) -> tuple[float | None, float | None]:
    geojson = geom_to_geojson(point_geom)
    if geojson and "coordinates" in geojson:
        coords = geojson["coordinates"]
        return float(coords[1]), float(coords[0])  # lat, lon
    return None, None


@router.get("/donors", response_model=list[DonorOut])
async def list_donors(db: AsyncSession = Depends(get_db)):
    stmt = select(Donor).order_by(Donor.name)
    res = await db.execute(stmt)
    donors = res.scalars().all()
    out = []
    for d in donors:
        lat, lon = _extract_coords(d.location)
        out.append(
            DonorOut(
                id=d.id,
                name=d.name,
                email=d.email,
                phone=d.phone,
                organization=d.organization,
                latitude=lat,
                longitude=lon,
                created_at=d.created_at,
                updated_at=d.updated_at,
            )
        )
    return out


@router.post("/donors", response_model=DonorOut, status_code=status.HTTP_201_CREATED)
async def create_donor(data: DonorCreate, db: AsyncSession = Depends(get_db)):
    point_wkt = None
    if data.latitude is not None and data.longitude is not None:
        point_wkt = Point(data.longitude, data.latitude).wkt

    donor = Donor(
        name=data.name,
        email=data.email,
        phone=data.phone,
        organization=data.organization,
        location=point_wkt,
    )
    db.add(donor)
    await db.commit()
    await db.refresh(donor)
    lat, lon = _extract_coords(donor.location)
    return DonorOut(
        id=donor.id,
        name=donor.name,
        email=donor.email,
        phone=donor.phone,
        organization=donor.organization,
        latitude=lat,
        longitude=lon,
        created_at=donor.created_at,
        updated_at=donor.updated_at,
    )


@router.get("/donors/{donor_id}", response_model=DonorDetail)
async def get_donor(donor_id: UUID, db: AsyncSession = Depends(get_db)):
    stmt = (
        select(Donor)
        .options(selectinload(Donor.donations).selectinload(Donation.resource_type))
        .where(Donor.id == donor_id)
    )
    res = await db.execute(stmt)
    donor = res.scalar_one_or_none()
    if not donor:
        raise HTTPException(status_code=404, detail="Donor not found")

    lat, lon = _extract_coords(donor.location)
    donations_data = [
        DonationOut(
            id=d.id,
            donor_id=d.donor_id,
            depot_id=d.depot_id,
            resource_type_id=d.resource_type_id,
            resource_type_name=d.resource_type.name if d.resource_type else None,
            quantity=d.quantity,
            donated_at=d.donated_at,
            notes=d.notes,
            created_at=d.created_at,
        )
        for d in donor.donations
    ]

    return DonorDetail(
        id=donor.id,
        name=donor.name,
        email=donor.email,
        phone=donor.phone,
        organization=donor.organization,
        latitude=lat,
        longitude=lon,
        created_at=donor.created_at,
        updated_at=donor.updated_at,
        donations=donations_data,
    )


@router.put("/donors/{donor_id}", response_model=DonorOut)
async def update_donor(donor_id: UUID, data: DonorUpdate, db: AsyncSession = Depends(get_db)):
    stmt = select(Donor).where(Donor.id == donor_id)
    res = await db.execute(stmt)
    donor = res.scalar_one_or_none()
    if not donor:
        raise HTTPException(status_code=404, detail="Donor not found")

    if data.name is not None:
        donor.name = data.name
    if data.email is not None:
        donor.email = data.email
    if data.phone is not None:
        donor.phone = data.phone
    if data.organization is not None:
        donor.organization = data.organization
    if data.latitude is not None and data.longitude is not None:
        donor.location = Point(data.longitude, data.latitude).wkt

    await db.commit()
    await db.refresh(donor)
    lat, lon = _extract_coords(donor.location)
    return DonorOut(
        id=donor.id,
        name=donor.name,
        email=donor.email,
        phone=donor.phone,
        organization=donor.organization,
        latitude=lat,
        longitude=lon,
        created_at=donor.created_at,
        updated_at=donor.updated_at,
    )


@router.delete("/donors/{donor_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_donor(donor_id: UUID, db: AsyncSession = Depends(get_db)):
    stmt = select(Donor).where(Donor.id == donor_id)
    res = await db.execute(stmt)
    donor = res.scalar_one_or_none()
    if not donor:
        raise HTTPException(status_code=404, detail="Donor not found")
    await db.delete(donor)
    await db.commit()


# -- Donations --

@router.post("/donations", response_model=DonationOut, status_code=status.HTTP_201_CREATED)
async def record_new_donation(data: DonationCreate, db: AsyncSession = Depends(get_db)):
    try:
        donation = await record_donation(
            db=db,
            donor_id=data.donor_id,
            depot_id=data.depot_id,
            resource_type_id=data.resource_type_id,
            quantity=data.quantity,
            donated_at=data.donated_at,
            notes=data.notes,
        )
        await db.commit()
        await db.refresh(donation)

        rt_stmt = select(ResourceType).where(ResourceType.id == donation.resource_type_id)
        rt_res = await db.execute(rt_stmt)
        rt = rt_res.scalar_one_or_none()

        return DonationOut(
            id=donation.id,
            donor_id=donation.donor_id,
            depot_id=donation.depot_id,
            resource_type_id=donation.resource_type_id,
            resource_type_name=rt.name if rt else None,
            quantity=donation.quantity,
            donated_at=donation.donated_at,
            notes=donation.notes,
            created_at=donation.created_at,
        )
    except ValueError as exc:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.get("/donations", response_model=list[DonationOut])
async def list_donations(
    donor_id: UUID | None = None,
    depot_id: UUID | None = None,
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(Donation)
        .options(selectinload(Donation.resource_type))
        .order_by(Donation.donated_at.desc())
    )
    if donor_id:
        stmt = stmt.where(Donation.donor_id == donor_id)
    if depot_id:
        stmt = stmt.where(Donation.depot_id == depot_id)

    res = await db.execute(stmt)
    donations = res.scalars().all()
    return [
        DonationOut(
            id=d.id,
            donor_id=d.donor_id,
            depot_id=d.depot_id,
            resource_type_id=d.resource_type_id,
            resource_type_name=d.resource_type.name if d.resource_type else None,
            quantity=d.quantity,
            donated_at=d.donated_at,
            notes=d.notes,
            created_at=d.created_at,
        )
        for d in donations
    ]
