# Deployment Guide & GitHub Actions Setup

This guide details how to deploy the **Inventory & Production Management System** using GitHub Actions, Docker, and Docker Compose.

---

## 🚀 Architectural Overview

The system consists of three main components:
1. **Frontend**: Next.js (React 19, TypeScript) running on port `3000`.
2. **Backend**: FastAPI (Python 3.11, SQLModel) running on port `8000`.
3. **Database**: PostgreSQL 15 running on port `5432` / `5434`.

---

## 🛠️ 1. Continuous Integration (CI Pipeline)

The CI pipeline is defined in [ci.yml](file:///.github/workflows/ci.yml).

### Workflows Included:
- **`backend-test`**: Sets up Python 3.11, installs dependencies from `backend/requirements.txt`, and runs pytest tests (`pytest backend/test_main.py`).
- **`frontend-build`**: Sets up Node.js 20, runs `npm ci`, runs `npm run lint`, and verifies the Next.js production build (`npm run build`).

Triggers automatically on every push or pull request to the `main` or `master` branches.

---

## 📦 2. Continuous Deployment (CD Pipeline)

The CD pipeline is defined in [deploy.yml](file:///.github/workflows/deploy.yml).

### Actions Executed:
1. **Build & Tag Docker Images**: Builds standalone Docker images for `backend` and `frontend`.
2. **Push to GitHub Container Registry (GHCR)**:
   - Backend: `ghcr.io/<owner>/<repo>/backend:latest`
   - Frontend: `ghcr.io/<owner>/<repo>/frontend:latest`
3. **Server Deployment (Optional)**: Connects via SSH to your production server and triggers `docker-compose.prod.yml pull && docker compose -f docker-compose.prod.yml up -d`.

### Required GitHub Secrets & Variables (For SSH Server Deployment):
Go to your GitHub repository -> **Settings** -> **Secrets and variables** -> **Actions**:

#### Repository Variables (Variables tab):
- `SSH_HOST`: IP address or domain of your deployment server (e.g. `203.0.113.10`).

#### Repository Secrets (Secrets tab):
- `SSH_USER`: SSH user (e.g. `ubuntu` or `root`).
- `SSH_PRIVATE_KEY`: Content of your private SSH key used to log into the server.
- `SSH_PORT`: (Optional) SSH port, defaults to `22`.

---

## 🐳 3. Running Locally with Production Docker Compose

You can build and run the entire stack locally using Docker Compose:

### Build and start containers:
```bash
docker compose -f docker-compose.prod.yml up --build -d
```

### Check running services:
```bash
docker compose -f docker-compose.prod.yml ps
```

### Accessing the application:
- **Frontend App**: `http://localhost:3000`
- **Backend API**: `http://localhost:8000`
- **API Docs (Swagger)**: `http://localhost:8000/docs`

### Stop containers:
```bash
docker compose -f docker-compose.prod.yml down
```

---

## 🔒 4. Environment Variables Reference

When deploying to production, configure the following environment variables in your server environment or `.env` file:

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `POSTGRES_USER` | `postgres` | Database username |
| `POSTGRES_PASSWORD` | `postgres_prod_password` | Database password |
| `POSTGRES_DB` | `inventory` | Database name |
| `DATABASE_URL` | `postgresql://postgres:postgres_prod_password@db:5432/inventory` | Database connection string |
| `JWT_SECRET` | `super-secret-production-key-change-me` | Secret key for auth tokens |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | Public API URL accessed by frontend |
