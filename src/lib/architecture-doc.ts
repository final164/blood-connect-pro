/** Architecture plan shown in Admin → Plan (+ PDF export) */
export const ARCHITECTURE_MARKDOWN = `# Muktosheba — Professional Architecture Plan

## 1. Product vision
Muktosheba is a realtime blood-donation network: district-scoped social feed, blood requests, encrypted chat, and an admin CMS. Web-first (TanStack Start), designed so the same Supabase backend powers a future native app.

## 2. Search pattern name
**Typeahead Autocomplete** for district input, combined with **District-scoped feed filtering** (administrative region filtering — not map/GPS geofencing).

## 3. Auth
- Sign up / sign in: Bangladesh mobile number + 4-digit PIN
- Admin login: phone \`01700000000\` · PIN \`1212\` (role \`admin\` in \`user_roles\` + Super Admin staff role)
- Guest/anonymous auto-login removed; app requires authenticated session

## 3b. Admin Access Control (Hybrid RBAC)
- Permission keys: \`module.action\` (e.g. \`community.import\`, \`access.manage\`)
- Tables: \`admin_permissions\`, \`admin_roles\`, \`admin_role_permissions\`, \`admin_user_roles\`, \`admin_user_permission_overrides\`
- Effective perms via \`get_my_admin_permissions()\`; Super Admin / legacy \`admin\` → \`*\`
- UI gates with \`can()\`; Access tab for roles matrix, assignments, grant/deny overrides
- Interim RLS: mutating staff also get \`moderator\` app_role; Phase 2 will map fine-grained keys in Postgres

## 4. Modules
1. **Feed** — posts, likes, comments, shares; realtime; filtered by selected district
2. **Requests** — inline composer (no modal); district typeahead; blood-group chips; call + encrypted chat
3. **Community** — blood donation organizations managed from admin
4. **Chat** — AES-GCM ciphertext in \`messages\`; realtime delivery
5. **Profile** — dynamic (no I'm donor / I'm recipient toggles); district preference
6. **Admin** — districts, CMS strings, community orgs, users, app settings, architecture PDF

## 5. Data (Supabase)
- Core: profiles, posts, post_likes, post_comments, post_shares, blood_requests, conversations, messages
- CMS: districts, cms_strings, app_settings, community_orgs, user_roles, admin_* ACL tables
- Realtime publication on posts, likes, comments, shares, requests, messages, orgs

## 6. Offline / Online
- Service worker + web manifest (PWA)
- IndexedDB cache for feed/requests
- Outbox queue for deferred writes when offline

## 7. Native-ready path
Keep business logic in \`src/lib/api/*\` and \`src/lib/offline.ts\`. A React Native / Flutter client can call the same Supabase project with identical table contracts.

## 8. Security notes
- Never ship service/secret keys to the browser
- Rotate keys if they were pasted in chat
- Admin UI gated by Hybrid RBAC; DB writes still use \`has_role(admin|moderator)\` until RLS Phase 2
- Chat payloads stored encrypted (E2EE layer in \`src/lib/e2ee.ts\`)

## 9. Migrations
- Base schema: \`20260723190810_*.sql\`
- Hardening: \`20260723190835_*.sql\`
- Platform v2: \`20260728010000_Muktosheba_v2_platform.sql\`
- Combined apply file: \`scripts/full-schema.sql\`

## 10. What else can be added later
- Push notifications (FCM) for critical requests in district
- Donor eligibility calculator (56-day rule)
- Verified hospital partners
- Analytics dashboard (fulfillment rate by district)
- Multi-language CMS beyond BN/EN
- Media uploads for posts via Supabase Storage
`;
