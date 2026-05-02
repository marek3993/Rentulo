# 08 Storage

## Confirmed buckets

### `avatars`
- Visibility: public
- Confirmed policies:
  - public read
  - authenticated upload
  - owner delete

### `item-images`
- Visibility: public
- Confirmed policies:
  - public read
  - authenticated insert
  - delete policy exists

Risk:
- The audited export made the delete policy look broad. The exact live predicate still needs direct verification.

### `rental-condition-photos`
- Visibility: private
- Confirmed policies:
  - authenticated read
  - authenticated upload
  - own delete

### `dispute-evidence`
- Visibility: private
- Confirmed policies:
  - `select` tied to dispute access
  - `insert` tied to dispute access and path convention
  - `delete` tied to dispute access and path convention

## Explicit unknowns
- Exact storage policy names remain unknown in this snapshot.
- Exact `dispute-evidence` path convention string is not reconstructed here.
