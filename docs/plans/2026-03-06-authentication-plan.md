# Authentication Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add username/password authentication with JWT access tokens and DB-backed refresh tokens, making all data user-scoped.

**Architecture:** Hand-rolled auth in FastAPI using passlib (bcrypt) + python-jose (JWT). New `users`, `refresh_tokens`, `user_settings` tables. All existing tables get a `user_id` FK. Frontend stores access token in memory, refresh token in httpOnly cookie. Login/register pages added, all other routes protected.

**Tech Stack:** FastAPI, SQLAlchemy, passlib[bcrypt], python-jose[cryptography], Next.js 16, React 19

---

### Task 1: Add Python Auth Dependencies

**Files:**
- Modify: `backend/requirements.txt`

**Step 1: Add dependencies**

Add these lines to `backend/requirements.txt` after the Configuration section:

```
# Auth
passlib[bcrypt]>=1.7.4
python-jose[cryptography]>=3.3.0
```

**Step 2: Install**

Run: `cd backend && pip install -r requirements.txt`

**Step 3: Commit**

```bash
git add backend/requirements.txt
git commit -m "feat(auth): add passlib and python-jose dependencies"
```

---

### Task 2: Add Auth Settings to Config

**Files:**
- Modify: `backend/app/config.py`

**Step 1: Add auth settings to the Settings class**

Add these fields to the `Settings` class in `backend/app/config.py`:

```python
# Auth
jwt_secret_key: str = "CHANGE-ME-IN-PRODUCTION"
access_token_expire_minutes: int = 15
refresh_token_expire_days: int = 30
```

**Step 2: Commit**

```bash
git add backend/app/config.py
git commit -m "feat(auth): add JWT config settings"
```

---

### Task 3: Add User, RefreshToken, UserSettings Models + user_id FK to Existing Models

**Files:**
- Modify: `backend/app/models.py`

**Step 1: Add new models and modify existing ones**

Add these imports at the top of `backend/app/models.py`:

```python
from sqlalchemy import Boolean
from sqlalchemy.dialects.postgresql import JSONB
```

Add these new models **before** the `collection_videos` table:

```python
class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    token_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(nullable=False)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())


class UserSettings(Base):
    __tablename__ = "user_settings"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    preferences: Mapped[dict] = mapped_column(JSONB, nullable=False, server_default="{}")
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now()
    )
```

Add `user_id` to the `Video` model (after `id`):

```python
user_id: Mapped[uuid.UUID] = mapped_column(
    UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
)
```

Add `user_id` to the `VideoJob` model (after `id`):

```python
user_id: Mapped[uuid.UUID] = mapped_column(
    UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
)
```

Add `user_id` to the `Category` model (after `id`):

```python
user_id: Mapped[uuid.UUID] = mapped_column(
    UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
)
```

Change the `Category.slug` unique constraint — slug should be unique **per user**, not globally. Remove `unique=True` from the slug column, and add a table-level unique constraint:

```python
from sqlalchemy import UniqueConstraint

# Add to Category class:
__table_args__ = (UniqueConstraint("user_id", "slug", name="uq_category_user_slug"),)
```

Add `user_id` to the `TagAlias` model (after `id`):

```python
user_id: Mapped[uuid.UUID] = mapped_column(
    UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
)
```

Similarly, update the `TagAlias` unique constraint on `alias` to be per-user:

```python
__table_args__ = (UniqueConstraint("user_id", "alias", name="uq_tagalias_user_alias"),)
```

Remove `unique=True` from `TagAlias.alias`.

Add `user_id` to the `Collection` model (after `id`):

```python
user_id: Mapped[uuid.UUID] = mapped_column(
    UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
)
```

Also, the `Video.youtube_id` unique constraint should become per-user (a different user can save the same YouTube video). Remove `unique=True` from `youtube_id` and add:

