# CLAUDE.md

A static site listing every elected official in Bukidnon since 2001 and the documented family ties between them. It's a standalone Better Bukidnon site in the same family as budget.betterbukidnon.org and infra.betterbukidnon.org (`Better-Bukidnon/infra-projects`). It lives at **officials.betterbukidnon.org** under the name **Bukidnon Officials**; dynasties.betterbukidnon.org, its first address, redirects there. The repo is `Better-Bukidnon/officials` (renamed from `dynasties`); the file names and `dy-` prefix keep the old name. See README.md for the pipeline.

## Rules

- **Never record a family tie without a published source that states it.** Shared surnames, shared middle names, Sr./Jr. suffixes and succession in office are leads, not evidence. Pulitiklan and uncited Wikipedia sentences are leads only. When sources conflict, record `relative` with a `note` and cite both.
- Keep the wording neutral. Being related is not wrongdoing; don't add language that implies otherwise.
- Never hand-edit `data/officials.json`. Change `data/corrections.json` (every entry needs a `reason`) and run `npm run data`. The build fails loudly when a correction no longer matches a source row. Once OpenHalalan fixes a problem (issue #5), remove the matching correction.
- Never hand-edit `data/barangays.json` either; run `npm run data:brgy` (`:refresh` downloads the DILG masterlist again). It is a snapshot of who holds office now, never evidence of a family tie, and it must never carry the phone numbers in the masterlist.
- Keep every claim checkable. `data/sources/` (written by the build scripts) records each raw source's address, download date and checksum, plus its Bukidnon rows verbatim; never hand-edit it. Every family-tie source should have an `archived` web.archive.org copy; `npm run check` lists the ones missing.
- `data/families.json` is curated by hand. Run `npm run check` after editing it.
- Keep the attribution visible: OpenHalalan (ODbL) in the masthead, the footer and About, and the disclaimer at the top of every view.
- Keep the site's own identity: the infra/budget type roles and layout, with a plum accent. Prefix classes with `dy-`. Every visible string needs a `dy-*` key in `assets/js/dynasties-i18n.js` (en, plus fil/ceb drafts until a native speaker reviews them).
- Branch from `develop`; `main` is production. Push only when asked.

## Checking your work

Run `npm run serve` and check the page at 1366px and 390px wide: no horizontal scroll, no console errors, and EN, FIL and CEB all switch the text. Playwright is available from `../betterbukidnon/node_modules` for a headless check.
