# Rentulo Master State

## Project
- Name: Rentulo
- Stack: Next.js + TypeScript + Supabase + Vercel
- Operating mode: segmented chat system with MASTER governance

## Current chat system
- MASTER = orchestration, approvals, routing, truth governance
- APP = app surfaces, shared UX, app-facing export contract
- DATA = SQL, schema, RLS, migrations, upstream/source truth
- AUTOMATION = cron, background jobs, webhooks, retries, runtime health
- ENGINEERING HYGIENE = low-risk cleanup without behavior change
- Domain chats remain active for product-specific implementation

## Current known domain chats
- RENTULO SPRÁVY A NOTIFIKÁCIE
- RENTULO SPORY A REKLAMÁCIE
- RENTULO INZERÁTY A FOTKY
- RENTULO PLATBY

## Current truth status
- Chat operating system: active
- Source-of-truth repo layer: bootstrapped
- Repo path registry: partial / to be filled from real repo structure
- Export contract: partial / not yet formalized
- Issue registry: initialized, no confirmed issues recorded in this file yet

## Master routing rule
1. Najprv rozhodni owner chat
2. Nemixuj scope bez dôvodu
3. Ak je task cross-cutting, MASTER rozseká workflow
4. Ak ďalší krok patrí tomu istému ownerovi, nepíš prompt sám sebe
5. Ak ďalší krok patrí inému segmentu, urob presný handoff

## Immediate operating priority
1. používať tieto truth súbory pri každom väčšom tasku
2. doplniť reálne repo paths do `paths_registry.json`
3. doplniť reálny export contract do `export_contract.json`
4. priebežne aktualizovať `current_issues.md`
