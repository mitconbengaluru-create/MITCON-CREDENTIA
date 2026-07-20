# Project Memory Bank: brain.md
## System Name: MITCON Credential Digital File Storage System (BCD-FSS)
**Document Version:** 1.4.0  
**Last Updated:** June 29, 2026  

This document serves as the persistent memory, architectural blueprint, and technical documentation bank for all engineers working on the **MITCON Credential Digital File Storage System (BCD-FSS)**.

---

## 1. High-Level Design (HLD) & Technology Stack

The project implements a **Stateless Three-Tier Architecture** optimized for high concurrency, real-time lock synchronization, and asynchronous job boundaries.

```
       [ Client Presentation Tier ] (React 19, Zustand, TanStack Query)
                   │
                   ▼ (HTTPS / WSS via Nginx Proxy)
        [ API Business Logic Tier ] (Express 5, Node.js ES2023 ESM)
         ├── Auth & Identity Sync (Supabase Auth API)
         └── Real-time WS Sync (Socket.IO with Redis Adapter)
                   │
                   ├── Asynchronous Enqueue
                   │   ▼
                   │ [ BullMQ Background Jobs ] (Malware Scan, PDF Gen)
                   │   │
                   ▼   ▼
        [ Relational Database & Cache Tier ]
         ├── Database: PostgreSQL (Prisma ORM Client Singleton)
         ├── Cache / Queue Broker: Redis Server Cluster
         └── Blob Object Store: Supabase Storage Buckets
```

### Technical Blueprint:
* **Frontend:** React 19, Vite, Tailwind CSS, Zustand, TanStack Query, ShadCN UI.
* **Backend:** Node.js (ES2023 JS ESM), Express 5.
* **Database & ORM:** PostgreSQL + Prisma ORM Client.
* **Authentication:** Supabase Auth Integration (signed JWTs, OIDC).
* **Binary Storage:** Supabase Storage (S3-compatible bucket keys).
* **Caching & Queue:** Redis Server + BullMQ.
* **WebSockets:** Socket.IO utilizing `@socket.io/redis-adapter` for auto-scale environments.
* **Security Middleware:** Helmet headers, CORS filters, express-rate-limit, jsonwebtoken, bcrypt.

---

## 2. Entity-Relationship (ER) Database Schema

The database relies on PostgreSQL mapped via the Prisma ORM Client. The models optimize relational indexes and cascade deletions.

```mermaid
erDiagram
    users ||--o{ documents : "owns"
    users ||--o{ documents : "locks (active checkout)"
    users ||--o{ audit_logs : "triggers"
    users ||--o{ vaults : "owns"
    users ||--o{ folder_permissions : "has"
    users ||--o{ approval_requests : "creates"
    users ||--o{ approval_requests : "is assigned to"
    users ||--o{ approval_steps : "assigned to"
    approval_requests ||--o{ approval_steps : "has"
    approval_requests ||--o{ approval_histories : "logs"
    users ||--o{ digital_signatures : "creates"
    users ||--o{ digital_signatures : "verifies"
    digital_signatures ||--o{ signature_histories : "logs"
    
    departments ||--o{ users : "groups"
    departments ||--o{ vaults : "owns"
    departments ||--o{ folders : "owns"
    departments ||--o{ documents : "owns"

    vaults ||--o{ folders : "contains"
    vaults ||--o{ documents : "contains"
    
    folders ||--o{ folders : "parent-to-child"
    folders ||--o{ documents : "contains"
    folders ||--o{ folder_permissions : "rules"
    
    documents ||--o{ file_versions : "has revisions"
    documents ||--o{ audit_logs : "logs history"

    users {
        string id PK "Matches Supabase Auth UUID"
        string email UK
        string role "default: VIEWER"
        string department_id FK "departments.id (nullable)"
        datetime created_at
        datetime updated_at
    }

    departments {
        string id PK "UUID"
        string name UK
        datetime created_at
        datetime updated_at
    }

    vaults {
        string id PK "UUID"
        string name UK
        string description
        enum type "DEPARTMENT, PROJECT, CLIENT, CUSTOM"
        enum status "ACTIVE, ARCHIVED, DISABLED"
        string owner_id FK "users.id"
        string department_id FK "departments.id (nullable)"
        boolean is_archived
        boolean is_deleted
        datetime deleted_at
        datetime created_at
        datetime updated_at
    }

    folders {
        string id PK "UUID"
        string name
        string parent_id FK "folders.id (nullable)"
        string vault_id FK "vaults.id (nullable)"
        string department_id FK "departments.id (nullable)"
        string owner_id FK "users.id"
        string path "absolute directory path"
        enum status "ACTIVE, ARCHIVED, DISABLED"
        boolean is_archived
        boolean is_deleted
        datetime deleted_at
        datetime created_at
        datetime updated_at
    }

    folder_permissions {
        string id PK "UUID"
        string folder_id FK "folders.id"
        string user_id FK "users.id"
        enum permission "READ, WRITE, ADMIN"
        datetime created_at
    }

    documents {
        string id PK "UUID"
        string name "file basename"
        string document_number UK "unique serial number (nullable)"
        string description
        string[] tags "file search tags"
        string folder_id FK "folders.id (nullable)"
        string vault_id FK "vaults.id (nullable)"
        string department_id FK "departments.id (nullable)"
        string owner_id FK "users.id"
        enum storage_provider "SUPABASE, LOCAL, AWS_S3"
        string storage_bucket "Supabase Storage bucket"
        string storage_path "Supabase Storage object path"
        int file_size "in bytes"
        string mime_type
        string checksum
        enum classification "PUBLIC, INTERNAL, CONFIDENTIAL, RESTRICTED"
        enum status "PENDING_UPLOAD, DRAFT, ACTIVE, INFECTED, ARCHIVED"
        int version "increments on check-in"
        boolean is_locked
        string locked_by_id FK "users.id (nullable)"
        datetime locked_at
        boolean is_deleted
        datetime deleted_at
        datetime created_at
        datetime updated_at
    }

    file_versions {
        string id PK "UUID"
        string document_id FK "documents.id"
        int version "previous revision version number"
        string file_path "Supabase backup bucket path"
        string change_log "developer check-in notes"
        string created_by "user UUID who created this revision"
        datetime created_at
    }

    approval_requests {
        string id PK "UUID"
        enum reference_type "CHECKOUT, DOCUMENT, USER_ACCESS, EXTERNAL_SHARE"
        string reference_id "polymorphic target resource UUID/string"
        string title
        string description
        string reason
        string requester_id FK "users.id"
        datetime requested_at
        string requester_name
        string requester_department
        string requester_designation
        int current_step
        int total_steps
        string current_approver_id FK "users.id (nullable)"
        string approval_level "e.g. STANDARD, DEPARTMENT, ADMIN, HIGHER_AUTHORITY"
        string priority "LOW, NORMAL, HIGH, URGENT"
        enum status "DRAFT, PENDING, IN_PROGRESS, APPROVED, REJECTED, CANCELLED, EXPIRED"
        boolean is_deleted
        datetime deleted_at
        string deleted_by
        datetime created_at
        datetime updated_at
    }

    approval_steps {
        string id PK "UUID"
        string approval_request_id FK "approval_requests.id"
        int step_number
        string approver_id FK "users.id"
        string approver_role
        enum status "DRAFT, PENDING, IN_PROGRESS, APPROVED, REJECTED, CANCELLED, EXPIRED"
        datetime decision_date
        string comments
        string action_taken "APPROVED, REJECTED"
        string approver_name
        datetime created_at
        datetime updated_at
    }

    approval_histories {
        string id PK "UUID"
        string approval_request_id FK "approval_requests.id"
        enum action "CREATED, SUBMITTED, APPROVED, REJECTED, REASSIGNED, CANCELLED"
        string performed_by "User UUID / SYSTEM"
        datetime timestamp
        enum previous_state "DRAFT, PENDING, IN_PROGRESS, APPROVED, REJECTED, CANCELLED, EXPIRED"
        enum new_state "DRAFT, PENDING, IN_PROGRESS, APPROVED, REJECTED, CANCELLED, EXPIRED"
        string remarks
        datetime created_at
    }

    digital_signatures {
        string id PK "UUID"
        string signature_ref_number UK
        enum signature_type "DRAWN, UPLOADED, CERTIFICATE"
        enum status "CREATED, PENDING_VERIFICATION, VERIFIED, FAILED, REVOKED"
        string user_id FK "users.id"
        string user_snapshot
        string department_snapshot
        enum reference_type "CHECKOUT, RETURN, APPROVAL, DOCUMENT"
        string reference_id
        string storage_provider
        string bucket_name
        string storage_path
        string file_hash
        string signature_hash
        string original_filename
        string mime_type
        int file_size
        string checksum
        string encoding_metadata
        string verification_status
        string verification_hash
        string verified_by FK "users.id (nullable)"
        datetime verified_at
        string verification_method
        boolean is_deleted
        datetime deleted_at
        string deleted_by
        datetime created_at
        datetime updated_at
    }

    signature_histories {
        string id PK "UUID"
        string signature_id FK "digital_signatures.id"
        string action "CREATED, UPLOADED, VERIFIED, FAILED, REVOKED"
        string performed_by
        datetime timestamp
        json metadata
        datetime created_at
    }

    audit_logs {
        string id PK "UUID"
        string action "LOGIN, DOCUMENT_UPLOADED, DOCUMENT_DOWNLOADED, etc"
        string user_id FK "users.id (nullable)"
        string document_id FK "documents.id (nullable)"
        string ip_address
        string user_agent
        json payload "change logs / metadata"
        datetime created_at
    }
}

---

## 3. Low-Level Design (LLD) & Modular Boundaries

The backend implements a **Consolidated Directory Architecture** to keep boundary scopes strict and prevent file sprawl while maintaining high codebase hygiene.

### 3.1. Standard Module Structure
For any business feature (e.g., `auth`):
1. **Core Directory (`src/auth/`)**:
   * **`auth.service.js`**: Consolidates business logic, constants (`AUTH_CONFIG`, `AUTH_MESSAGES`, `AUTH_ERRORS`), and data transfer serialization mappings (DTOs).
   * **`auth.routes.js`**: Consolidates routing endpoints and Zod validation schemas.
2. **Respective Architectural Folders**:
   * **`src/controllers/auth.controller.js`**: Handles Express Request/Response boundaries and invokes services/DTOs.
   * **`src/middleware/auth.middleware.js`**: Wires specific authentication/authorization guards.
   * **`src/repositories/auth.repository.js`**: Abstracts database logic using Prisma Client.
   * **`src/utils/auth.util.js`**: Exposes helper functions for headers/cookies.

### 3.2. Middleware Execution Chain
```
[Client Call]
    │
    ├── 1. Security filters (Helmet, CORS)
    ├── 2. Rate Limiting check
    ├── 3. Correlation Token generation (requestIdMiddleware)
    ├── 4. Request Logging (pino-http)
    ├── 5. Supabase JWT Authentication checks (auth.mw.js)
    ├── 6. RBAC Role scopes & MFA checks (rbac.mw.js)
    ├── 7. Request shape validations (Zod validateRequest)
    │
    ▼
