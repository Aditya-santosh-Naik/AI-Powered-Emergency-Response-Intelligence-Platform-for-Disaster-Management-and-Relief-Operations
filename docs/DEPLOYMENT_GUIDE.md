# Production Deployment Guide

Instructions for deploying the AI-Powered Emergency Response Platform across local, bare-metal, and cloud environments.

---

## 1. System Requirements

- **Operating System**: Ubuntu 22.04 LTS / Debian 12 / Windows Server 2022 / macOS
- **CPU**: 4 vCPUs minimum (8 vCPUs recommended for concurrent MILP solver runs)
- **RAM**: 8 GB minimum (16 GB recommended)
- **Disk**: 40 GB SSD (NVMe preferred for geospatial indexing)
- **Software Dependencies**: Docker 24+, Docker Compose v2+, Python 3.11+, Node.js 18+

---

## 2. Docker Compose Production Deployment

The project includes a multi-container Docker Compose configuration:
- `db`: PostgreSQL 16 with PostGIS 3.4
- `backend`: FastAPI with Uvicorn ASGI workers
- `frontend`: React 19 production build served via Nginx reverse proxy

### Deployment Steps:

1. **Clone Repository & Configure Environment**:
   ```bash
   git clone https://github.com/Aditya-santosh-Naik/AI-Powered-Emergency-Response-Intelligence-Platform-for-Disaster-Management-and-Relief-Operations.git
   cd internship
   cp .env.example .env
   ```

2. **Configure Production Variables in `.env`**:
   ```env
   ENVIRONMENT=production
   DATABASE_URL=postgresql+asyncpg://erp_admin:StrongSecretPass123!@db:5432/emergency_response
   JWT_SECRET_KEY=super-secure-production-random-jwt-key-32chars!
   CORS_ORIGINS=https://disaster-response.gov.in,http://localhost:3000
   ```

3. **Build and Launch Containerized Stack**:
   ```bash
   docker compose up -d --build
   ```

4. **Run Database Migrations & Initial Seeding**:
   ```bash
   docker compose exec backend alembic upgrade head
   docker compose exec backend python seed.py
   ```

5. **Verify Service Health**:
   ```bash
   curl http://localhost:8000/api/v1/health
   curl http://localhost:3000/
   ```

---

## 3. High-Availability & Scalability Architecture

- **Stateful Layer**: Managed AWS Aurora PostgreSQL (Multi-AZ) or Google Cloud SQL for PostgreSQL with PostGIS extensions enabled.
- **Stateless Backend**: Deploy FastAPI backend as horizontally auto-scaling container tasks behind an Application Load Balancer (AWS ECS / EKS or Google Cloud Run).
- **Static Assets**: Frontend static distribution via CloudFront or Cloudflare CDN with gzip/brotli compression.
- **Monitoring**: Prometheus telemetry metrics scraped from `/metrics` and centralized structured logging via Fluentd / Datadog.
