# 01 Columns

Only columns explicitly confirmed from the audited live export are listed here. If a relation is named elsewhere but missing below, only its existence is confirmed in this repo snapshot.

## `public.reservations`
Confirmed columns:
- `date_from`
- `date_to`
- `status`
- `payment_provider`
- `payment_status`
- `payment_due_at`
- `provider_ref`

Unknown:
- Full column inventory is not locked here.

## `public.items`
Confirmed columns:
- `delivery_mode`
- `delivery_rate_per_km`
- `delivery_fee_cap`
- `delivery_max_radius_km`
- `owner_id`
- `city`

Unknown:
- Full column inventory is not locked here.

## `public.item_blocked_ranges`
Confirmed columns:
- `id`
- `item_id`
- `owner_id`
- `date_from`
- `date_to`
- `note`
- `created_at`
- `updated_at`

## `public.item_unavailable_ranges` (view)
Confirmed columns:
- `source_type`
- `source_id`
- `item_id`
- `date_from`
- `date_to`

## `public.disputes`
Confirmed columns:
- `opened_by_user_id`
- `target_user_id`
- `dispute_type`
- `title`
- `description`
- `resolution_note`
- `resolved_by_user_id`
- `resolved_at`
- `reservation_status_before_dispute`
- `reservation_status_after_dispute`
- `last_activity_at`
- `rental_amount_snapshot`
- `deposit_amount_snapshot`
- `dispute_requested_outcome`
- `dispute_requested_amount`
- `dispute_decision_outcome`
- `dispute_decision_amount`
- `refund_execution_status`
- `deposit_execution_status`
- `refund_payment_event_id`
- `deposit_payment_event_id`
- `status`

Unknown:
- Full column inventory is not locked here.

## `public.dispute_messages`
Confirmed columns:
- `body`
- `message_type`

Unknown:
- Full column inventory is not locked here.

## `public.payment_events`
Confirmed columns:
- `reservation_id`
- `actor_user_id`
- `event_type`
- `provider`
- `amount`
- `currency`
- `note`

Important:
- Full column export was partial/truncated in the source export.
- Only the fields above are safe to treat as confirmed in this repo snapshot.

## `public.reviews`
Confirmed columns:
- `rating`

Unknown:
- Full column inventory is not locked here.

## `public.conversations`
Confirmed columns:
- `updated_at`

Unknown:
- The unique item/owner/renter key exists, but the full column list is not locked here.

## `public.messages`
Confirmed columns:
- `conversation_id`
- `created_at`

Unknown:
- Full column inventory is not locked here.

## `public.rental_condition_photos`
Confirmed columns:
- `actor`
- `phase`

Unknown:
- Full column inventory is not locked here.

## `public.profiles`
Confirmed columns:
- `stripe_connect_account_id`
- `stripe_connect_onboarding_status`
- `verification_status`

Important:
- Full column export was partial/truncated in the source export.
- Only the fields above are safe to treat as confirmed in this repo snapshot.

## Relations confirmed but still column-unknown here
- `public.dispute_evidence`
- `public.notifications`
- `public.user_verifications`