```python
# Add to Video class:
__table_args__ = (UniqueConstraint("user_id", "youtube_id", name="uq_video_user_youtube_id"),)
```

**Step 2: Commit**

```bash
git add backend/app/models.py
git commit -m "feat(auth): add User, RefreshToken, UserSettings models and user_id FKs"
```

---

### Task 4: Create Alembic Migration (Wipe Data + Add Auth Tables + Add user_id Columns)

**Files:**
- Create: `backend/alembic/versions/<auto>_add_auth.py` (via alembic)

**Step 1: Generate migration**

Run: `cd backend && alembic revision --autogenerate -m "add auth tables and user_id columns"`

**Step 2: Edit the generated migration**

The autogenerated migration won't handle the data wipe. Edit the `upgrade()` function to:

1. Delete all rows from `collection_videos`, `collections`, `tag_aliases`, `video_jobs`, `videos`, `categories` (in that order, respecting FKs) **before** adding the NOT NULL `user_id` columns.
2. Then let the autogenerated DDL run (create new tables, add columns, update constraints).

The `downgrade()` should drop the new tables and columns (autogenerated should handle this).

**Step 3: Run migration**

Run: `cd backend && alembic upgrade head`
Expected: Migration completes. All old data wiped. New tables created. `user_id` columns added.

**Step 4: Commit**

```bash
git add backend/alembic/
git commit -m "feat(auth): add migration for auth tables and user_id columns"
```

---

### Task 5: Create Auth Service (Password Hashing + JWT)

**Files:**
- Create: `backend/app/services/auth.py`
- Test: `backend/tests/test_auth_service.py`

**Step 1: Write tests**

```python
# backend/tests/test_auth_service.py
import uuid
from datetime import datetime, timedelta

import pytest

from app.services.auth import (
    hash_password,
    verify_password,
    create_access_token,
    decode_access_token,
    hash_refresh_token,
)


def test_password_hash_and_verify():
    password = "testpassword123"
    hashed = hash_password(password)
    assert hashed != password
    assert verify_password(password, hashed)
    assert not verify_password("wrongpassword", hashed)


def test_create_and_decode_access_token():
    user_id = uuid.uuid4()
    token = create_access_token(user_id)
    payload = decode_access_token(token)
    assert payload["sub"] == str(user_id)
    assert "exp" in payload


def test_decode_access_token_expired():
    user_id = uuid.uuid4()
    token = create_access_token(user_id, expires_delta=timedelta(seconds=-1))
    payload = decode_access_token(token)
    assert payload is None


def test_hash_refresh_token():
    token = "some-random-token-string"
    hashed = hash_refresh_token(token)
    assert hashed != token
    assert hash_refresh_token(token) == hashed  # deterministic
```

**Step 2: Run tests to verify they fail**

Run: `cd backend && python -m pytest tests/test_auth_service.py -v`
Expected: FAIL — module not found

**Step 3: Implement auth service**

```python
# backend/app/services/auth.py
import hashlib
import uuid
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(
    user_id: uuid.UUID,
    expires_delta: timedelta | None = None,
) -> str:
    if expires_delta is None:
        expires_delta = timedelta(minutes=settings.access_token_expire_minutes)
    expire = datetime.now(timezone.utc) + expires_delta
    to_encode = {"sub": str(user_id), "exp": expire}
    return jwt.encode(to_encode, settings.jwt_secret_key, algorithm="HS256")


def decode_access_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, settings.jwt_secret_key, algorithms=["HS256"])
    except JWTError:
        return None


def hash_refresh_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()
```

**Step 4: Run tests to verify they pass**

Run: `cd backend && python -m pytest tests/test_auth_service.py -v`
Expected: All PASS

**Step 5: Commit**

```bash
git add backend/app/services/auth.py backend/tests/test_auth_service.py
git commit -m "feat(auth): add auth service with password hashing and JWT"
```

---

### Task 6: Create Auth Dependencies (get_current_user)

