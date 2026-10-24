-- V3 — Sibling-name uniqueness for locations (service-layer rule backed at the DB).
-- Docs: docs/architecture/DATABASE_SCHEMA.md §3.4 (Prisma cannot express partial
-- unique indexes).
--
-- Roots and non-roots are indexed separately because NULL parent_id values are
-- considered distinct inside a B-tree unique index. Archived locations are
-- excluded so two archived siblings may share a name; the service layer must
-- therefore re-check uniqueness on un-archive. NOTE: the index expression
-- lower(trim(name)) is a safety net only — the canonical normalization
-- (collapse inner whitespace, etc.) lives in src/server/rules/locations.ts.

CREATE UNIQUE INDEX idx_locations_root_sibling_name
  ON locations (owner_id, lower(trim(name)))
  WHERE parent_id IS NULL AND archived_at IS NULL;

CREATE UNIQUE INDEX idx_locations_sibling_name
  ON locations (owner_id, parent_id, lower(trim(name)))
  WHERE parent_id IS NOT NULL AND archived_at IS NULL;
