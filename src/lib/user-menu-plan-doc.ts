/** Shown in Admin → Settings → User menu → View planning */
export const USER_MENU_PLAN_MARKDOWN = `# Facebook-style User Menu + Saved Posts

## Approach
- UI: বাম Sheet (side=left) — টগল থেকে খুলবে; Facebook মেনু লেআউট (প্রোফাইল হেডার + নেভ লিস্ট + ফুটার)।
- Lists: প্রতিটি মেনু আইটেম → আলাদা রুট (/me/…).
- Config: app_settings.user_menu_settings JSON — Donation Flow প্যাটার্ন।

## 1. Database
- request_saves (request_id, user_id, created_at) + RLS
- app_settings.user_menu_settings JSONB
  - items[]: id, enabled, order, icon, label_bn, label_en
  - ids: my_posts | liked | commented | shared | saved | donated | organizations | profile | settings | logout
  - design: drawer_width_px, show_profile_card, show_see_more, accent

## 2. Libs
- src/lib/request-saves.ts — toggleSave, fetch saved IDs
- src/lib/user-activity.ts — activity list queries
- src/lib/user-menu-settings.ts — fetch/save/normalize

## 3. UI — hamburger + drawer
- Feed / Community / Profile হেডারে Menu আইকন
- UserMenuDrawer: প্রোফাইল কার্ড, অ্যাডমিন অর্ডারের আইটেম, Settings / Logout
- RequestCard-এ Bookmark (সেভ)

## 4. Routes
| Path | Purpose |
|------|---------|
| /me/posts | আমার পোস্ট |
| /me/liked | লাইক |
| /me/commented | কমেন্ট |
| /me/shared | শেয়ার |
| /me/saved | সেভ |
| /me/donated | রক্ত দিয়েছি |
| /me/organizations | Organizations |

## 5. Admin
- Settings → User menu: enable/order/labels/icons + design
- এই প্ল্যানিং বাটন থেকে এই ডক দেখা যায়

## SQL to run
- scripts/request-saves.sql
- scripts/user-menu-settings.sql
`;
