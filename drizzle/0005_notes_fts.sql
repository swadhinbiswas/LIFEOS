-- Hand-written (drizzle-kit cannot express virtual tables): the FTS5 index behind note search
-- (spec §6.5, ERD §2.4 `search_index`). `note_id` is UNINDEXED — it is the join key back to
-- `notes`, never a search term. Sync is owned by the notes service (insert/update/delete in the
-- same call that writes the note), so the index cannot drift from the table through a trigger
-- the ORM does not know about.
CREATE VIRTUAL TABLE IF NOT EXISTS `search_index` USING fts5(
  `title`,
  `body`,
  `note_id` UNINDEXED,
  tokenize = 'unicode61 remove_diacritics 2'
);
