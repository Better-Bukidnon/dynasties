# Bukidnon Political Families

Every elected official in the Province of Bukidnon since 2001, and the documented family ties between them. That includes the governor, vice governor, House members and board members, plus the mayors, vice mayors and councilors of all 22 cities and municipalities. Each tie links to a published source.

It's a standalone Better Bukidnon site, like the [budget portal](https://budget.betterbukidnon.org) and the [infrastructure tracker](https://infra.betterbukidnon.org). It's planned for **dynasties.betterbukidnon.org** and is listed on betterbukidnon.org/projects. It was inspired by BetterGov's [dynasties.bettergov.ph](https://dynasties.bettergov.ph), which matches officials by shared surname. This site lists a tie only when a source states it.

## How it works

```
OpenHalalan winners CSV ──▶ scripts/build-data.mjs ──▶ data/officials.json ─┐
data/corrections.json  ───┘   (clean, place, match)                        ├─▶ index.html
data/families.json (curated, sourced) ──▶ scripts/check-families.mjs ───────┤
DILG barangay masterlist ──▶ scripts/build-barangays.mjs ──▶ data/barangays.json ┘
```

- `scripts/build-data.mjs` downloads the [OpenHalalan](https://robertrleung.github.io/OpenHalalan/) winners file and caches it in `.cache/`. It keeps the Bukidnon rows (2001–2025), cleans the names, assigns each row to a place, matches rows to people, and writes `data/officials.json`. It has no dependencies (Node 18+).
- `data/corrections.json` holds every fix to the source, and each fix says why. The source misfiles the 2010 and 2013 Malaybalay and Valencia slates, leaves some towns blank, is missing three races, and double-encodes Ñ. These problems are reported upstream in [OpenHalalan #5](https://github.com/RobertRLeung/OpenHalalan/issues/5).
- `data/families.json` is written by hand. A family is a set of members, which are person ids from `officials.json`, plus ties between them. Every tie has at least one source URL and usually a short quote.
- `scripts/check-families.mjs` checks that every member exists, that every tie joins two members, and that every tie has a source. `npm run build` runs it first.
- `scripts/build-barangays.mjs` downloads the Region X "Masterlist of Officials" from the [DILG Barangay Officials Directory](https://www.dilg.gov.ph/barangay-officials-directory/index) and writes `data/barangays.json`: the punong barangay, kagawads, SK chairperson and SK members of all 464 barangays, with each one's term in the present position. It keeps name, post, term and place, and drops the phone numbers and the appointed posts. The snapshot stays separate from `officials.json`, and it is never evidence of a family tie. The site loads it only on place and barangay pages.
- `data/sources/` keeps a record for fact-checking: `manifest.json` gives each raw source's address, download date and SHA-256 checksum, and the CSV files are the Bukidnon rows of each source, verbatim (minus phone numbers). Both build scripts update it. Family-tie sources link a saved copy on the Internet Archive (`archived`), and `npm run check` lists any that still need one.
- `index.html` and `assets/` make up a static single-page site with hash routes: Home (with a "Find your barangay" search), Cities & municipalities (mayors since 2001), a page for each place, a page for each barangay showing its officials up to the governor, Province, Families, a page for each family with a diagram, All officials, a page for each person, and About.

## Run locally

```sh
npm run data      # rebuild data/officials.json (add :refresh to re-download the CSV)
npm run data:brgy # rebuild data/barangays.json from the DILG masterlist (add :refresh to download it again)
npm run check     # validate data/families.json
npm run serve     # http://localhost:8080
npm run build     # dist/ for Cloudflare Workers
```

## Adding or correcting a family tie

1. Find a published source that states the relationship, such as a news report, an official LGU, Congress or Senate page, or a court record. A shared surname is not enough, and neither is a Wikipedia sentence without a citation.
2. Add the people to a family in `data/families.json`, using their `officials.json` ids. Find an id on the person's page URL (`#/person/<id>`). For a relative with no Bukidnon office in 2001–2025, use an `x-` key, a `name`, and `offices`.
3. Add a tie with `aIs` and `bIs` (for example `father` and `son`) and `sources` with `publisher`, `date`, `url`, an `archived` copy (save the page at https://web.archive.org/save first) and, if possible, a short `quote`. If sources disagree, use `relative` and explain in `note`.
4. Optionally add a `photo` (`url`, `credit`) to a member. Use only an official portrait whose license is known, such as the House of Representatives portraits (public domain). Everyone else is shown with their initials.
5. Run `npm run check`.

To fix an identity or a place in the election data, edit `data/corrections.json` and run `npm run data`. Use `samePerson` for nicknames, `assign` when the source gives two people the same name, `placeFixes` for wrong places, and `addTerms` for missing winners, citing a source.

## Contributing and forking

Contributions are welcome: a sourced family tie, a correction, a Filipino or Cebuano review, or code. Forks for other provinces are welcome too. See [CONTRIBUTING.md](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md). Issue forms for ties and corrections ask for a source up front, and GitHub Actions runs `npm run check` and a build on every pull request.

## Data and licenses

- Election results come from Leung, R. et al. (2026), *OpenHalalan: The Philippine National and Local Election Dataset*, Zenodo, https://doi.org/10.5281/zenodo.17783099, licensed [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/). `data/officials.json` is a derived database and is also published under the ODbL.
- Barangay and SK officials come from the DILG Barangay Officials Directory masterlist (https://www.dilg.gov.ph/barangay-officials-directory/index). Works of the Philippine government are not subject to copyright (RA 8293, sec. 176).
- Family ties come from the sources cited in `data/families.json`. Quotes are kept short and attributed.
- The code is MIT ([LICENSE](LICENSE)). The data is ODbL 1.0 ([data/LICENSE.md](data/LICENSE.md)).

Relationships do not imply wrongdoing. This is a volunteer civic project, not an official government website.
