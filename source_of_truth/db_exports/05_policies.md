# 05 Policies

Only audited live RLS/storage policy behavior explicitly confirmed from the export is listed here. Exact policy names and exact SQL predicates remain unknown unless stated below.

## Table RLS

### `public.reservations`
- Renter own `select`
- Renter own `update`
- Renter own `insert`
- Owner-on-item `select`
- Owner-on-item `update`
- Admin `read`
- Admin `update`

### `public.items`
- Public `select` for active items
- Owner own `create`
- Owner own `read`
- Owner own `update`
- Owner own `delete`
- Admin `read`
- Admin `update`

### `public.item_blocked_ranges`
- Owner/admin `insert`
- Owner/admin `delete`
- Owner/admin `select`
- Public `select` also exists

### `public.disputes`
- Admin `read`
- Admin `update`
- Legacy renter/owner policies still exist
- V2 access/select/insert/update policies also exist

### `public.dispute_messages`
- `select` by `can_access_dispute`
- `insert` by dispute party or admin

### `public.dispute_evidence`
- `select` by `can_access_dispute`
- `insert` by dispute party or admin
- `delete` own/admin

### `public.payment_events`
- Renter-scoped policies exist
- Owner-scoped policies exist
- Admin-scoped policies exist

### `public.notifications`
- Own `select`
- Own `insert`
- Own `update`
- Own `delete`

### `public.conversations`
- Participant-only `select`
- Participant-only `update`
- `insert` by renter/owner with item-owner check

### `public.messages`
- Participant-only `select`
- Participant-only `update`
- `insert` by sender participant only

### `public.rental_condition_photos`
- Participant `select`
- Participant `insert`
- Uploader `delete`

### `public.profiles`
- Public `read`
- Own `insert`
- Own `update`

### `public.reviews`
- Public `read`
- Own `insert`
- Own `update`
- Own `delete`

### `public.user_verifications`
- Own/admin `read`
- Own/admin `update`
- Own `insert`

## Storage policies

### Bucket `avatars`
- Public read
- Authenticated upload
- Owner delete

### Bucket `item-images`
- Public read
- Authenticated insert
- Delete policy exists, but the audited export made it look broad.

Risk:
- The exact `item-images` delete predicate needs direct live verification before relying on it as least-privilege truth.

### Bucket `rental-condition-photos`
- Authenticated read
- Authenticated upload
- Own delete

### Bucket `dispute-evidence`
- `select`, `insert`, and `delete` are tied to dispute access and path convention
