# 03 Indexes

Only audited live index coverage confirmed from the export is listed here. Exact physical index names are not locked unless the description below states them directly.

## `public.reservations`
- Composite item/status/date index
- `payment_due_at` index
- `payment_status` index
- `provider_ref` unique/index

## `public.items`
- `owner_id` index
- `city` index

## `public.item_blocked_ranges`
- item/date composite index
- `owner_id` index

## `public.disputes`
- reservation/status composite index
- `opened_by_user_id` index
- `target_user_id` index
- `last_activity_at` descending index
- `refund_payment_event_id` index
- `deposit_payment_event_id` index
- Unique one-active-per-reservation index

## `public.dispute_messages`
- `dispute_id + created_at` composite index

## `public.dispute_evidence`
- `dispute_id + created_at` composite index
- Unique bucket/path index

## `public.conversations`
- Unique item/owner/renter composite index
- `updated_at` index

## `public.messages`
- `conversation_id` index
- `created_at` index

## `public.notifications`
- `user_idx`
- `user_unread_idx`

## `public.profiles`
- Unique `stripe_connect_account_id` where not null

## `public.reviews`
- Unique item/owner review per reservation/reviewer index

## `public.rental_condition_photos`
- reservation/phase/actor composite index
