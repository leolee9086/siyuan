# MAGI Questionnaire Archives

These directories preserve retired questionnaire implementations for historical comparison.
They have no production consumers and intentionally live outside `app/src` so source type checking and dependency analysis cover only active runtime code.

- `legacy-custom/`: exact archive of the retired
  `app/src/magi/data/_backup/questionnaire-sections/` tree at the current
  migration boundary.
- `phase1/`: exact 26-file tree from
  `98353ee65b399699213a4b26c781f3c20b1e72fe:app/src/magi/data/questionnaire-sections/`,
  retained as the initial MAGI UI questionnaire snapshot.

Current production code is indexed by `app/src/magi/data/questionnaire-sections.ts`.