[Controller Handler] ─── (Invokes DTO & Service)
    │
    ├── Route processing throws Domain Exception...
    │
    ▼
[Error Logger (errorLogger.mw)] ─── Logs correlated error metrics via Request ID
    │
    ▼
[Global Express Error Formatter] ─── Returns standardized JSON error envelope
```

---

## 4. Architectural Decision Records (ADRs)

### ADR-001: Decoupling HTTP Transport and Server Bootstrap
* **Context:** Integration tests need to assert HTTP routes without blocking physical ports.
* **Decision:** We separate the Express pipeline configuration (`app.js`) from the network port listener (`server.js`).
* **Consequences:** Supertest runs mock HTTP assertions in-memory, avoiding port collision errors.

### ADR-002: Fail-Fast Zod Verification Configs
* **Context:** Undefined environment variables (e.g., missing API keys) can lead to silent errors during runtime.
* **Decision:** Create `config/env.js` which loads variables using `dotenv` and parses them using Zod validation.
* **Consequences:** If any key is missing or type-mismatched, the server logs validation errors and crashes immediately during boot.

### ADR-003: Singleton Pattern for Database and Cache Clients
* **Context:** Opening new connection channels for every query exhausts PostgreSQL and Redis connection pool limits.
* **Decision:** Export database, Redis, and Supabase client instances as singletons from the `config/` layer.
* **Consequences:** The application maintains a constant, optimized pool size across its lifecycle.

### ADR-004: Structured JSON Logging using Pino
* **Context:** Default `console.log()` outputs are slow and unparseable by log indexers.
* **Decision:** Use Pino and pino-http for logging. Toggle `pino-pretty` formatting in development and raw JSON in production.
* **Consequences:** Fast, non-blocking logs that are easily indexed by log aggregators (e.g. Datadog).

### ADR-005: Pure JavaScript (ES2023) ESM with JSDoc
* **Context:** The team decided to avoid compilation overheads and build using native JavaScript ESM.
* **Decision:** Write all files as standard `.js` ES Modules. Document arguments and return values using JSDoc.
* **Consequences:** Eliminates compilation steps (`tsc`), enables native Node.js hot-reloads (`node --watch`), and maintains IDE autocomplete.

### ADR-006: Local Redis Availability Tolerance during Development
* **Context:** Local developers may work on system modules (e.g. user authentication, database models) without having a running local Redis instance, causing bootstrap connection verification crashes.
* **Decision:** Wrap the Redis `.ping()` check in `server.js` bootstrap inside a try-catch construct, logging a warning rather than throwing a fatal crash.
* **Consequences:** Server boots up successfully on localhost without requiring local Redis to be constantly online.

### ADR-007: Development Environment Queue Mocking (REDIS_ENABLED toggle)
* **Context:** While ADR-006 allowed the server to boot up, the active instantiation of BullMQ Queues and Workers inside module files triggered background reconnect loops within `ioredis` that flooded the terminal with connection spams (`ECONNREFUSED`).
* **Decision:** Introduce a configuration toggle `REDIS_ENABLED` in environment schemas. When set to `false`, the backend instantiates lightweight mock classes (e.g., `MockQueue` and `MockWorker`) implementing standard Queue/Worker interfaces.
* **Consequences:** Developers can run, test, and write CRUD/auth layers locally without running local Redis. Job enqueues log output metrics to stdout instead of throwing socket errors.

---

## 5. Architectural Workflows

### 5.1. Authentication & Profile Sync Flow
Supabase Auth manages client credentials, generating a JWT.
1. Client submits JWT in the `Authorization: Bearer <JWT>` header.
2. Express backend decodes and verifies the token signature against the `SUPABASE_JWT_SECRET`.
3. If valid, the backend checks if the user's UUID exists in the local PostgreSQL `users` table.
4. If missing (first login), the backend synchronously duplicates the profile into the local database (setting the default role to `VIEWER`).
5. Evaluates Multi-Factor Authentication (MFA) status by inspecting the JWT `amr` claims array (checking for `mfa`).
6. Attaches the user object and MFA state to the request object (`req.user`).

### 5.2. Document Direct-to-Storage Upload Flow
Avoids routing large file uploads through the Express process:
1. Client calls `POST /api/v1/documents/upload-intent` specifying metadata.
2. Backend creates a database record with `status: PENDING_UPLOAD` and returns a Supabase Storage signed upload URL.
3. Client uploads the binary file directly to the S3 bucket using the signed URL.
4. Client calls `POST /api/v1/documents/:id/complete-upload` notifying the backend that the upload finished.
5. Backend updates the database status to `DRAFT` and enqueues a background BullMQ job for malware scanning.

### 5.3. Concurrency Checkout & Return Flow
Guarantees file locking and prevents edit conflicts:
1. User A requests checkout via `POST /api/v1/documents/:id/checkout`.
2. Backend starts a database transaction to verify lock status. If unlocked, sets `isLocked: true`, `lockedById: UserA`, and `lockedAt: new Date()`.
3. Broadcasts a `DOCUMENT_LOCKED` WebSocket event via Socket.IO to disable edit controls for other users.
4. When finished, User A uploads the modified file and calls `POST /api/v1/documents/:id/checkin`.
5. Backend verifies User A owns the active lock, commits a new `FileVersion` record, increments `version`, clears the lock fields, and broadcasts a `DOCUMENT_UNLOCKED` event.

---

## 6. Implementation Registry & Created Files

The following files have been created in the `backend/` project workspace:

### 6.1. Configuration Layer (`src/config/`)
* **[env.js](file:///c:/Users/Vibin.Cariappa/Desktop/Credentia/backend/src/config/env.js):** Environment variable verification and schema parsing. Stores the `REDIS_ENABLED` boolean toggle flag.
* **[database.js](file:///c:/Users/Vibin.Cariappa/Desktop/Credentia/backend/src/config/database.js):** Exports the Prisma database connection client singleton.
* **[supabase.js](file:///c:/Users/Vibin.Cariappa/Desktop/Credentia/backend/src/config/supabase.js):** Initializes and exports the Supabase client wrapper. Defines bucket storage identifiers.
* **[redis.js](file:///c:/Users/Vibin.Cariappa/Desktop/Credentia/backend/src/config/redis.js):** Sets up and exports the **ioredis** Client connection singleton. Yields a lightweight mock client if `REDIS_ENABLED` is false.
* **[bullmq.js](file:///c:/Users/Vibin.Cariappa/Desktop/Credentia/backend/src/config/bullmq.js):** Defines BullMQ connection credentials, default retries, exponential backoffs, and queue limits.
* **[logger.js](file:///c:/Users/Vibin.Cariappa/Desktop/Credentia/backend/src/config/logger.js):** Centralized Pino client configurations.
* **[security.js](file:///c:/Users/Vibin.Cariappa/Desktop/Credentia/backend/src/config/security.js):** Stores CORS origins, Helmet CSP policies, and encryption parameters.
* **[index.js](file:///c:/Users/Vibin.Cariappa/Desktop/Credentia/backend/src/config/index.js):** Central portal re-exporting all configuration singletons.

### 6.2. Logging & Middlewares (`src/shared/`, `src/middleware/`)
* **[request-id.js](file:///c:/Users/Vibin.Cariappa/Desktop/Credentia/backend/src/shared/request-id.js):** Correlation request identifier generator middleware.
* **[requestLogger.js](file:///c:/Users/Vibin.Cariappa/Desktop/Credentia/backend/src/middleware/requestLogger.js):** HTTP request and response performance log logger.
* **[errorLogger.js](file:///c:/Users/Vibin.Cariappa/Desktop/Credentia/backend/src/middleware/errorLogger.js):** Global exception stack trace logging filter.

### 6.3. Application Bootstrap
* **[app.js](file:///c:/Users/Vibin.Cariappa/Desktop/Credentia/backend/src/app.js):** Express application configuration, payload limit parsers, route mounts, and global error formatters.
* **[server.js](file:///c:/Users/Vibin.Cariappa/Desktop/Credentia/backend/src/server.js):** The HTTP server network bootstrapper. Instantiates graceful shutdowns for BullMQ workers and Redis connections on process signals (`SIGINT`, `SIGTERM`).

### 6.4. Database ORM Foundation (`prisma/`)
* **[schema.prisma](file:///c:/Users/Vibin.Cariappa/Desktop/Credentia/backend/prisma/schema.prisma):** Foundational configuration defining standard PostgreSQL datasource and generator.
* **[seed.js](file:///c:/Users/Vibin.Cariappa/Desktop/Credentia/backend/prisma/seed.js):** Data populator runner template placeholder.

### 6.5. Infrastructure Services (`src/services/`)
* **[storage.service.js](file:///c:/Users/Vibin.Cariappa/Desktop/Credentia/backend/src/services/storage/storage.service.js):** Wraps storage operations (signed URLs, moves, deletes) executing against Supabase buckets.

### 6.6. Background Processing & Workers Layer (`src/jobs/`)
* **[audit.queue.js](file:///c:/Users/Vibin.Cariappa/Desktop/Credentia/backend/src/jobs/queues/audit.queue.js):** Asynchronous transaction logging publisher client. Runs on mock objects if `REDIS_ENABLED` is false.
* **[notification.queue.js](file:///c:/Users/Vibin.Cariappa/Desktop/Credentia/backend/src/jobs/queues/notification.queue.js):** Alert and mailer job publisher client.
* **[preview.queue.js](file:///c:/Users/Vibin.Cariappa/Desktop/Credentia/backend/src/jobs/queues/preview.queue.js):** Low-res preview generation job publisher client.
* **[report.queue.js](file:///c:/Users/Vibin.Cariappa/Desktop/Credentia/backend/src/jobs/queues/report.queue.js):** Large spreadsheet compilation job publisher client.
* **[scheduler.queue.js](file:///c:/Users/Vibin.Cariappa/Desktop/Credentia/backend/src/jobs/queues/scheduler.queue.js):** Sweeper and lock cleanup cron publisher client.
* **[virus.queue.js](file:///c:/Users/Vibin.Cariappa/Desktop/Credentia/backend/src/jobs/queues/virus.queue.js):** Upload drafting scan job publisher client.
* **[audit.worker.js](file:///c:/Users/Vibin.Cariappa/Desktop/Credentia/backend/src/jobs/workers/audit.worker.js):** Consumer thread executing audit logs database writes.
* **[notification.worker.js](file:///c:/Users/Vibin.Cariappa/Desktop/Credentia/backend/src/jobs/workers/notification.worker.js):** Consumer thread dispatching mailers and WebSockets alerts.
* **[preview.worker.js](file:///c:/Users/Vibin.Cariappa/Desktop/Credentia/backend/src/jobs/workers/preview.worker.js):** Consumer thread running rendering thumbnails.
* **[report.worker.js](file:///c:/Users/Vibin.Cariappa/Desktop/Credentia/backend/src/jobs/workers/report.worker.js):** Consumer thread rendering CSV metrics sheets.
* **[scheduler.worker.js](file:///c:/Users/Vibin.Cariappa/Desktop/Credentia/backend/src/jobs/workers/scheduler.worker.js):** Consumer thread sweeping expired database check-out locks.
* **[virus.worker.js](file:///c:/Users/Vibin.Cariappa/Desktop/Credentia/backend/src/jobs/workers/virus.worker.js):** Consumer thread executing upload file antivirus evaluations.
* **[index.js](file:///c:/Users/Vibin.Cariappa/Desktop/Credentia/backend/src/jobs/index.js):** Consolidated queues and workers registry, managing unified cluster shutdowns.

### 6.7. Authentication Layer (`src/auth/`, `src/middleware/`)
* **[auth.service.js](file:///c:/Users/Vibin.Cariappa/Desktop/Credentia/backend/src/auth/auth.service.js):** Core service handling business workflows, DTOs, constants, and direct Prisma DB queries.
* **[auth.routes.js](file:///c:/Users/Vibin.Cariappa/Desktop/Credentia/backend/src/auth/auth.routes.js):** Express routing boundaries, Zod validator schemas, cookie setters, token parsers, and HTTP controller request handlers.
* **[auth.middleware.js](file:///c:/Users/Vibin.Cariappa/Desktop/Credentia/backend/src/middleware/auth.middleware.js):** Custom authentication and role access validation filters.

### 6.8. Users Layer (`src/users/`, `src/controllers/`, `src/repositories/`, `src/utils/`)
* **[users.service.js](file:///c:/Users/Vibin.Cariappa/Desktop/Credentia/backend/src/users/users.service.js):** Core service handling business capabilities, DTOs, and constants.
* **[users.routes.js](file:///c:/Users/Vibin.Cariappa/Desktop/Credentia/backend/src/users/users.routes.js):** Express routing boundaries with Zod validator schemas.
* **[users.controller.js](file:///c:/Users/Vibin.Cariappa/Desktop/Credentia/backend/src/controllers/users.controller.js):** Interface controller routing requests to service functions.
* **[users.repository.js](file:///c:/Users/Vibin.Cariappa/Desktop/Credentia/backend/src/repositories/users.repository.js):** User account querying and database updates logic.
* **[users.util.js](file:///c:/Users/Vibin.Cariappa/Desktop/Credentia/backend/src/utils/users.util.js):** User mapper transformations converting db profiles to Response DTOs.

### 6.9. Roles Layer (`src/roles/`, `src/controllers/`, `src/repositories/`, `src/utils/`)
* **[roles.service.js](file:///c:/Users/Vibin.Cariappa/Desktop/Credentia/backend/src/roles/roles.service.js):** Core service handling business capabilities, DTOs, and constants.
* **[roles.routes.js](file:///c:/Users/Vibin.Cariappa/Desktop/Credentia/backend/src/roles/roles.routes.js):** Express routing boundaries with Zod validator schemas.
* **[roles.controller.js](file:///c:/Users/Vibin.Cariappa/Desktop/Credentia/backend/src/controllers/roles.controller.js):** Interface controller routing requests to service functions.
* **[roles.repository.js](file:///c:/Users/Vibin.Cariappa/Desktop/Credentia/backend/src/repositories/roles.repository.js):** Role settings querying and database updates logic.
* **[roles.util.js](file:///c:/Users/Vibin.Cariappa/Desktop/Credentia/backend/src/utils/roles.util.js):** Role mapper transformations converting db configurations to Response DTOs.

### 6.10. Permissions Layer (`src/permissions/`, `src/controllers/`, `src/repositories/`, `src/utils/`)
* **[permissions.service.js](file:///c:/Users/Vibin.Cariappa/Desktop/Credentia/backend/src/permissions/permissions.service.js):** Core service handling business capabilities, DTOs, and constants.
* **[permissions.routes.js](file:///c:/Users/Vibin.Cariappa/Desktop/Credentia/backend/src/permissions/permissions.routes.js):** Express routing boundaries with Zod validator schemas.
* **[permissions.controller.js](file:///c:/Users/Vibin.Cariappa/Desktop/Credentia/backend/src/controllers/permissions.controller.js):** Interface controller routing requests to service functions.
* **[permissions.repository.js](file:///c:/Users/Vibin.Cariappa/Desktop/Credentia/backend/src/repositories/permissions.repository.js):** Permission actions querying and database updates logic.
* **[permissions.util.js](file:///c:/Users/Vibin.Cariappa/Desktop/Credentia/backend/src/utils/permissions.util.js):** Permission mapper transformations converting db configurations to Response DTOs.

### 6.11. Sessions Layer (`src/sessions/`, `src/controllers/`, `src/repositories/`, `src/utils/`)
* **[sessions.service.js](file:///c:/Users/Vibin.Cariappa/Desktop/Credentia/backend/src/sessions/sessions.service.js):** Core service handling business capabilities, DTOs, and constants.
* **[sessions.routes.js](file:///c:/Users/Vibin.Cariappa/Desktop/Credentia/backend/src/sessions/sessions.routes.js):** Express routing boundaries with Zod validator schemas.
* **[sessions.controller.js](file:///c:/Users/Vibin.Cariappa/Desktop/Credentia/backend/src/controllers/sessions.controller.js):** Interface controller routing requests to service functions.
* **[sessions.repository.js](file:///c:/Users/Vibin.Cariappa/Desktop/Credentia/backend/src/repositories/sessions.repository.js):** Session settings querying and database updates logic.
* **[sessions.util.js](file:///c:/Users/Vibin.Cariappa/Desktop/Credentia/backend/src/utils/sessions.util.js):** Session mapper transformations and user-agent parsing logic.

### 6.12. RBAC Layer (`src/rbac/`, `src/middleware/`)
* **[rbac.service.js](file:///c:/Users/Vibin.Cariappa/Desktop/Credentia/backend/src/rbac/rbac.service.js):** Core role/permission resolution services, permission caching, and constant mappings.
* **[auth.middleware.js](file:///c:/Users/Vibin.Cariappa/Desktop/Credentia/backend/src/middleware/auth.middleware.js):** Consolidated Express guards (`requireAuth`, `requireSession`, `requireRole`, `requirePermission`).
* **[README.md](file:///c:/Users/Vibin.Cariappa/Desktop/Credentia/backend/src/rbac/README.md):** Module architecture LLD documentation.

### 6.13. Devices Layer (`src/devices/`, `src/controllers/`, `src/repositories/`, `src/utils/`)
* **[devices.service.js](file:///c:/Users/Vibin.Cariappa/Desktop/Credentia/backend/src/devices/devices.service.js):** Core service handling business capabilities, DTOs, and constants.
* **[devices.routes.js](file:///c:/Users/Vibin.Cariappa/Desktop/Credentia/backend/src/devices/devices.routes.js):** Express routing boundaries with Zod validator schemas.
* **[devices.controller.js](file:///c:/Users/Vibin.Cariappa/Desktop/Credentia/backend/src/controllers/devices.controller.js):** Interface controller routing requests to service functions.
* **[devices.repository.js](file:///c:/Users/Vibin.Cariappa/Desktop/Credentia/backend/src/repositories/devices.repository.js):** Session mapping queries to represent Devices.
* **[devices.util.js](file:///c:/Users/Vibin.Cariappa/Desktop/Credentia/backend/src/utils/devices.util.js):** Device mapper transformations converting db profiles to Response DTOs.

### 6.14. Identity Activity Layer (`src/identity-activity/`, `src/controllers/`, `src/repositories/`, `src/utils/`)
* **[identity-activity.service.js](file:///c:/Users/Vibin.Cariappa/Desktop/Credentia/backend/src/identity-activity/identity-activity.service.js):** Core service handling business capabilities, DTOs, and constants.
* **[identity-activity.routes.js](file:///c:/Users/Vibin.Cariappa/Desktop/Credentia/backend/src/identity-activity/identity-activity.routes.js):** Express routing boundaries with Zod validator schemas.
* **[identity-activity.controller.js](file:///c:/Users/Vibin.Cariappa/Desktop/Credentia/backend/src/controllers/identity-activity.controller.js):** Interface controller routing requests to service functions.
* **[identity-activity.repository.js](file:///c:/Users/Vibin.Cariappa/Desktop/Credentia/backend/src/repositories/identity-activity.repository.js):** AuditLog querying for authentication activities.
* **[identity-activity.util.js](file:///c:/Users/Vibin.Cariappa/Desktop/Credentia/backend/src/utils/identity-activity.util.js):** Activity mapper transformations converting db logs to DTOs.

---

## 7. Core Database Architecture Concepts

### 7.1. How Prisma Generates SQL
Prisma does not execute query parsing dynamically on the Node.js event loop thread. Instead, queries (e.g. `prisma.user.findMany()`) are compiled into an Abstract Syntax Tree (AST) inside Node.js. This AST is sent directly to Prisma's internal query engine compiled in **Rust**. The engine maps the AST against the schema mapping targets and translates it into highly optimized, parameterized native SQL queries, executing them against PostgreSQL and returning hydrated JSON back.

### 7.2. Why Prisma Client Should Be a Singleton
Prisma Client instantiates database connection pools internally. If you call `new PrismaClient()` across multiple files or routes, you create separate pools. Under load, these redundant pools quickly exceed PostgreSQL's `max_connections` limit, causing connections to drop. Utilizing a singleton exports a single connection instance reused globally.

### 7.3. How Migrations Work
* **migrate dev:** Compares the structural state of `schema.prisma` against your local PostgreSQL instance, generates a timestamped `.sql` migration file tracking DDL modifications, updates the local tables, and logs execution in `_prisma_migrations`.
* **migrate deploy:** Used in production pipelines. It skips comparison checks and runs pending, pre-generated SQL migration scripts sequentially to prevent production state drifts.

### 7.4. When to Use Transactions
Transactions are required to enforce database **atomicity (ACID)**—guaranteeing that either *all* SQL writes in a sequence execute successfully, or *none* of them do:
* **Race Conditions:** When checking out files, we execute a read check (`isLocked === false`) followed by a write update (`isLocked = true`). This must run in a database transaction block to prevent concurrent clients from claiming the same lock.
* **Atomic Writes:** Modifying metadata alongside tracking audit history logs. If database connections drop midway, the transaction rolls back changes to prevent incomplete telemetry logs.

### 7.5. Metadata vs Blob Binaries Allocation
Relational databases are optimized for low-latency queries, indexing, and joining structured tables. Storing large binary payloads (blobs, PDFs, images) inside SQL tables creates massive storage sizes, degrades buffer pool cache performance, and slows down database backups. Storing raw metadata logs (file sizes, keys, locking parameters) in PostgreSQL keeps database lookups fast, while Supabase Storage handles low-cost binary storage and CDN caching.

---

## 8. Supabase Infrastructure Layer Concepts

### 8.1. Decoupling Supabase from Application Business Logic
Supabase provides core cloud infrastructure services (authentication interfaces, raw S3 bucket API proxies). Our backend encapsulates these services within standard application wrapper layers (e.g., `StorageService`). This decouples Supabase's specific SDK formats from our business logic services. If we migrate to an alternative S3 provider (like AWS S3 or MinIO) in the future, we only swap the implementation inside `StorageService` without rewriting core business workflows.

### 8.2. Service Role Key vs Anon Key
* **Anon Key:** A public API key safe to distribute to client browsers. Requests made with this key are strictly checked against database **Row Level Security (RLS)** policies and storage bucket access rules.
* **Service Role Key:** An administrative bypass key that overrides all security checks and RLS parameters. It grants complete read/write/delete permissions across all databases and buckets.

### 8.3. Why the Backend Owns the Service Role Key
The `Service Role Key` possesses absolute privileges. If exposed to client applications, attackers could read, modify, or delete any record or file. The backend serves as the secure vault that stores this key, wrapping operations (such as validating file checks and deleting database assets) behind restricted API routes.

### 8.4. Direct-to-Storage Uploads via Signed URLs
Routing large binary uploads (e.g., 50MB PDF document packets) through the Express application has significant performance costs:
* **Memory and CPU Overhead:** Node.js must buffer or stream chunk buffers, causing high memory spikes and event loop blocking on the main thread.
* **Bandwidth Bottlenecks:** The server pays double the bandwidth costs (receiving the file from the client, then uploading it to S3).

Instead, the client calls the backend to request a `signed upload URL`. This URL contains a short-lived cryptographic signature allowing the browser to PUT the binary file directly to Supabase S3 storage. Once finished, the browser registers the file path with the backend. This keeps the backend fast and responsive.

### 8.5. Enterprise Document Bucket Organization
For enterprise scalability, files are segregated into distinct buckets based on their access permissions, lifecycle logs, and performance needs:
1. **`mc-documents` (Private, Strict Access):** Houses master document PDFs and original credentials. Runs under strict RLS rules, requiring backend signed URLs to download.
2. **`mc-previews` (Optimized, Public Cache):** Contains low-resolution image thumbnails and previews generated by background workers. Configured with public read access and long CDN caching rules to speed up dashboard loads.
3. **`mc-audits-archive` (Worm/Cold Storage):** Retains zipped annual audit trails and access sheets. Configured with cold-storage pricing tiers and strict retention rules to prevent deletion.

---

## 9. Background Job Broker Layer (Redis & BullMQ)

### 9.1. Decoupled Processing Architecture
Time-consuming operations (calculating antivirus hashes, rendering thumb slides, archiving tables) must never run on the Node.js primary thread. Doing so blocks the single event loop, causing requests to time out. Utilizing BullMQ backed by Redis creates an asynchronous broker where background jobs are enqueued as metadata payloads. Decoupled worker containers poll these queues and process jobs independently, maintaining HTTP server availability.

### 9.2. Connection Lifecycle & Graceful Shutdown Strategy
To mitigate this, `handleGracefulShutdown` intercepts OS signals (`SIGTERM`, `SIGINT`), closes the HTTP server, and invokes `shutdownQueuesAndWorkers()`. This stops workers from pulling new jobs while allowing active jobs to finish within a 10-second safety window, ensuring no jobs are lost or corrupted.

---

## 10. Module-Specific Low-Level Design (LLD)

### 10.1. Device Management Module
This module maps active device profiles directly onto user active database `sessions` persistence records, adhering strictly to the **Consolidated Directory Architecture** guidelines.

#### Associated Files (Directory Structure)
```text
src/
├── devices/
│   └── (README.md consolidated here)
├── controllers/
│   └── security.controller.js   # Controller handling HTTP request/responses
├── routes/
│   └── security.routes.js       # Express route bindings and Zod validation schemas
├── services/
│   └── security.service.js      # Core business logic, DTOs, and constants
└── utils/
    └── security.util.js         # Device entity mapper utility (deviceMapper)