**Files:**
- Create: `backend/app/dependencies.py`

**Step 1: Implement dependency**

```python
# backend/app/dependencies.py
import uuid

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import User
from app.services.auth import decode_access_token

security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    token = credentials.credentials
    payload = decode_access_token(token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    return user
```

**Step 2: Commit**

```bash
git add backend/app/dependencies.py
git commit -m "feat(auth): add get_current_user dependency"
```

---

### Task 7: Create Auth Router (Register, Login, Refresh, Logout)

**Files:**
- Create: `backend/app/routers/auth.py`
- Modify: `backend/app/schemas.py` (add auth schemas)

**Step 1: Add auth schemas to `backend/app/schemas.py`**

Add at the end of the file:

```python
class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    username: str
    created_at: datetime


class UserSettingsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    preferences: dict


class UserSettingsUpdate(BaseModel):
    preferences: dict
```

**Step 2: Create auth router**

```python
# backend/app/routers/auth.py
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Response, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user
from app.models import RefreshToken, User, UserSettings
from app.schemas import (
    LoginRequest,
    RegisterRequest,
    TokenResponse,
    UserResponse,
    UserSettingsResponse,
    UserSettingsUpdate,
)
from app.services.auth import (
    create_access_token,
    hash_password,
    hash_refresh_token,
    verify_password,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])

REFRESH_TOKEN_COOKIE = "refresh_token"


async def _create_refresh_token(db: AsyncSession, user_id, response: Response) -> None:
    raw_token = secrets.token_urlsafe(64)
    token_hash = hash_refresh_token(raw_token)
    expires_at = datetime.now(timezone.utc) + timedelta(days=settings.refresh_token_expire_days)

    refresh = RefreshToken(
        user_id=user_id,
        token_hash=token_hash,
        expires_at=expires_at,
    )
    db.add(refresh)
    await db.flush()

    response.set_cookie(
        key=REFRESH_TOKEN_COOKIE,
        value=raw_token,
        httponly=True,
        secure=False,  # set True in production with HTTPS
        samesite="lax",
        max_age=settings.refresh_token_expire_days * 86400,
        path="/api/auth",
    )


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(
    body: RegisterRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.username == body.username))
    if result.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username already taken",
        )

    user = User(
        username=body.username,
        password_hash=hash_password(body.password),
    )
    db.add(user)
    await db.flush()

    user_settings = UserSettings(user_id=user.id, preferences={})
    db.add(user_settings)
    await db.flush()

    await _create_refresh_token(db, user.id, response)
    access_token = create_access_token(user.id)
    await db.commit()

    return TokenResponse(access_token=access_token)


@router.post("/login", response_model=TokenResponse)
async def login(
    body: LoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.username == body.username))
    user = result.scalar_one_or_none()
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password",
        )

    await _create_refresh_token(db, user.id, response)
    access_token = create_access_token(user.id)
    await db.commit()

    return TokenResponse(access_token=access_token)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    raw_token = request.cookies.get(REFRESH_TOKEN_COOKIE)
    if not raw_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No refresh token",
        )

    token_hash = hash_refresh_token(raw_token)
    result = await db.execute(
        select(RefreshToken).where(RefreshToken.token_hash == token_hash)
    )
    stored = result.scalar_one_or_none()

    if stored is None or stored.expires_at < datetime.now(timezone.utc):
        response.delete_cookie(REFRESH_TOKEN_COOKIE, path="/api/auth")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    # Rotate: delete old, create new
    user_id = stored.user_id
    await db.delete(stored)
    await db.flush()

    await _create_refresh_token(db, user_id, response)
    access_token = create_access_token(user_id)
    await db.commit()

    return TokenResponse(access_token=access_token)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    raw_token = request.cookies.get(REFRESH_TOKEN_COOKIE)
    if raw_token:
        token_hash = hash_refresh_token(raw_token)
        result = await db.execute(
            select(RefreshToken).where(RefreshToken.token_hash == token_hash)
        )
        stored = result.scalar_one_or_none()
        if stored:
            await db.delete(stored)
            await db.commit()

    response.delete_cookie(REFRESH_TOKEN_COOKIE, path="/api/auth")


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.get("/settings", response_model=UserSettingsResponse)
async def get_settings(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(UserSettings).where(UserSettings.user_id == current_user.id)
    )
    settings_row = result.scalar_one_or_none()
    if settings_row is None:
        return UserSettingsResponse(preferences={})
    return settings_row


@router.patch("/settings", response_model=UserSettingsResponse)
async def update_settings(
    body: UserSettingsUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(UserSettings).where(UserSettings.user_id == current_user.id)
    )
    settings_row = result.scalar_one_or_none()
    if settings_row is None:
        settings_row = UserSettings(user_id=current_user.id, preferences=body.preferences)
        db.add(settings_row)
    else:
        settings_row.preferences = {**settings_row.preferences, **body.preferences}
    await db.flush()
    await db.refresh(settings_row)
    return settings_row
```

