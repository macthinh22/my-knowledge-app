# Profile Page & User Dropdown Design

## 1. User Dropdown (DashboardToolbar)

Replace the current flat username + "Sign out" button with an avatar initial button that opens a DropdownMenu.

- **Trigger**: Circle with first letter of username
- **Menu items**:
  - `@username` (display only, muted)
  - Separator
  - Profile -> `/profile`
  - Categories -> `/profile?tab=categories`
  - Settings -> `/profile?tab=settings`
  - Separator
  - Sign out -> calls logout

Remove the standalone categories icon button from the toolbar.

## 2. Profile Page (`/profile`)

**Layout**: Sidebar nav + content area

**URL scheme**: `/profile?tab=categories|collections|settings|account`, defaults to `categories`

### Sidebar nav items

- Categories
- Collections
- Settings
- Account

### Tab: Categories

Move existing `/categories` page content here. Delete `/categories/page.tsx`. Update all links.

### Tab: Collections

- List collections with video count
- Create/rename/delete collections

### Tab: Settings

- Theme toggle
- User preferences from backend UserSettings

### Tab: Account

- Display username
- Change password form

## 3. Backend Changes

- Add `PATCH /api/auth/password` endpoint for password change

## 4. Existing Code Changes

- `DashboardToolbar`: Replace username text + sign out button + categories icon with avatar dropdown
- Delete `/categories/page.tsx`
- Update all links from `/categories` to `/profile?tab=categories`