```

#### Architectural Flows
##### 1. Route Validation & Processing
1. Authenticated users submit requests to endpoints mapped in `routes/security.routes.js`.
2. Inline validation schemas verify payload parameters.
3. If payload validation fails, a standardized `VALIDATION_ERROR` response is returned immediately.
4. If successful, control moves to the corresponding method in `controllers/security.controller.js`.

##### 2. Service Logic and Repository Layer
1. The controller method calls matching actions in `services/security.service.js`.
2. The service acts as the business orchestrator, querying database rows on the `Session` model via `repositories/security.repository.js`.
3. The database outputs are sanitized via `security.util.js` (`deviceMapper`) to output clean response payloads via `DeviceResponseDto`.

#### Mapped Endpoints
| Endpoint | Method | Middleware | Payload Validation | Description |
|---|---|---|---|---|
| `/api/v1/devices/` | `GET` | `requireAuth`, `requireSession` | None | Lists active user device profiles |
| `/api/v1/devices/:id/trust` | `PATCH` | `requireAuth`, `requireSession` | `trustDeviceSchema` | Sets the trust status flag on a device |
| `/api/v1/devices/:id` | `DELETE` | `requireAuth`, `requireSession` | `revokeDeviceSchema` | Revokes the device and logs out the session |

---

### 10.2. Identity Activity Module
This module maps authentication activities directly onto user active database `audit_logs` records, adhering strictly to the **Consolidated Directory Architecture** guidelines.

#### Associated Files (Directory Structure)
```text
src/
├── identity-activity/
│   └── (README.md consolidated here)
├── controllers/
│   └── security.controller.js         # Controller handling HTTP request/responses
├── routes/
│   └── security.routes.js             # Express route bindings and Zod validation schemas
├── services/
│   └── security.service.js            # Core business logic, DTOs, and constants
└── utils/
    └── security.util.js               # Identity activity mapper (activityMapper)
