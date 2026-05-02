# DB Truth Inventory

## Concise audit summary
- This repo now has a dedicated truth-export surface at `source_of_truth/db_exports`.
- `source_of_truth/paths_registry.json` still keeps `supabase_sql.path = "unknown"` because no live repo SQL or migrations path was confirmed.
- The export below locks only audited live Supabase truth: confirmed relations, confirmed columns, checks, indexes, view logic, RLS, triggers, functions, storage, and extensions.
- Anything not confirmed from the audited export remains explicit unknown.

## Confirmed tables and views
- `public.reservations`
- `public.items`
- `public.item_blocked_ranges`
- `public.item_unavailable_ranges` (view)
- `public.disputes`
- `public.dispute_messages`
- `public.dispute_evidence`
- `public.payment_events`
- `public.reviews`
- `public.notifications`
- `public.conversations`
- `public.messages`
- `public.rental_condition_photos`
- `public.user_verifications`
- `public.profiles`

## Confirmed RPC / functions
### Payments / reservations
- `payment_record_event`
- `apply_payment_event_to_reservation`
- `reservation_confirm`
- `reservation_mark_in_rental`
- `reservation_mark_return_pending_confirmation`
- `reservation_complete`
- `reservation_cancel`
- `admin_record_manual_payment_success`
- `admin_record_manual_payment_failed`
- `admin_reset_payment_to_unpaid`
- `admin_set_reservation_status`
- `expire_pending_reservations`
- `expire_pending_reservations_with_payment_events`
- `release_owner_funds_for_reservation`
- `admin_release_payout_for_reservation`

### Disputes
- `dispute_open`
- `dispute_open_v2`
- `dispute_set_status`
- `dispute_set_status_v2`
- `dispute_add_reply`
- `dispute_add_evidence`
- `dispute_execute_financial_outcome_v1`
- `dispute_calc_rental_amount_v1`
- `can_access_dispute`
- `is_dispute_party`

### Listings / availability
- `item_blocked_range_create`
- `item_blocked_range_delete`
- `item_delivery_config_update`
- `reservations_enforce_unavailable_overlap`

### Verification / admin
- `guard_user_verification_write`
- `sync_profile_verification_from_request`
- `log_admin_action`
- `log_dispute_admin_update`
- `log_user_verification_admin_update`
- `owner_stripe_connect_status_upsert`

### Helpers
- `is_admin`
- `is_reservation_renter`

## Confirmed triggers
### `public.reservations`
- `guard_reservation_transition`
- `prevent_reservation_overlap`
- `reservations_enforce_unavailable_overlap`
- `reservation_notifications`
- `set_reservation_payment_due_at`
- `set_reservation_timestamps`
- `validate_reservation_status_transition`

### `public.disputes`
- `create_dispute_notifications`
- `log_dispute_admin_update`
- `set_disputes_updated_at`
- `validate_dispute_create_v2`
- `guard_dispute_status_transition_v2`
- `notify_dispute_opened_v2`
- `notify_dispute_status_change_v2`
- `sync_reservation_status_from_dispute` on insert/update

### `public.dispute_messages`
- `notify_dispute_reply_v2`
- `touch_dispute_activity`

### `public.dispute_evidence`
- `touch_dispute_activity`

### `public.messages`
- `create_message_notification`
- `touch_conversation_updated_at`

### `public.payment_events`
- `apply_payment_event_to_reservation`

### `public.reviews`
- `guard_review_write`

### `public.user_verifications`
- `guard_user_verification_write`
- `log_user_verification_admin_update`
- `sync_profile_verification_from_request`
- `user_verifications_updated_at`
- `verification_notifications_update`

## Confirmed RLS
- `reservations`: renter own select/update/insert; owner-on-item select/update; admin read/update.
- `items`: public select active; owner own CRUD; admin read/update.
- `item_blocked_ranges`: owner/admin insert/delete/select; public select also exists.
- `disputes`: admin read/update; legacy renter/owner policies still exist; v2 access/select/insert/update policies also exist.
- `dispute_messages`: select by `can_access_dispute`; insert by dispute party or admin.
- `dispute_evidence`: select by `can_access_dispute`; insert by dispute party or admin; delete own/admin.
- `payment_events`: renter/owner/admin scoped policies.
- `notifications`: own select/insert/update/delete.
- `conversations`: participant-only select/update; insert by renter/owner with item-owner check.
- `messages`: participant-only select/update; insert by sender participant only.
- `rental_condition_photos`: participant select/insert; uploader delete.
- `profiles`: public read; own insert/update.
- `reviews`: public read; own insert/update/delete.
- `user_verifications`: own/admin read/update; own insert.

## Confirmed storage buckets / policies
- `avatars` (public): public read; authenticated upload; owner delete.
- `item-images` (public): public read; authenticated insert; delete policy exists but needs direct verification because the audited export looked broad.
- `rental-condition-photos` (private): authenticated read; authenticated upload; own delete.
- `dispute-evidence` (private): select/insert/delete tied to dispute access and path convention.

## Known unknowns
- `supabase_sql.path` is still `unknown`; no repo SQL or migrations source was confirmed.
- `admin_actions` table schema, constraints, indexes, and RLS remain unknown.
- `payment_events` full column list is still partially unknown because the source export was truncated.
- `profiles` full column list is still partially unknown because the source export was truncated.
- Whether `pg_cron` exists is unknown.
- Whether any runtime scheduler actually calls `expire_pending_reservations_with_payment_events(...)` is unknown.
- Exact live webhook side effects beyond audited repo-visible surfaces remain partially unknown.

## Critical risks
- Backend truth is still not reproducible from repo SQL because there is no confirmed migrations or DDL path.
- Partial `profiles` and `payment_events` exports create a drift risk if later repo work assumes unverified columns.
- `dispute_open_v2` and `dispute_set_status_v2` have multiple confirmed overloads; signature drift remains possible until raw DDL is locked.
- The `item-images` delete policy looked broad in the audited export and needs live verification before relying on it as a safe least-privilege rule.
- Scheduler ownership around expiring pending reservations remains unverified.

## Next lock step
1. Obtain raw live DDL or a confirmed repo SQL/migrations path, but leave `supabase_sql.path` as `unknown` until that path is directly verified.
2. Re-export the full `profiles` and `payment_events` column lists without truncation.
3. Audit `admin_actions` directly from the live DB.
4. Verify `pg_cron`, `pg_net`, runtime scheduler wiring, and the exact `item-images` delete policy.
