# 04 Views

## `public.item_unavailable_ranges`

Confirmed columns:
- `source_type`
- `source_id`
- `item_id`
- `date_from`
- `date_to`

Confirmed logic:
- Reservation-backed rows are included when `public.reservations.status` is one of:
  - `pending`
  - `confirmed`
  - `in_rental`
  - `return_pending_confirmation`
  - `disputed`
- Those reservation-backed rows are combined with all rows from `public.item_blocked_ranges`.
- The combination is `UNION ALL`.

Confirmed logical definition:

```text
public.item_unavailable_ranges :=

  reservation-backed rows projected into:
    source_type = unknown literal
    source_id   = unknown live source expression
    item_id     = public.reservations.item_id
    date_from   = public.reservations.date_from
    date_to     = public.reservations.date_to
  where public.reservations.status in (
    pending,
    confirmed,
    in_rental,
    return_pending_confirmation,
    disputed
  )

  UNION ALL

  blocked-range rows projected into:
    source_type = unknown literal
    source_id   = unknown live source expression
    item_id     = public.item_blocked_ranges.item_id
    date_from   = public.item_blocked_ranges.date_from
    date_to     = public.item_blocked_ranges.date_to
```

Known unknowns:
- Exact `source_type` literal values for reservation-backed rows and blocked-range rows.
- Exact `source_id` expressions in the live DDL text.
- Exact `CREATE VIEW` wrapper, ownership, grants, and any casts not visible in the audited slice.