```

#### Architectural Flows
##### 1. Route Validation & Processing
1. Authenticated users submit requests to endpoints mapped in `routes/security.routes.js`.
2. Inline validation schemas verify query pagination params.
3. If validation fails, a standardized `VALIDATION_ERROR` response is returned.
4. If successful, control moves to the corresponding method in `controllers/security.controller.js`.

##### 2. Service Logic and Repository Layer
1. The controller method calls matching actions in `services/security.service.js`.
2. The service queries database rows on the `AuditLog` model via `repositories/security.repository.js`.
3. The database outputs are sanitized via `security.util.js` (`activityMapper`) to output clean response payloads via `ActivityResponseDto`.

#### Mapped Endpoints
| Endpoint | Method | Middleware | Payload Validation | Description |
|---|---|---|---|---|
| `/api/v1/identity-activity/` | `GET` | `requireAuth`, `requireSession` | `listActivitiesSchema` | Lists paginated auth activities for the user |

---

### 10.3. Permissions Management Module
This module manages custom system security permission definitions, adhering strictly to the **Consolidated Directory Architecture** guidelines.

#### Associated Files (Directory Structure)
```text
src/
├── permissions/
│   └── (README.md consolidated here)
├── controllers/
│   └── security.controller.js   # Controller handling HTTP request/responses
├── routes/
│   └── security.routes.js       # Express route bindings and Zod validation schemas
├── services/
│   └── security.service.js      # Core business logic, DTOs, and constants
├── repositories/
│   └── security.repository.js   # Prisma data persistence layer for Permission tables
└── utils/
    └── security.util.js         # Permission entity mapper utilities (permissionMapper)
