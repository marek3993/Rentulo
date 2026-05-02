# 02 Constraints

Only audited live constraints/checks that were explicitly confirmed are listed here. Exact constraint names remain unknown unless the text below states otherwise.

## `public.reservations`
- `date_to >= date_from`
- `status` in `pending`, `confirmed`, `in_rental`, `return_pending_confirmation`, `completed`, `cancelled`, `disputed`
- `payment_provider` in `none`, `demo`, `stripe`, `manual`
- `payment_status` in `unpaid`, `pending`, `paid`, `failed`, `cancelled`, `refunded`

## `public.items`
- `delivery_mode` in `pickup_only`, `delivery_available`
- A delivery configuration consistency check exists.

Unknown:
- The exact delivery consistency expression was not reconstructed from the audited slice.

## `public.item_blocked_ranges`
- `date_to >= date_from`

## `public.disputes`
- `status` in `open`, `under_review`, `resolved`, `rejected`, `closed`, `cancelled`
- A `dispute_type` check exists.
- `title` must not be empty.
- `description` must not be empty.
- `rental_amount_snapshot` must be nonnegative.
- `deposit_amount_snapshot` must be nonnegative.
- Requested outcome checks exist.
- Decision outcome checks exist.
- Refund execution status checks exist.
- Deposit execution status checks exist.
- Refund/deposit `payment_events` FK link checks exist.

Unknown:
- Exact allowed values for `dispute_type`, requested outcomes, decision outcomes, and execution statuses were not reconstructed from the audited slice.

## `public.dispute_messages`
- `body` must not be empty.
- `message_type` in `reply`, `system`, `resolution`

## `public.payment_events`
- `provider` in `demo`, `stripe`, `manual`, `manual_dispute`
- An `event_type` check exists and includes checkout, payment, demo, and dispute financial event values.

Unknown:
- The exact full `event_type` enum was not reconstructed from the audited slice.

## `public.rental_condition_photos`
- An actor check exists.
- A phase check exists.

Unknown:
- Exact actor and phase enum members were not reconstructed from the audited slice.

## `public.reviews`
- `rating` is constrained to `1..5`

## `public.profiles`
- A `stripe_connect_onboarding_status` check exists.
- A `verification_status` check exists.

Unknown:
- Exact enum members for `stripe_connect_onboarding_status` and `verification_status` were not reconstructed from the audited slice.

## Explicit unknowns outside this export
- `admin_actions` schema constraints remain unknown.
