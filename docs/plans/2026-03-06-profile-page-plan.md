# Profile Page & User Dropdown Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a user dropdown in the toolbar and a profile page with sidebar tabs for categories, collections, settings, and account management.

**Architecture:** Replace the flat toolbar controls with an avatar dropdown menu. Create a `/profile` page with query-param-driven tabs (`?tab=categories|collections|settings|account`). Move category management from `/categories` into the profile page. Add a backend endpoint for password changes.

**Tech Stack:** Next.js 16 (App Router), Radix UI DropdownMenu (already installed), Tailwind CSS 4, FastAPI backend, SQLAlchemy.

---

### Task 1: Backend — Add change password endpoint

**Files:**
- Modify: `backend/app/schemas.py`
- Modify: `backend/app/routers/auth.py`

**Step 1: Add ChangePassword schema to `backend/app/schemas.py`**

Add after `UserSettingsUpdate`:

```python
class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=6)
```

**Step 2: Add PATCH /api/auth/password endpoint to `backend/app/routers/auth.py`**

Add after the `update_settings` endpoint:

```python
@router.patch("/password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(
    body: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not verify_password(body.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )
    current_user.password_hash = hash_password(body.new_password)
    await db.commit()
```

Import `ChangePasswordRequest` in the router imports.

**Step 3: Verify the endpoint works**

Run: `cd backend && python -m pytest tests/ -k auth -v`

**Step 4: Commit**

```
feat(auth): add change password endpoint
```

---

### Task 2: Frontend API — Add changePassword and updateCollection, getSettings, updateSettings

**Files:**
- Modify: `frontend/src/lib/api.ts`

**Step 1: Add the API functions**

Add at the end of `api.ts`:

```typescript
export function changePassword(currentPassword: string, newPassword: string) {
    return request<void>("/api/auth/password", {
        method: "PATCH",
        body: JSON.stringify({
            current_password: currentPassword,
            new_password: newPassword,
        }),
    });
}

export function updateCollection(
    id: string,
    data: { name?: string; description?: string },
) {
    return request<CollectionItem>(`/api/collections/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
    });
}

export interface UserSettings {
    preferences: Record<string, unknown>;
}

export function getSettings() {
    return request<UserSettings>("/api/auth/settings");
}

export function updateSettings(preferences: Record<string, unknown>) {
    return request<UserSettings>("/api/auth/settings", {
        method: "PATCH",
        body: JSON.stringify({ preferences }),
    });
}
```

**Step 2: Commit**

```
feat(api): add changePassword, updateCollection, settings client functions
```

---

### Task 3: Frontend — User Avatar Dropdown in DashboardToolbar

**Files:**
- Modify: `frontend/src/components/DashboardToolbar.tsx`

**Step 1: Replace the username/sign-out/categories section in `DashboardToolbar.tsx`**

Replace the current `<div className="flex items-center gap-1">` block (lines 64-82) with an avatar dropdown:

```tsx
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, Settings, FolderOpen, User, SlidersHorizontal } from "lucide-react";
```

Replace the toolbar right section with:

```tsx
<div className="flex items-center gap-1">
  <Button variant="ghost" size="icon" asChild>
    <Link href="/dashboard" aria-label="Open analytics dashboard">
      <BarChart3 className="h-4 w-4" />
    </Link>
  </Button>
  <ThemeToggle />
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button
        variant="ghost"
        size="icon"
        className="relative h-8 w-8 rounded-full"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
          {username ? username[0].toUpperCase() : "?"}
        </span>
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="w-48">
      <DropdownMenuLabel className="font-normal text-muted-foreground">
        {username ? `@${username}` : "Signed in"}
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuItem asChild>
        <Link href="/profile">
          <User className="mr-2 h-4 w-4" />
          Profile
        </Link>
      </DropdownMenuItem>
      <DropdownMenuItem asChild>
        <Link href="/profile?tab=categories">
          <SlidersHorizontal className="mr-2 h-4 w-4" />
          Categories
        </Link>
      </DropdownMenuItem>
      <DropdownMenuItem asChild>
        <Link href="/profile?tab=collections">
          <FolderOpen className="mr-2 h-4 w-4" />
          Collections
        </Link>
      </DropdownMenuItem>
      <DropdownMenuItem asChild>
        <Link href="/profile?tab=settings">
          <Settings className="mr-2 h-4 w-4" />
          Settings
        </Link>
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={() => void logout()}>
        <LogOut className="mr-2 h-4 w-4" />
        Sign out
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</div>
```

Remove `SlidersHorizontal` from the old imports location and the standalone categories button.

**Step 2: Verify it renders**

Run: `cd frontend && npm run build`

**Step 3: Commit**

```
feat(ui): replace toolbar controls with user avatar dropdown
```

---

### Task 4: Frontend — Profile Page Layout with Sidebar

**Files:**
- Create: `frontend/src/app/profile/page.tsx`

**Step 1: Create the profile page with sidebar navigation and tab routing**

```tsx
"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FolderOpen, Settings, SlidersHorizontal, UserCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CategoriesTab } from "./CategoriesTab";
import { CollectionsTab } from "./CollectionsTab";
import { SettingsTab } from "./SettingsTab";
import { AccountTab } from "./AccountTab";

