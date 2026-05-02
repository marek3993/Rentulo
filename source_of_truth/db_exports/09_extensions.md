# 09 Extensions

## Confirmed extensions
- `pgcrypto`
- `postgis`

## Explicit unknowns
- `pg_cron` is not confirmed.
- `pg_net` is not confirmed.

Rule:
- Do not assume any extension beyond `pgcrypto` and `postgis` is available unless it is directly re-audited from the live DB.