```

#### Architectural Flows
##### 1. Route Validation & Processing
1. Administrators submit requests to endpoints mapped in `routes/security.routes.js`.
2. Inline validation schemas verify payload parameters.
3. If payload validation fails, a standardized `VALIDATION_ERROR` response is returned immediately.
4. If successful, control moves to the corresponding method in `controllers/security.controller.js`.

##### 2. Service Logic and Repository Layer
1. The controller method calls matching actions in `services/security.service.js`.
2. The service acts as the business orchestrator, querying `repositories/security.repository.js`.
3. The database outputs are sanitized via `security.util.js` (`permissionMapper`) to output clean response payloads via `PermissionResponseDto`.

#### Mapped Endpoints
| Endpoint | Method | Middleware | Payload Validation | Description |
|---|---|---|---|---|
| `/api/v1/permissions/` | `POST` | `requireAuth`, `requireRole` | `createPermissionSchema` | Registers a custom permission |
| `/api/v1/permissions/` | `GET` | `requireAuth`, `requireRole` | `listPermissionsSchema` | Lists registered permissions |
| `/api/v1/permissions/assign` | `POST` | `requireAuth`, `requireRole` | `assignPermissionSchema` | Binds a permission to a role |
| `/api/v1/permissions/:id` | `GET` | `requireAuth`, `requireRole` | `permissionIdParamSchema` | Retrieves details for a specific permission |
| `/api/v1/permissions/:id` | `PUT` | `requireAuth`, `requireRole` | `updatePermissionSchema` | Modifies configuration details of a permission |
| `/api/v1/permissions/:id` | `DELETE` | `requireAuth`, `requireRole` | `permissionIdParamSchema` | Purges a custom permission definition |

---

### 10.4. Role-Based Access Control (RBAC) Module
This module handles core role/permission resolution, constants, and cached access checks, pushing reusable middleware guards to standard top-level layers.

#### Associated Files (Directory Structure)
```text
src/
├── rbac/
│   └── (README.md consolidated here)
├── middleware/
│   └── auth.middleware.js       # Reusable middleware filters (requireAuth, requireSession, requireRole, requirePermission)
├── services/
│   └── security.service.js      # Core role/permission resolution, constants, and caching
```

#### Architectural Flows
##### 1. Request Authentication (`requireAuth`)
1. Users provide JWT access tokens in the `Authorization` header.
2. The middleware authenticates the token context via Supabase `auth.getUser()`, binding the verified user payload context.

##### 2. Session Integrity (`requireSession`)
1. Resolves the database sessions mapping list for the user.
2. Confirms the user has at least one active, non-revoked session record in the local database.

##### 3. Access Controls (`requireRole` & `requirePermission`)
1. Evaluates user roles or compiles effective permissions via `PermissionResolutionService`.
2. Employs a TTL-based memory caching utility to avoid redundant database reads.
3. Automatically maps Super Admin wildcard flags (`*`) to bypass security check hooks.

---

### 10.5. Roles Management Module
This module manages security roles and bindings, adhering strictly to the **Consolidated Directory Architecture** guidelines.

#### Associated Files (Directory Structure)
```text
src/
├── roles/
│   ├── roles.service.js         # Core business logic, DTOs, and constants
├── controllers/
│   └── security.controller.js   # Controller handling HTTP request/responses
├── routes/
│   └── security.routes.js       # Express route bindings and Zod validation schemas
├── repositories/
│   └── security.repository.js   # Prisma data persistence layer for Role tables
└── utils/
    └── security.util.js         # Role entity mapper utilities (roleMapper)
