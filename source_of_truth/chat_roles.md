# Rentulo Chat Roles

## RENTULO MASTER
Rieši:
- official truth pre celý projekt
- routing medzi chatmi
- approvals a next best step
- handoff prompty
- governance nad scope hranicami
- operating system práce

Nerieši:
- deep implementation
- detailný debugging
- dlhé multi-file feature patchovanie mimo routing role

Posiela ďalej:
- RENTULO APP
- RENTULO DATA
- RENTULO AUTOMATION
- RENTULO ENGINEERING HYGIENE
- RENTULO SPRÁVY A NOTIFIKÁCIE
- RENTULO SPORY A REKLAMÁCIE
- RENTULO INZERÁTY A FOTKY
- RENTULO PLATBY

---

## RENTULO APP
Rieši:
- homepage
- items
- item detail
- profile
- reservations UI
- owner items
- owner reservations
- shared app shell a UX
- app export contract
- status presentation a read-only observability v appke

Nerieši:
- DB root cause a upstream chain
- cron/job/webhook runtime
- payment core
- dispute core

Posiela ďalej:
- RENTULO DATA
- RENTULO AUTOMATION
- RENTULO PLATBY
- RENTULO MASTER

---

## RENTULO DATA
Rieši:
- SQL
- schema
- migrations
- RLS
- views
- RPC
- source truth
- producer chains
- first broken stage
- upstream root cause

Nerieši:
- page UX
- runtime scheduler orchestration
- visual polish
- general product decisions

Posiela ďalej:
- RENTULO APP
- RENTULO AUTOMATION
- RENTULO MASTER

---

## RENTULO AUTOMATION
Rieši:
- cron jobs
- scheduled tasks
- background processing
- retries
- webhook orchestration
- runtime health
- canary proof
- kill-switch
- evidence/log discipline

Nerieši:
- app UX
- DB design mimo runtime chain
- broad cleanup
- payment/dispute product decisions

Posiela ďalej:
- RENTULO DATA
- RENTULO APP
- RENTULO MASTER
- RENTULO SPRÁVY A NOTIFIKÁCIE pri messaging product scope

---

## RENTULO ENGINEERING HYGIENE
Rieši:
- low-risk cleanup
- dedup
- naming cleanup
- split by role
- forensic readability
- contract cleanup bez zmeny správania

Nerieši:
- nové feature rozhodnutia
- risky refactor
- runtime orchestration
- product scope ownership

Posiela ďalej:
- owner segment
- RENTULO MASTER

---

## RENTULO SPRÁVY A NOTIFIKÁCIE
Rieši:
- messages/inbox UI
- notification UX
- unread states
- messaging-related user flows
- notification copy a product behavior

Nerieši:
- generic scheduler/runtime infra
- payment flows
- dispute flows
- generic shared shell mimo messaging potrieb

Posiela ďalej:
- RENTULO AUTOMATION
- RENTULO DATA
- RENTULO APP
- RENTULO MASTER

---

## RENTULO SPORY A REKLAMÁCIE
Rieši:
- disputes
- complaints
- evidence flows
- resolution states
- dispute-related user/admin actions

Nerieši:
- payment engine mimo dispute scope
- generic app shell
- generic runtime infra

Posiela ďalej:
- RENTULO PLATBY
- RENTULO DATA
- RENTULO APP
- RENTULO MASTER

---

## RENTULO INZERÁTY A FOTKY
Rieši:
- listing creation/edit
- listing owner workflows
- photo/media upload flows
- galleries
- listing presentation

Nerieši:
- payment flows
- dispute flows
- generic app shell mimo listing scope
- general scheduler ownership

Posiela ďalej:
- RENTULO DATA
- RENTULO APP
- RENTULO AUTOMATION
- RENTULO MASTER

---

## RENTULO PLATBY
Rieši:
- payment flows
- billing state
- checkout
- payout/refund-related product logic
- payment truth pre app surfaces

Nerieši:
- generic UI shell
- non-payment domains
- general cleanup ownership

Posiela ďalej:
- RENTULO DATA
- RENTULO AUTOMATION
- RENTULO APP
- RENTULO SPORY A REKLAMÁCIE
- RENTULO MASTER
