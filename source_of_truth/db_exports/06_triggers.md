# 06 Triggers

Only audited live triggers explicitly confirmed from the export are listed here. Exact trigger timing clauses and exact SQL bodies remain unknown unless directly implied by the trigger identity.

## `public.reservations`
- `guard_reservation_transition`
- `prevent_reservation_overlap`
- `reservations_enforce_unavailable_overlap`
- `reservation_notifications`
- `set_reservation_payment_due_at`
- `set_reservation_timestamps`
- `validate_reservation_status_transition`

## `public.disputes`
- `create_dispute_notifications`
- `log_dispute_admin_update`
- `set_disputes_updated_at`
- `validate_dispute_create_v2`
- `guard_dispute_status_transition_v2`
- `notify_dispute_opened_v2`
- `notify_dispute_status_change_v2`
- `sync_reservation_status_from_dispute` on insert/update

## `public.dispute_messages`
- `notify_dispute_reply_v2`
- `touch_dispute_activity`

## `public.dispute_evidence`
- `touch_dispute_activity`

## `public.messages`
- `create_message_notification`
- `touch_conversation_updated_at`

## `public.payment_events`
- `apply_payment_event_to_reservation`

## `public.reviews`
- `guard_review_write`

## `public.user_verifications`
- `guard_user_verification_write`
- `log_user_verification_admin_update`
- `sync_profile_verification_from_request`
- `user_verifications_updated_at`
- `verification_notifications_update`