```

#### Architectural Flows
##### 1. Route Validation & Processing
1. Administrators submit requests to endpoints mapped in `routes/security.routes.js`.
2. Inline validation schemas verify payload parameters.
3. If payload validation fails, a standardized `VALIDATION_ERROR` response is returned immediately.
4. If successful, control moves to the corresponding method in `controllers/security.controller.js`.

##### 2. Service Logic and Repository Layer
1. The controller method calls matching actions in `services/roles.service.js`.
2. The service acts as the business orchestrator, querying `repositories/security.repository.js`.
3. The database outputs are sanitized via `security.util.js` (`roleMapper`) to output clean response payloads via `RoleResponseDto`.

#### Mapped Endpoints
| Endpoint | Method | Middleware | Payload Validation | Description |
|---|---|---|---|---|
| `/api/v1/roles/` | `POST` | `requireAuth`, `requireRole` | `createRoleSchema` | Registers a custom role profile |
| `/api/v1/roles/` | `GET` | `requireAuth`, `requireRole` | `listRolesSchema` | Lists registered role configs |
| `/api/v1/roles/assign` | `POST` | `requireAuth`, `requireRole` | `assignRoleSchema` | Binds a role to a user profile |
| `/api/v1/roles/:id` | `GET` | `requireAuth`, `requireRole` | `roleIdParamSchema` | Retrieves details for a specific role |
| `/api/v1/roles/:id` | `PUT` | `requireAuth`, `requireRole` | `updateRoleSchema` | Modifies configuration details of a role |
| `/api/v1/roles/:id` | `DELETE` | `requireAuth`, `requireRole` | `roleIdParamSchema` | Purges a custom role config |

---

### 10.6. Folder & Vault Domain
This module manages vaults and folders (nested directories), adhering strictly to BCD-FSS guidelines.

#### Associated Files (Directory Structure)
```text
src/
├── controllers/
│   └── vault.controller.js      # Controller handling HTTP requests/responses
├── routes/
│   └── vault.routes.js          # Express route bindings and Zod validation schemas
├── services/
│   └── vault.service.js         # Core folder hierarchy rules and operations logic
├── repositories/
│   └── vault.repository.js      # Prisma data persistence layer for Vault/Folder
├── utils/
│   └── vault.util.js            # Path normalization, tree building, and depth check helpers
└── validations/
    └── vault.validation.js      # Vault and Folder Zod validation schemas
