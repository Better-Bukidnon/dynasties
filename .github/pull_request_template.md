## What changed

<!-- One change per pull request. -->

## Checklist

- [ ] Branched from `develop`, and this pull request targets `develop`
- [ ] **New or changed ties:** every tie links a published source that states it (not just a shared surname or succession in office)
- [ ] Wording is neutral
- [ ] `data/officials.json` was not edited by hand (changes go in `data/corrections.json`, each with a `reason`, then `npm run data`)
- [ ] `npm run check` passes
- [ ] **Site changes:** checked at 1366px and 390px with no horizontal scroll or console errors, and EN, FIL and CEB all switch
- [ ] **New visible text:** has a `dy-*` key in `en`, `fil` and `ceb` (say if FIL/CEB are drafts)