**Step 3: Register auth router in `backend/app/main.py`**

Add import:
```python
from app.routers.auth import router as auth_router
```

Add before other routers:
```python
app.include_router(auth_router)
```

**Step 4: Commit**

```bash
git add backend/app/routers/auth.py backend/app/schemas.py backend/app/main.py
git commit -m "feat(auth): add auth router with register, login, refresh, logout, settings"
```

---

### Task 8: Scope All Backend Routers by user_id

**Files:**
- Modify: `backend/app/routers/videos.py`
- Modify: `backend/app/routers/collections.py`
- Modify: `backend/app/routers/categories.py`
- Modify: `backend/app/routers/tags.py`
- Modify: `backend/app/routers/stats.py`
- Modify: `backend/app/services/video_jobs.py`

**Step 1: Update videos router**

In `backend/app/routers/videos.py`:

Add imports:
```python
from app.dependencies import get_current_user
from app.models import User
```

Add `current_user: User = Depends(get_current_user)` parameter to every endpoint function.

Key changes:
- `create_video`: pass `current_user.id` to `run_video_job`, scope duplicate checks by `user_id`
- `list_videos`: add `.where(Video.user_id == current_user.id)` to the query
- `get_video`: after fetching, verify `video.user_id == current_user.id`
- `get_related_videos`: scope both the target video lookup and candidates by `user_id`
- `update_video`: verify `video.user_id == current_user.id`
- `delete_video`: verify `video.user_id == current_user.id`
- `list_video_jobs`: add `.where(VideoJob.user_id == current_user.id)`
- `get_video_job`: verify `job.user_id == current_user.id`
- `_get_active_job`: add `user_id` parameter and filter
- `_get_or_create_completed_job`: add `user_id` parameter and filter

**Step 2: Update video_jobs service**

In `backend/app/services/video_jobs.py`:

Change `run_video_job(job_id: uuid.UUID)` to `run_video_job(job_id: uuid.UUID, user_id: uuid.UUID)`.

When creating a new `Video`, set `user_id=user_id`.

When looking up existing videos, scope by `user_id`:
```python
existing = await db.execute(
    select(Video).where(Video.youtube_id == job.youtube_id, Video.user_id == user_id)
)
```

When fetching categories for AI analysis, scope by `user_id`:
```python
cats_result = await db.execute(select(Category).where(Category.user_id == user_id))
```

**Step 3: Update collections router**

In `backend/app/routers/collections.py`:

Add `current_user` dependency to all endpoints. When creating a collection, set `user_id=current_user.id`. All queries filter by `user_id`. Ownership checks on get/update/delete.

**Step 4: Update categories router**

In `backend/app/routers/categories.py`:

Add `current_user` dependency. All queries filter by `user_id`. When creating a category, set `user_id=current_user.id`. Uniqueness check scoped by user. The `_DEFAULT_CATEGORY_SLUGS` protection on delete should be per-user or removed (since categories are now user-specific).

**Step 5: Update tags router**

In `backend/app/routers/tags.py`:

Add `current_user` dependency. All video and tag_alias queries filter by `user_id`. Pass `user_id` when creating new `TagAlias` records.

**Step 6: Update stats router**

In `backend/app/routers/stats.py`:

Add `current_user` dependency. All count queries filter by `user_id`.

**Step 7: Commit**

```bash
git add backend/app/routers/ backend/app/services/video_jobs.py
git commit -m "feat(auth): scope all routers and services by user_id"
```

---

### Task 9: Frontend Auth Library (Token Management + Auth Fetch Wrapper)

**Files:**
- Create: `frontend/src/lib/auth.ts`

**Step 1: Implement auth library**

```typescript
// frontend/src/lib/auth.ts
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export async function register(
  username: string,
  password: string,
): Promise<{ access_token: string }> {
  const res = await fetch(`${API_BASE}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? "Registration failed");
  }
  const data = await res.json();
  accessToken = data.access_token;
  return data;
}

export async function login(
  username: string,
  password: string,
): Promise<{ access_token: string }> {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? "Login failed");
  }
  const data = await res.json();
  accessToken = data.access_token;
  return data;
}

export async function refreshAccessToken(): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });
    if (!res.ok) {
      accessToken = null;
      return null;
    }
    const data = await res.json();
    accessToken = data.access_token;
    return data.access_token;
  } catch {
    accessToken = null;
    return null;
  }
}

export async function logout(): Promise<void> {
  await fetch(`${API_BASE}/api/auth/logout`, {
    method: "POST",
    credentials: "include",
  }).catch(() => {});
  accessToken = null;
}

export async function authFetch(
  path: string,
  options?: RequestInit,
): Promise<Response> {
  const doFetch = (token: string | null) =>
    fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options?.headers,
      },
      credentials: "include",
    });

  let res = await doFetch(accessToken);

  if (res.status === 401) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      res = await doFetch(newToken);
    }
  }

  return res;
}
```

**Step 2: Commit**

```bash
git add frontend/src/lib/auth.ts
git commit -m "feat(auth): add frontend auth library with token management"
```

---

### Task 10: Update Frontend API Client to Use Auth

**Files:**
- Modify: `frontend/src/lib/api.ts`

**Step 1: Replace the `request` helper to use `authFetch`**

Replace the existing `request` function in `frontend/src/lib/api.ts`:

```typescript
import { authFetch } from "./auth";

async function request<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const res = await authFetch(path, options);

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ApiError | null;
    throw new ApiRequestError(res.status, body?.detail ?? null);
  }

  if (res.status === 204) return undefined as unknown as T;

  return res.json() as Promise<T>;
}
```

Remove the old `fetch` based `request` function.

**Step 2: Commit**

```bash
git add frontend/src/lib/api.ts
git commit -m "feat(auth): wire API client through auth fetch wrapper"
```

---

### Task 11: Create Login and Register Pages

**Files:**
- Create: `frontend/src/app/login/page.tsx`
- Create: `frontend/src/app/register/page.tsx`

**Step 1: Create login page**

```tsx
// frontend/src/app/login/page.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { login } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(username, password);
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter your credentials to continue
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
          <Input
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
            required
          />
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="font-medium text-foreground hover:underline">
            Register
          </Link>
        </p>
      </div>
    </div>
  );
}
```

**Step 2: Create register page**

```tsx
// frontend/src/app/register/page.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { register } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await register(username, password);
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Create account</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose a username and password
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
          <Input
            placeholder="Username (3+ characters)"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
            required
            minLength={3}
            maxLength={50}
          />
          <Input
            type="password"
            placeholder="Password (8+ characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            maxLength={128}
          />
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Creating account..." : "Create account"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-foreground hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add frontend/src/app/login/ frontend/src/app/register/
git commit -m "feat(auth): add login and register pages"
```

---

### Task 12: Add Auth Guard to Layout

**Files:**
- Create: `frontend/src/context/auth.tsx`
- Modify: `frontend/src/app/layout.tsx`

**Step 1: Create auth context/provider**

```tsx
// frontend/src/context/auth.tsx
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  getAccessToken,
  logout as authLogout,
  refreshAccessToken,
  setAccessToken,
} from "@/lib/auth";