```

#### Architectural Flows
##### 1. Route Validation & Processing
1. Users submit requests to endpoints mapped in `routes/vault.routes.js`.
2. Zod validation schemas verify payload parameters.
3. If payload validation fails, a standardized `VALIDATION_ERROR` response is returned immediately.
4. If successful, control moves to `controllers/vault.controller.js`.

##### 2. Service Logic and Repository Layer
1. The controller calls the corresponding method in `services/vault.service.js`.
2. The service enforces circular parent loop checks, folder name uniqueness under same parent, depth constraints, path propagation for renamed/moved folders, and soft-delete cascades.
3. The service delegates database mutations to `repositories/vault.repository.js`.

#### Mapped Endpoints
| Endpoint | Method | Middleware | Payload Validation | Description |
|---|---|---|---|---|
| `/api/v1/vaults` | `POST` | `requireAuth`, `requireSession` | `createVaultSchema` | Registers a new Vault storage root |
| `/api/v1/vaults` | `GET` | `requireAuth`, `requireSession` | `listVaultsSchema` | Lists registered Vault configurations |
| `/api/v1/vaults/:id` | `GET` | `requireAuth`, `requireSession` | `idParamSchema` | Retrieves details for a specific Vault |
| `/api/v1/vaults/:id` | `PATCH` | `requireAuth`, `requireSession` | `updateVaultSchema` | Modifies configuration details of a Vault |
| `/api/v1/vaults/:id` | `DELETE` | `requireAuth`, `requireSession` | `idParamSchema` | Soft-deletes a Vault and its children |
| `/api/v1/vaults/:id/archive` | `PATCH` | `requireAuth`, `requireSession` | `idParamSchema` | Archives an active Vault |
| `/api/v1/vaults/:id/restore` | `PATCH` | `requireAuth`, `requireSession` | `idParamSchema` | Restores an archived Vault |
| `/api/v1/folders` | `POST` | `requireAuth`, `requireSession` | `createFolderSchema` | Creates a folder under parent directory |
| `/api/v1/folders/:id` | `GET` | `requireAuth`, `requireSession` | `idParamSchema` | Retrieves folder details |
| `/api/v1/folders/:id/tree` | `GET` | `requireAuth`, `requireSession` | `idParamSchema` | Generates hierarchical folder tree of vault |
| `/api/v1/folders/:id/breadcrumb` | `GET` | `requireAuth`, `requireSession` | `idParamSchema` | Computes breadcrumb path of folder to root |
| `/api/v1/folders/:id/contents` | `GET` | `requireAuth`, `requireSession` | `idParamSchema` | Lists folders and documents inside directory |
| `/api/v1/folders/:id` | `PATCH` | `requireAuth`, `requireSession` | `renameFolderSchema` | Renames a folder and propagates path changes |
| `/api/v1/folders/:id/move` | `PATCH` | `requireAuth`, `requireSession` | `moveFolderSchema` | Moves folder and its descendants under new parent |
| `/api/v1/folders/:id/restore` | `PATCH` | `requireAuth`, `requireSession` | `idParamSchema` | Restores soft-deleted folder and sub-elements |
| `/api/v1/folders/:id` | `DELETE` | `requireAuth`, `requireSession` | `idParamSchema` | Soft-deletes folder and all its descendants |

---

### 10.7. Document Management Module
This module handles Document metadata operations, lifecycle state machines, validations, REST APIs, document uploads, and database accessor mappings.

#### Associated Files (Directory Structure)
```text
src/
├── controllers/
│   └── documents.controller.js  # Controller handling HTTP requests/responses
├── routes/
│   └── documents.routes.js      # Express route bindings and Zod validation schemas
├── services/
│   ├── documents.service.js     # Business rules validation, lifecycle transitions, and DTO mappings
│   └── lifecycle.service.js     # Document expiry scanners, auto-archival policies, and compliance cleanup tasks
├── repositories/
│   └── documents.repository.js  # Prisma persistence handler for Document records
├── validations/
│   └── documents.validation.js  # Document Zod validation schemas
└── middleware/
    └── upload.middleware.js     # Multipart form file parser and size/extension validators
```

#### Architectural Flows
##### 1. Route Validation & Processing
1. Users submit requests to endpoints mapped in `routes/documents.routes.js`.
2. Zod validation schemas verify parameters (coercing search parameters and transforming `fileSize` inputs to BigInt fields).
3. For uploads, `upload.middleware.js` intercepts, extracts the files in-memory using `multer`, and runs size and type safety checks.
4. If payload validation fails, a standardized `VALIDATION_ERROR` response is returned immediately.
5. If successful, control moves to `controllers/documents.controller.js`.

##### 2. Service Logic and Repository Layer
1. The controller calls the corresponding method in `services/documents.service.js`.
2. The service enforces BCD-FSS lifecycle transitions, checks folder-uniqueness boundaries, tag normalization, and validates Vault/Folder/Owner existences.
3. For uploads, it generates unique pathing, checks duplicate policies, uploads binaries to Supabase Storage, and registers metadata in PostgreSQL.
4. **Atomic rollback handling**: If database registry fails, it deletes the uploaded storage object to prevent orphaned files.
5. The service delegates database mutations to `repositories/documents.repository.js`.
6. Outputs are mapped to `DocumentResponseDto` objects.

#### Mapped Endpoints
| Endpoint | Method | Middleware | Payload Validation | Description |
|---|---|---|---|---|
| `/api/v1/documents` | `POST` | `requireAuth`, `requireSession` | `createDocumentSchema` | Registers a new document metadata profile |
| `/api/v1/documents` | `GET` | `requireAuth`, `requireSession` | `listDocumentsSchema` | Lists and filters documents |
| `/api/v1/documents/search` | `GET` | `requireAuth`, `requireSession` | Query Parameters | Executes advanced search query filters |
| `/api/v1/documents/expiring` | `GET` | `requireAuth`, `requireSession` | None | Lists documents expiring soon |
| `/api/v1/documents/expired` | `GET` | `requireAuth`, `requireSession` | None | Lists expired documents |
| `/api/v1/documents/upload` | `POST` | `requireAuth`, `requireSession`, `uploadMultiple` | Form Metadata Fields | Safely uploads document files & registers details |
| `/api/v1/documents/:id` | `GET` | `requireAuth`, `requireSession` | `idParamSchema` | Retrieves detailed metadata profiles |
| `/api/v1/documents/:id` | `PATCH` | `requireAuth`, `requireSession` | `updateDocumentSchema` | Modifies configuration details of a document |
| `/api/v1/documents/:id` | `DELETE` | `requireAuth`, `requireSession` | `idParamSchema` | Soft-deletes a document |
| `/api/v1/documents/:id/archive` | `PATCH` | `requireAuth`, `requireSession` | `idParamSchema` | Archives an active document |
| `/api/v1/documents/:id/restore` | `PATCH` | `requireAuth`, `requireSession` | `idParamSchema` | Restores a soft-deleted document |
| `/api/v1/documents/:id/extend-expiry` | `PATCH` | `requireAuth`, `requireSession` | `idParamSchema`, `expiryDate` | Extends document compliance expiry date |
| `/api/v1/documents/:id/preview` | `GET` | `requireAuth`, `requireSession` | `idParamSchema` | Resolves expiring inline preview parameters |
| `/api/v1/documents/:id/download` | `GET` | `requireAuth`, `requireSession` | `idParamSchema`, `?version` | Resolves expiring direct download link parameters |
| `/api/v1/documents/:id/access-url` | `GET` | `requireAuth`, `requireSession` | `idParamSchema` | Resolves expiring direct signed URL |

---

### 10.8. Storage Service Module
This module handles all server-side file storage interactions with Supabase Storage, including upload, download, metadata checking, cloning, moving, and signed URL generation.

#### Associated Files (Directory Structure)
```text
src/
├── config/
│   └── supabase.js              # Supabase Client initializations and bucket configuration schemas
├── services/
│   └── storage/
│       └── storage.service.js   # Main Storage wrapper exposing REST APIs on Supabase Storage
└── utils/
    ├── documents.util.js        # Standard path builder utilities (generateDocumentStoragePath)
    └── storage.util.js          # File validators, path sanitizers, checksums, and unique name generators
```

#### Key Architecture Features
* **Centralized Configuration**: Defines rules for `documents`, `signatures`, `reports`, and `temporary` buckets.
* **Standardized Path Layout**: Enforces `documents/department-id/year/month/document-id/version/filename` dynamic storage structure.
* **Security & Sandboxing**: Restricts path traversals (`..`), sanitizes filenames to prevent command injections, and handles duplicate names contextually.
* **Standardized Exception mapping**: Intercepts client exceptions and transforms them to specific application-level `StorageError` codes (`BUCKET_NOT_FOUND`, `OBJECT_NOT_FOUND`, `EXPIRED_SIGNED_URL`, etc.).

---

### 10.9. Document Repository Testing Module
This module implements the automated testing infrastructure validating unit behaviors and integration endpoints of the Document module.

#### Associated Files (Directory Structure)
```text
tests/
├── fixtures/
│   └── documents.fixture.js     # Shared fixtures for users, folders, documents, and departments
├── helpers/
│   └── db.js                    # Database cleanup utilities in correct dependency order
├── mocks/
│   └── storage.mock.js          # Mocks static StorageService operations bypassing Supabase
├── unit/
│   ├── lifecycle.test.js        # Unit tests verifying exiries, scanners, and extensions
│   └── documents.test.js        # Unit tests verifying metadata uploads, duplicate checks, and access urls
└── integration/
    └── documents.routes.test.js # API Integration tests running mock servers and fetching endpoint assertions
