# Contributing

Thanks for helping. This site lists every elected official in Bukidnon since 2001 and the family ties between them that a published source states. You can help without writing code, and the most useful help is a sourced tie or a correction.

You're also welcome to fork it for your own province. See [Forking for another province](#forking-for-another-province).

## Ways to help

| You want to… | Do this |
| --- | --- |
| Report a family tie | Open a [family tie issue](https://github.com/Better-Bukidnon/dynasties/issues/new?template=family-tie.yml) with a link to the source. |
| Fix a name, office, place or year | Open a [correction issue](https://github.com/Better-Bukidnon/dynasties/issues/new?template=correction.yml). |
| Review the Filipino or Cebuano text | Edit `assets/js/dynasties-i18n.js` and open a pull request. Native speakers are especially welcome. |
| Fix a bug or improve the site | Open a [bug issue](https://github.com/Better-Bukidnon/dynasties/issues/new?template=bug.yml), or send a pull request. |

No GitHub account? Email volunteer@betterbukidnon.org with the same details.

## The sourcing rule

**We record a tie only when a published source states it.** That means a news report, an official LGU, Congress or Senate page, or a court record.

These are leads, not evidence:

- a shared surname or middle name
- Sr./Jr. suffixes
- one person following another in office
- Pulitiklan, social media posts, and Wikipedia sentences without a citation

When sources disagree, record the tie as `relative`, explain in a `note`, and cite both.

Keep the wording neutral. Being related to another official is not wrongdoing, so don't add words that suggest it.

## Set up

You need Node 18 or newer and Python 3. The site has no dependencies to install.

```sh
git clone https://github.com/<you>/dynasties.git
cd dynasties
git checkout develop
npm run serve     # http://localhost:8080
```

Branch from `develop`, which is where pull requests go. `main` is production.

## Adding a family tie

1. Find each person's id. It's in their page URL: `#/person/<id>`.
2. Add or extend a family in `data/families.json`. For a relative who held no Bukidnon office from 2001 to 2025, use an `x-` key with `name` and `offices`.
3. Add the tie with `aIs` and `bIs` (for example `father` and `son`) and at least one source with `publisher`, `date` and `url`. Add a short `quote` if you can.
4. Optionally add a `photo` (`url`, `credit`) to a member. Use only an official portrait whose license is known, such as the House of Representatives portraits (public domain).
5. Run `npm run check`.

## Fixing the election data

`data/officials.json` is generated, so never edit it by hand. Add an entry to `data/corrections.json` with a `reason`, then run `npm run data`. The README lists the kinds of correction. If the error is in the OpenHalalan source, also mention it on [OpenHalalan #5](https://github.com/RobertRLeung/OpenHalalan/issues/5).

## Changing the site

- Prefix every CSS class with `dy-`.
- Every visible string needs a `dy-*` key in `assets/js/dynasties-i18n.js`, in `en` plus `fil` and `ceb`. Drafts are fine; say so in the pull request.
- Keep the OpenHalalan (ODbL) attribution in the masthead, the footer and the About page, and keep the disclaimer at the top of every view.

Before you open a pull request, run `npm run serve` and check the page at 1366px and 390px wide. There should be no horizontal scroll and no console errors, and EN, FIL and CEB should all switch the text.

## Pull requests

Keep each pull request to one change, and fill in the checklist in the template. A pull request that adds or changes a tie must link the source. GitHub Actions runs `npm run check` and a build on every pull request.

## Forking for another province

Forks are welcome under the licenses below.

1. In `scripts/build-data.mjs`, change the province filter (`'BUKIDNON'`) and the `PLACES` list, then run `npm run data:refresh`. The years come from the source data.
   In `scripts/build-barangays.mjs`, change `REGION` (the region number in the DILG masterlist link), `PROVINCE` and `PLACE_OF`, then run `npm run data:brgy:refresh`.
2. Replace `data/families.json` with your own sourced families, and `data/corrections.json` with your own corrections. Don't carry ours over.
3. Change the names, links and domain in `index.html`, `wrangler.jsonc` and the i18n strings.
4. Keep the OpenHalalan citation and ODbL notice, and publish your derived data under the ODbL.
5. A link back to this project is appreciated but not required.

## Licenses

- Code: MIT (see `LICENSE`).
- Data: ODbL 1.0 (see `data/LICENSE.md`). `officials.json` is derived from OpenHalalan, so share-alike applies.

By contributing, you agree that your contribution is released under these licenses.

## Conduct

See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md). In short: be respectful, and don't speculate about anyone's private life. Discuss sources, not people.
