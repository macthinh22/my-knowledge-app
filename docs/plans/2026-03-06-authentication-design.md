# Authentication Design

## Overview

Add username/password authentication to the app. Multi-user, each user owns their own data. JWT access tokens (stateless) + DB-backed refresh tokens (revocable). All users have equal permissions.

## Data Model

### New Tables

**users**

| Column | Type | Notes |
|---|---|---|
| id | UUID | PK, generated |
| username | VARCHAR(50) | unique, indexed |
| password_hash | VARCHAR(255) | bcrypt via passlib |
| created_at | TIMESTAMP | default now |

**refresh_tokens**

| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| user_id | UUID | FK -> users.id |
| token_hash | VARCHAR(255) | SHA-256 hash of the token |
| expires_at | TIMESTAMP | 30 days from creation |
| created_at | TIMESTAMP | default now |

**user_settings**

| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| user_id | UUID | FK -> users.id, unique |
| preferences | JSONB | e.g. `{"theme": "dark"}` |
| updated_at | TIMESTAMP | auto-updated |

### Existing Table Changes

Add `user_id UUID FK -> users.id NOT NULL` to: videos, collections, categories, tags.

## Auth Flow

### Registration

`POST /api/auth/register {username, password}` - validate username uniqueness, hash password (bcrypt), create user + default user_settings row, return access_token + set refresh_token in httpOnly cookie.

### Login

`POST /api/auth/login {username, password}` - verify credentials, generate JWT access token (15 min expiry), generate refresh token (30 days) hashed and stored in DB, return access_token + set refresh_token in httpOnly cookie.

### Token Refresh

`POST /api/auth/refresh` (refresh_token from cookie) - validate against DB, rotate (delete old, issue new), return new access_token.

### Logout

`POST /api/auth/logout` - delete refresh token from DB, clear cookie.

### Request Authentication

FastAPI `Depends(get_current_user)` dependency on all protected endpoints. JWT from `Authorization: Bearer <token>` header. All DB queries scoped by `user_id`.

### Frontend Token Handling

Access token stored in memory (not localStorage). Refresh token in httpOnly cookie. On 401, silently call `/api/auth/refresh`. On refresh failure, redirect to login.

## Backend Changes

### New Files

- `app/routers/auth.py` - register, login, logout, refresh endpoints
- `app/services/auth.py` - password hashing, JWT creation/validation
- `app/dependencies.py` - `get_current_user` dependency

### Modified Files

- `app/models.py` - add User, RefreshToken, UserSettings models + user_id FK to existing models
- `app/schemas.py` - add auth request/response schemas
- All routers (videos, collections, categories, tags, stats) - inject current_user, scope queries by user_id
- `app/main.py` - register auth router

### New Dependencies

- `passlib[bcrypt]` - password hashing
- `python-jose[cryptography]` - JWT encoding/decoding

### New Environment Variables

- `JWT_SECRET_KEY` - for signing JWTs
- `ACCESS_TOKEN_EXPIRE_MINUTES=15`
- `REFRESH_TOKEN_EXPIRE_DAYS=30`

## Frontend Changes

### New Files

- `src/app/login/page.tsx` - login page
- `src/app/register/page.tsx` - registration page
- `src/lib/auth.ts` - token management, refresh logic, auth fetch wrapper

### Modified Files

- `src/lib/api.ts` - wrap API calls with auth headers + auto-refresh on 401
- `src/app/layout.tsx` - auth guard, redirect unauthenticated users to login
- `src/app/dashboard/page.tsx` - show username (optional)

### Route Protection

- Public: `/login`, `/register`
- Protected: everything else

## Migration Strategy

1. Delete all rows from tags, collections, videos, categories (in FK order)
2. Create users, refresh_tokens, user_settings tables
3. Add user_id NOT NULL FK column to videos, collections, categories, tags

DB starts empty. First user registers through the app.
