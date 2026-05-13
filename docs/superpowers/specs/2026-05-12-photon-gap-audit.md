# Photon Spec-vs-Shipped Gap Audit

**Date:** 2026-05-12
**Source spec:** [`photon-design.md`](../../../photon-design.md)
**Ratification:** [`2026-05-12-photon-core-loop-ratification.md`](2026-05-12-photon-core-loop-ratification.md)
**Repo head at audit:** `41aea89`
**Scope:** read-only. No gameplay code is modified. Each row below cites file:line evidence.

## How to read this

Each row is one concrete claim from `photon-design.md` checked against `photon/src/`. Status values:
- `shipped` — claim is implemented and matches the design-doc numbers/behavior.
- `partial` — implemented but diverges from the design doc in a specific, named way.
- `missing` — no implementation found.
- `unverifiable` — would require a runtime playtest to confirm; static read is insufficient.

`Pillar impact` ranks how much a gap on this row degrades the named pillar(s). Fix size is the engineer's estimate of what closing the gap would cost.

## Findings

| Claim | Section | Status | Evidence | Pillar | Pillar impact | Fix size | Notes |
|---|---|---|---|---|---|---|---|

## Summary

_To be filled in by Task 11 after all rows are recorded._
