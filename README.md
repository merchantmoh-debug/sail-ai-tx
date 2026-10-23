# SAIL AI-Tx Challenge

Submission workspace for four therapeutic actionability reports generated with Codex.

Status: official inputs and format checks are prepared. Final reports have not been generated or submitted.

## Files

- `inputs/patients.json`: the four official hypothetical patient records, unchanged.
- `inputs/report_template.md`: the official report template, unchanged.
- `inputs/provenance.json`: source URLs, retrieval date, and SHA-256 digests.
- `tools/validate.mjs`: local format checks based on the official upload page.
- `tests/validate.test.mjs`: synthetic format tests; these are not patient reports.

## Validation

Requires Node.js 20 or newer. No packages or model APIs are needed.

```sh
node --test
node tools/validate.mjs reports.json
```

The final file must contain exactly one object for each official patient, with only `id` and `report_markdown` fields. Local checks cover IDs, fields, heading order, UTF-16 length, file size, and the upload page's active-content patterns. A format pass does not establish medical accuracy or server acceptance.

## Challenge

Official deadline: December 1, 2026. See the [submission rules](https://aitxchallenge.org/models/) and [report requirements](https://aitxchallenge.org/).

The final reports must be system-generated without manual editing. Each report must support its claims, explain relevant conditions, and distinguish established, emerging, and hypothesized actions.

This repository contains submission materials and generic format tooling. No license to other materials is granted.
