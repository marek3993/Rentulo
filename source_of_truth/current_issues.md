# Rentulo Current Issues

Tento súbor je živý register potvrdených problémov, nie brainstorming.

## Pravidlá
- zapisuj len potvrdené alebo aktívne riešené problémy
- každý issue musí mať owner chat
- issue sa zapisuje stručne a fakticky
- keď sa issue uzavrie, presuň ho do Closed
- nevymýšľaj bugy len preto, aby bol súbor plný

---

## Intake template

### [ISSUE_ID]
- Title:
- Status: proposed | confirmed | in_progress | blocked | resolved | closed
- Owner chat:
- Scope:
- Source of truth:
- First confirmed by:
- Last updated:
- User impact:
- Root cause:
- Next step:
- Notes:

---

## Open

_Zatiaľ bez zapísaných potvrdených issue._

---

## In Progress

### [DATA-001]
- Title: Supabase truth not yet reproducible from repo
- Status: in_progress
- Owner chat: RENTULO DATA
- Scope: DB truth export / schema / RLS / RPC / triggers / storage
- Source of truth: live DB export audited in DATA chat
- First confirmed by: RENTULO DATA
- Last updated: 2026-05-02
- User impact: backend decisions can drift from real DB state
- Root cause: repo lacks confirmed SQL/migrations truth path and DB reality is not exported
- Next step: lock live DB export into source_of_truth/db_truth_inventory.md and source_of_truth/db_exports/*
- Notes: keep unknowns explicit; do not invent missing DDL

---

## Blocked

_Zatiaľ bez blocked issue._

---

## Closed

_Zatiaľ bez uzavretých issue._
