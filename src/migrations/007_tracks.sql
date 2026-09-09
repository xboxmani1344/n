-- Chats gained tracks: study, workout and diet, each with its own phases.
--
-- 'phased' was the only coached mode, so it meant study by definition. Rename
-- it rather than leaving two spellings of the same thing in the column. The
-- prompts module still resolves 'phased' defensively, but no rows should
-- carry it after this runs.
UPDATE chats SET mode = 'study' WHERE mode = 'phased';
