# MITCON Credentia Ledger (MC-Ledger)

A secure document vault and checkouts repository for MITCON Credentia. The project is structured as a monorepo containing a Node.js/Express backend and a React (Vite) frontend.

---

## Architecture Overview

```
                          ┌─────────────────────────┐
                          │     Browser Client      │
                          └────────────┬────────────┘
                                       │
                                       │ (Port 80/443)
                                       ▼
                          ┌─────────────────────────┐
                          │   Nginx Reverse Proxy   │ (frontend container)
                          └──────┬───────────┬──────┘
                                 │           │
                    (Static files)│           │ (API & WebSocket proxy)
                                 ▼           ▼
                          ┌───────────┐ ┌───────────┐
                          │ React SPA │ │ Express   │ (backend container, port 5000)
                          └───────────┘ └─────┬─────┘
                                              │
                                              ▼
                                       ┌────────────┐
                                       │  Supabase  │ (PostgreSQL Database)
                                       └────────────┘
```

- **Frontend**: A React SPA built with Vite, TypeScript, and Tailwind CSS. In production, it is built into static assets and served via an optimized Nginx container (port 80) that proxies `/api` and `/socket.io` to the backend.
- **Backend**: A Node.js Express server running on port 5000 that connects to PostgreSQL via Prisma Client and manages user records, documents, checkouts, and system audit logs.
- **Database**: Remote PostgreSQL database hosted on Supabase.

---

## Railway Deployment Guide

This project is fully containerized with Docker and configured for zero-configuration private networking in **Railway**. Follow these instructions to deploy:

### Step 1: Create a Railway Project
1. Log in to your [Railway Dashboard](https://railway.app/).
2. Click **New Project** -> **Deploy from GitHub repo** and select your repository.

### Step 2: Set Up the Backend Service
1. In your project, click **New** -> **Service** -> **GitHub Repo** and select the same repository.
2. Go to **Settings** of this service:
   - Rename the service to `backend` (this is critical so the frontend can resolve it at `http://backend:5000` internally).
   - Set **Root Directory** to `backend`.
3. Go to **Variables** and add:
   ```env
   NODE_ENV=production
   PORT=5000
   DATABASE_URL="postgresql://... (your transaction pooler link)"
   DIRECT_URL="postgresql://... (your session pooler link)"
   SUPABASE_URL="https://...supabase.co"
   SUPABASE_ANON_KEY="your-anon-key"
   SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
   SUPABASE_JWT_SECRET="your-jwt-secret"
   CORS_ORIGINS="https://your-frontend-public-url.up.railway.app" (leave empty during initial setup, then update once frontend has a domain)
   ```

### Step 3: Set Up the Frontend Service
1. Click **New** -> **Service** -> **GitHub Repo** and select the repository.
2. Go to **Settings** of this service:
   - Rename the service to `frontend`.
   - Set **Root Directory** to `frontend`.
3. Go to **Variables**:
   - No environment variables are strictly required for the frontend container since the Nginx proxy is pre-wired to forward `/api` and `/socket.io` to `http://backend:5000` out-of-the-box.
4. Go to **Settings** -> **Public Networking** -> click **Generate Domain** to get a public URL for your application.

---

## Production Security & Resiliency Hardening

1. **Graceful Migrations Check**: The backend container's entrypoint (`docker-entrypoint.sh`) runs Prisma migrations automatically on startup. If the database was already initialized manually, it catches the `P3005` "database not empty" warning and continues startup safely.
2. **Reverse Proxy Security**: The frontend Nginx container serves custom security headers (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`) and is configured with standard Gzip compression for optimal delivery.
3. **CORS Validation**: Backend verifies all incoming API headers against the `CORS_ORIGINS` whitelist.
