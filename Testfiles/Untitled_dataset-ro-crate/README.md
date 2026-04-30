# Untitled dataset

This bundle is an [**RO-Crate 1.1**](https://w3id.org/ro/crate/1.1) packaged by
**CSV-RDF-Mapper** on 2026-04-29T11:15:42.832Z.

## Contents

- `ro-crate-metadata.json` — RO-Crate metadata descriptor (root)
- `shapes/` — 12 SHACL profile(s) (`text/turtle`)
- `sources/` — 4 source table(s) (`text/csv`)
- `data/dataset.ttl` — generated RDF graph
- `mapping/mapping.json` — mapping definition (9 edge(s))

## Reproduction

Re-import the SHACL profiles and source tables into CSV-RDF-Mapper, then load
`mapping/mapping.json` to recreate the mapping. Re-running the generator will
reproduce `data/dataset.ttl` byte-for-byte.