interface AuthContextValue {
  authenticated: boolean;
  loading: boolean;
  username: string | null;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  authenticated: false,
  loading: true,
  username: null,
  logout: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

const PUBLIC_PATHS = ["/login", "/register"];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      if (PUBLIC_PATHS.includes(pathname)) {
        setLoading(false);
        return;
      }

      const existing = getAccessToken();
      if (existing) {
        setAuthenticated(true);
        setLoading(false);
        return;
      }

      const token = await refreshAccessToken();
      if (token) {
        setAuthenticated(true);
        // Fetch username
        try {
          const res = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/auth/me`,
            { headers: { Authorization: `Bearer ${token}` } },
          );
          if (res.ok) {
            const data = await res.json();
            setUsername(data.username);
          }
        } catch {}
      } else {
        router.replace("/login");
      }
      setLoading(false);
    }

    void init();
  }, [pathname, router]);

  const handleLogout = useCallback(async () => {
    await authLogout();
    setAuthenticated(false);
    setUsername(null);
    router.replace("/login");
  }, [router]);

  if (loading && !PUBLIC_PATHS.includes(pathname)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <AuthContext.Provider
      value={{ authenticated, loading, username, logout: handleLogout }}
    >
      {children}
    </AuthContext.Provider>
  );
}
```

**Step 2: Wrap layout with AuthProvider**

In `frontend/src/app/layout.tsx`, import and wrap:

```tsx
import { AuthProvider } from "@/context/auth";

// In the return, wrap children:
<AuthProvider>
  <ExtractionProvider>{children}</ExtractionProvider>
</AuthProvider>
```

**Step 3: Commit**

```bash
git add frontend/src/context/auth.tsx frontend/src/app/layout.tsx
git commit -m "feat(auth): add auth context and route protection"
```

---

### Task 13: Add Logout Button to Dashboard Toolbar

**Files:**
- Modify: `frontend/src/components/DashboardToolbar.tsx`

**Step 1: Add logout button**

Import `useAuth` from `@/context/auth` and add a logout button to the toolbar. Show the username and a "Sign out" button.

**Step 2: Commit**

```bash
git add frontend/src/components/DashboardToolbar.tsx
git commit -m "feat(auth): add logout button to toolbar"
```

---

### Task 14: End-to-End Smoke Test

**Step 1: Start backend**

Run: `cd backend && uvicorn app.main:app --reload --port 8000`

**Step 2: Start frontend**

Run: `cd frontend && npm run dev`

**Step 3: Test registration flow**

1. Navigate to `http://localhost:3000` — should redirect to `/login`
2. Click "Register" link
3. Create account with username `testuser`, password `testpass123`
4. Should redirect to home page
5. All pages should work (dashboard, browse, add video, etc.)

**Step 4: Test login flow**

1. Click logout
2. Should redirect to `/login`
3. Login with `testuser` / `testpass123`
4. Should redirect to home page

**Step 5: Test token refresh**

1. Wait 15 minutes (or temporarily set `ACCESS_TOKEN_EXPIRE_MINUTES=1` for faster testing)
2. Make an API call — should silently refresh and work

**Step 6: Test multi-user isolation**

1. Logout
2. Register a second user
3. Verify they see no data from the first user

**Step 7: Commit any fixes**

```bash
git add -A
git commit -m "fix(auth): address issues found during e2e smoke test"
```