```

#### Test Execution Setup
* **Test Command**: `npm test` or `node --test tests/**/*.test.js`
* **Test Isolation**: Employs cleanups on `beforeEach` / `afterEach` routines. Uses local Express app instances dynamically bound to alternate test ports (`5001`). Mocks Supabase getUser bindings to bypass identity provider dependencies.

---

### 10.10. Polymorphic Approval Workflow Module
This module implements a generic, polymorphic multi-step approval workflow system decoupled from specific target resource models.

#### Associated Files (Directory Structure)
```text
src/
├── controllers/
│   └── approval.controller.js    # Express Controller handling HTTP transport logic
├── routes/
│   └── approval.routes.js        # REST routes secured under requireAuth, requireSession, requirePermission
├── services/
│   └── approval.service.js       # Business logic orchestrator handling step transitions and decisions
├── repositories/
│   └── approval.repository.js    # Persistence operations executing Prisma query mutations
├── validations/
│   └── approval.validation.js    # Zod payload structures and query filters validations
└── utils/
    └── approval.util.js          # Reference key generators, durations calculations, and event hooks
```

#### Key Architecture Features
* **Polymorphic Reference System**: Binds requests to any resource type (`CHECKOUT`, `DOCUMENT`, `USER_ACCESS`, `EXTERNAL_SHARE`) using generic `referenceType` and `referenceId` key snap points.
* **Multi-Step Workflows**: Tracks step-by-step sequential approver decisions. Complete workflow fails immediately if any step rejects, or completes if final step is approved.
* **Immutable Audit Trail**: Inserts history event logs for creation, submission, decision states, reassignment, and cancellation. Logs are append-only.
* **Snapshot Storage**: Snapshots requester department/designation and approver credentials to preserve historical telemetry context even if user models update.

#### Mapped Endpoints
| Endpoint | Method | Middleware | Payload Validation | Description |
|---|---|---|---|---|
| `/api/v1/approvals` | `POST` | `requireAuth`, `requireSession`, `APPROVAL_CREATE` | `createApprovalSchema` | Submits/Creates a new approval request |
| `/api/v1/approvals` | `GET` | `requireAuth`, `requireSession`, `APPROVAL_VIEW` | `listApprovalsSchema` | Lists approvals with sorting and pagination |
| `/api/v1/approvals/my-requests` | `GET` | `requireAuth`, `requireSession`, `APPROVAL_VIEW` | `listApprovalsSchema` | List approval requests initiated by the user |
| `/api/v1/approvals/my-pending` | `GET` | `requireAuth`, `requireSession`, `APPROVAL_VIEW` | `listApprovalsSchema` | List pending requests waiting for user decision |
| `/api/v1/approvals/my-history` | `GET` | `requireAuth`, `requireSession`, `APPROVAL_VIEW` | `listApprovalsSchema` | Retrieves completed history logs for the user |
| `/api/v1/approvals/:id` | `GET` | `requireAuth`, `requireSession`, `APPROVAL_VIEW` | `idParamSchema` | Retrieves request details profile |
| `/api/v1/approvals/:id` | `PATCH` | `requireAuth`, `requireSession`, `APPROVAL_UPDATE` | `updateApprovalSchema` | Modifies properties of a draft request |
| `/api/v1/approvals/:id` | `DELETE` | `requireAuth`, `requireSession`, `APPROVAL_MANAGE` | `idParamSchema` | Soft-deletes a request |
| `/api/v1/approvals/:id/submit` | `POST` | `requireAuth`, `requireSession`, `APPROVAL_CREATE` | `idParamSchema` | Submits draft request to PENDING state |
| `/api/v1/approvals/:id/approve` | `POST` | `requireAuth`, `requireSession`, `APPROVAL_APPROVE` | `decisionSchema` | Approves current step of the workflow |
| `/api/v1/approvals/:id/reject` | `POST` | `requireAuth`, `requireSession`, `APPROVAL_REJECT` | `decisionSchema` | Rejects step and completes request as rejected |
| `/api/v1/approvals/:id/cancel` | `POST` | `requireAuth`, `requireSession`, `APPROVAL_CREATE` | `cancelSchema` | Cancels active approval request |
| `/api/v1/approvals/:id/timeline` | `GET` | `requireAuth`, `requireSession`, `APPROVAL_VIEW` | `idParamSchema` | Assembles chronological timeline history logs |

---

### 10.11. Decoupled Digital Signature Module
This module provides a generic, decoupled signature management engine allowing users to sign transactions (such as checkouts, returns, or approval workflows).

#### Associated Files (Directory Structure)
```text
src/
├── controllers/
│   └── signature.controller.js   # Express Controller handling request transport
├── routes/
│   └── signature.routes.js       # REST endpoint routes protected under requireAuth, requireSession, requirePermission
├── services/
│   └── signature.service.js      # Business logic orchestrating uploads, decoding base64, and verification lifecycles
├── repositories/
│   └── signature.repository.js   # Persistence layer querying digital_signatures and signature_histories
├── validations/
│   └── signature.validation.js   # Zod validations for payload creation, queries, parameters
└── utils/
    └── signature.util.js         # Hashing functions (tamper proof hashes), reference number generators, hooks
```

#### Key Architecture Features
* **Generic Reference Mapping**: Binds to any target transaction model (e.g. `CHECKOUT`, `RETURN`, `APPROVAL`, `DOCUMENT`) via polymorphic `referenceType` and `referenceId` bindings.
* **Canvas Base64 Decoding**: Automatically decodes canvas Drawn base64 data payloads, converts them to binary buffers, and uploads them to Supabase Storage.
* **Tamper Proof Cryptography**: Computes and stores SHA-256 signature hashes incorporating `userId`, `referenceId`, `timestamp`, and file checksums.
* **Append-Only Event Logs**: Logs creation, uploads, verification, failures, and revocals in `signature_histories`.

#### Mapped Endpoints
| Endpoint | Method | Middleware | Payload Validation | Description |
|---|---|---|---|---|
| `/api/v1/signatures` | `POST` | `requireAuth`, `requireSession`, `SIGNATURE_CREATE` | `createSignatureSchema` | Creates/Uploads new digital signature |
| `/api/v1/signatures` | `GET` | `requireAuth`, `requireSession`, `SIGNATURE_VIEW` | `listSignaturesSchema` | Lists all signatures (Admin query) |
| `/api/v1/signatures/my` | `GET` | `requireAuth`, `requireSession`, `SIGNATURE_VIEW` | `listSignaturesSchema` | Lists current user's signatures |
| `/api/v1/signatures/reference/:referenceType/:referenceId` | `GET` | `requireAuth`, `requireSession`, `SIGNATURE_VIEW` | `referenceParamsSchema` | Lists signatures attached to reference |
| `/api/v1/signatures/:id` | `GET` | `requireAuth`, `requireSession`, `SIGNATURE_VIEW` | `idParamSchema` | Retrieves signature metadata profile |
| `/api/v1/signatures/:id` | `DELETE` | `requireAuth`, `requireSession`, `SIGNATURE_REVOKE` | `idParamSchema` | Soft deletes / revokes a signature record |
| `/api/v1/signatures/:id/verify` | `POST` | `requireAuth`, `requireSession`, `SIGNATURE_VERIFY` | `idParamSchema`, `verifySignatureSchema` | Verifies and approves a signature (Admin only) |
| `/api/v1/signatures/:id/reject` | `POST` | `requireAuth`, `requireSession`, `SIGNATURE_VERIFY` | `idParamSchema`, `rejectSignatureSchema` | Rejects a signature verification |
| `/api/v1/signatures/:id/revoke` | `POST` | `requireAuth`, `requireSession`, `SIGNATURE_REVOKE` | `idParamSchema`, `revokeSignatureSchema` | Revokes an active verified signature |
| `/api/v1/signatures/:id/history` | `GET` | `requireAuth`, `requireSession`, `SIGNATURE_VIEW` | `idParamSchema` | Assembles chronological timeline history |







