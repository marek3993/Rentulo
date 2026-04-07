# Rentulo Source of Truth

Tento priečinok je centrálna truth vrstva pre Rentulo.

## Účel
- mať jeden spoločný anchor pre všetky Rentulo chaty
- znížiť chaos pri handoffoch
- oddeliť truth od dočasných rozhodnutí v konverzáciách
- držať routing a scope hranice stabilné

## Ako to používať
Každý Rentulo chat má pred návrhom riešenia najprv čítať:
1. `source_of_truth/master_state.md`
2. `source_of_truth/chat_roles.md`
3. `source_of_truth/project_truth.json`
4. `source_of_truth/current_issues.md`
5. podľa potreby `source_of_truth/paths_registry.json`
6. podľa potreby `source_of_truth/export_contract.json`

## Povinné pravidlá
- truth reading first
- repo/truth first, až potom návrh
- žiadne miešanie scope bez dôvodu
- keď ďalší krok patrí inému segmentu, urob presný handoff
- keď ďalší krok stále patrí tomu istému segmentu, pokračuj bez zbytočného promptu sám sebe

## Súbory
- `README.md` = ako systém používať
- `master_state.md` = aktuálny stav projektu a operating model
- `chat_roles.md` = presné scope hranice chatov
- `project_truth.json` = strojovo čitateľný projektový truth snapshot
- `paths_registry.json` = registry kľúčových priečinkov/súborov
- `current_issues.md` = živý issue board bez vymýšľania bugov
- `export_contract.json` = app-facing truth surfaces

## Update politika
- MASTER vlastní routing a governance
- owner segment aktualizuje truth v svojom scope
- pri zmene scope, contractu alebo routing pravidiel sa aktualizujú truth súbory v tom istom workstreame
