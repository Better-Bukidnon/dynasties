# Data license

The databases in this folder are made available under the [Open Database License (ODbL) 1.0](https://opendatacommons.org/licenses/odbl/1-0/). You may share, adapt and build on them, including commercially, as long as you:

- **attribute** them (see below),
- **share alike**: publish any adapted database under the ODbL too, and
- **keep them open**: don't apply technical restrictions that block reuse.

## Files

- `officials.json` is derived from OpenHalalan, so it must stay under the ODbL. Cite:
  > Leung, R. et al. (2026). *OpenHalalan: The Philippine National and Local Election Dataset*. Zenodo. https://doi.org/10.5281/zenodo.17783099
- `corrections.json` lists our fixes to that source, each with a reason.
- `barangays.json` is a snapshot of current barangay and SK officials from the masterlist in the DILG Barangay Officials Directory (https://www.dilg.gov.ph/barangay-officials-directory/index), with phone numbers removed. Works of the Philippine government are not subject to copyright (RA 8293, sec. 176); our compilation is published under the ODbL with the rest. Cite DILG and the `pulledAt` date in the file.
- `sources/` holds the Bukidnon rows of each raw source, verbatim minus contact columns, and `manifest.json` with each download's address, date and SHA-256. The OpenHalalan extract stays under the ODbL; the DILG extract is a government work.
- `families.json` is the family ties curated by Better Bukidnon contributors. Each tie cites its own published sources. Quotes are kept short and attributed to their publishers, who keep the rights to their articles. Portraits are linked, not copied, and each one carries its own credit and license.

## Attribution

> Bukidnon Political Families, Better Bukidnon (https://dynasties.betterbukidnon.org), ODbL 1.0. Election results from OpenHalalan (Leung et al., 2026).