const TABS = [
  { key: "categories", label: "Categories", icon: SlidersHorizontal },
  { key: "collections", label: "Collections", icon: FolderOpen },
  { key: "settings", label: "Settings", icon: Settings },
  { key: "account", label: "Account", icon: UserCircle },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function ProfilePage() {
  const searchParams = useSearchParams();
  const activeTab = (searchParams.get("tab") as TabKey) || "categories";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b px-6 py-4">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-lg font-semibold">Profile</h1>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-6xl gap-6 px-4 py-6 sm:px-6">
        <nav className="hidden w-48 shrink-0 space-y-1 md:block">
          {TABS.map((tab) => (
            <Link
              key={tab.key}
              href={`/profile?tab=${tab.key}`}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                activeTab === tab.key
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
              )}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </Link>
          ))}
        </nav>

        {/* Mobile tab selector */}
        <div className="mb-4 flex gap-1 overflow-x-auto md:hidden">
          {TABS.map((tab) => (
            <Link
              key={tab.key}
              href={`/profile?tab=${tab.key}`}
              className={cn(
                "flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                activeTab === tab.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground",
              )}
            >
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
            </Link>
          ))}
        </div>

        <main className="min-w-0 flex-1">
          {activeTab === "categories" && <CategoriesTab />}
          {activeTab === "collections" && <CollectionsTab />}
          {activeTab === "settings" && <SettingsTab />}
          {activeTab === "account" && <AccountTab />}
        </main>
      </div>
    </div>
  );
}
```

**Step 2: Create placeholder tab components**

Create `frontend/src/app/profile/CategoriesTab.tsx`, `CollectionsTab.tsx`, `SettingsTab.tsx`, `AccountTab.tsx` as simple placeholder exports:

```tsx
export function CategoriesTab() {
  return <div>Categories (coming next)</div>;
}
```

(Same pattern for each.)

**Step 3: Verify it builds**

Run: `cd frontend && npm run build`

**Step 4: Commit**

```
feat(profile): add profile page layout with sidebar navigation
```

---

### Task 5: Frontend — Categories Tab (move from /categories)

**Files:**
- Modify: `frontend/src/app/profile/CategoriesTab.tsx` (replace placeholder)
- Delete: `frontend/src/app/categories/page.tsx`
- Modify: `frontend/src/components/DashboardToolbar.tsx` (already done in Task 3)

**Step 1: Move the category management content into CategoriesTab**

Copy the entire body of `CategoriesPage` from `frontend/src/app/categories/page.tsx` into `CategoriesTab.tsx`, but:
- Export as `CategoriesTab` (not default export)
- Remove the outer `<div className="min-h-screen bg-background">`, the `<header>` with back button — the profile page already provides those
- Keep everything else: state, handlers, table, dialogs

The component should start from `<main>` content (the error message, the Add button, the table, and the dialogs).

**Step 2: Delete `frontend/src/app/categories/page.tsx`**

**Step 3: Verify no broken imports**

Run: `cd frontend && npm run build`

**Step 4: Commit**

```
feat(profile): move category management into profile categories tab
```

---

### Task 6: Frontend — Collections Tab

**Files:**
- Modify: `frontend/src/app/profile/CollectionsTab.tsx`

**Step 1: Implement CollectionsTab**

Build a management UI that:
- Lists all collections with name, description, video count
- Has a "Create Collection" dialog (name + optional description)
- Has rename/edit functionality via dialog
- Has delete with confirmation dialog

Use the existing API functions: `listCollections`, `createCollection`, `updateCollection`, `deleteCollection`.

The UI pattern should match the categories tab (table with action buttons, dialogs for create/edit, alert dialog for delete).

**Step 2: Verify build**

Run: `cd frontend && npm run build`

**Step 3: Commit**

```
feat(profile): add collections management tab
```

---

### Task 7: Frontend — Settings Tab

**Files:**
- Modify: `frontend/src/app/profile/SettingsTab.tsx`

**Step 1: Implement SettingsTab**

- Include the ThemeToggle component (reuse `@/components/ThemeToggle`)
- Fetch user settings from `getSettings()` on mount
- Allow editing preferences and saving via `updateSettings()`
- Layout: simple card-based sections

For now the settings are minimal — theme is the main one. The preferences JSON from backend can hold future settings.

**Step 2: Verify build**

Run: `cd frontend && npm run build`

**Step 3: Commit**

```
feat(profile): add settings tab with theme toggle
```

---

### Task 8: Frontend — Account Tab

**Files:**
- Modify: `frontend/src/app/profile/AccountTab.tsx`

**Step 1: Implement AccountTab**

- Display current username (from `useAuth()` context)
- Display account creation info
- Change password form: current password, new password, confirm new password
- Calls `changePassword()` from `@/lib/api`
- Show success/error messages

**Step 2: Verify build**

Run: `cd frontend && npm run build`

**Step 3: Commit**

```
feat(profile): add account tab with change password
```

---

### Task 9: Update all remaining links to /categories

**Files:**
- Grep for any remaining `/categories` links in `frontend/src/`

**Step 1: Search and update**

The main link was in `DashboardToolbar.tsx` (already handled in Task 3). Verify no other links exist:

```bash
grep -rn '"/categories"' frontend/src/
```

If the dashboard page or any other file links to `/categories`, update to `/profile?tab=categories`.

**Step 2: Verify build**

Run: `cd frontend && npm run build`

**Step 3: Commit**

```
refactor: update remaining /categories links to profile page
```

---

### Task 10: Final verification and cleanup

**Step 1: Run full frontend build**

```bash
cd frontend && npm run build
```

**Step 2: Run frontend lint**

```bash
cd frontend && npm run lint
```

**Step 3: Run backend tests**

```bash
cd backend && python -m pytest tests/ -v
```

**Step 4: Manual smoke test checklist**

- [ ] Toolbar shows avatar initial instead of username text
- [ ] Dropdown opens with Profile, Categories, Collections, Settings, Sign out
- [ ] Clicking Profile navigates to `/profile`
- [ ] Sidebar navigation works between all 4 tabs
- [ ] Categories tab has full CRUD (moved from /categories)
- [ ] Collections tab lists, creates, renames, deletes collections
- [ ] Settings tab shows theme toggle
- [ ] Account tab shows username and change password form
- [ ] Sign out from dropdown works
- [ ] Mobile layout shows horizontal pill tabs instead of sidebar

**Step 5: Commit any fixes, then final commit**

```
chore: cleanup and verify profile page feature
```
