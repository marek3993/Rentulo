# 07 Functions

Only audited live functions/RPCs explicitly confirmed from the export are listed here. Exact signatures, volatility flags, and return types remain unknown unless already stated elsewhere.

## Payments / reservations
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

## Disputes
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

Risk:
- Multiple overloads of `dispute_open_v2` are confirmed.
- Multiple overloads of `dispute_set_status_v2` are confirmed.
- Raw signatures are still not locked in repo truth.

## Listings / availability
- `item_blocked_range_create`
- `item_blocked_range_delete`
- `item_delivery_config_update`
- `reservations_enforce_unavailable_overlap`

## Verification / admin
- `guard_user_verification_write`
- `sync_profile_verification_from_request`
- `log_admin_action`
- `log_dispute_admin_update`
- `log_user_verification_admin_update`
- `owner_stripe_connect_status_upsert`

## Helpers
- `is_admin`
- `is_reservation_renter`

## Explicit unknowns
- Whether any runtime scheduler actually calls `expire_pending_reservations_with_payment_events(...)` is still unknown.
