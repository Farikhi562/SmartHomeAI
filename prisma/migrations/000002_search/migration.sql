-- V2 — Search implementation (D6: FTS + pg_trgm, no vectors; FR-005/FR-006/FR-020)
-- Docs: docs/architecture/DATABASE_SCHEMA.md §5. Prisma cannot express extensions
-- or generated tsvector columns declaratively.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Full-text vector on items ('simple' dictionary: names/categories are not prose).
-- Generated column: stays fresh automatically on any UPDATE (no trigger needed).
ALTER TABLE items
  ADD COLUMN search_tsv tsvector
  GENERATED ALWAYS AS (
    to_tsvector('simple',
      coalesce(name,'') || ' ' || coalesce(description,'') || ' ' || coalesce(category,''))
  ) STORED;

CREATE INDEX idx_items_search_tsv ON items USING GIN (search_tsv);

-- Trigram indexes power prefix/typo matching (similarity()/ILIKE '%q%').
-- Expressions are lower() so index and query normalize identically.
CREATE INDEX idx_items_name_trgm    ON items USING GIN (lower(name) gin_trgm_ops);
CREATE INDEX idx_locations_name_trgm ON locations USING GIN (lower(name) gin_trgm_ops);
CREATE INDEX idx_aliases_trgm        ON item_aliases USING GIN (lower(normalized_alias) gin_trgm_ops);
