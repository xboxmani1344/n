-- A photograph of the question, attached to the message that asks about it.
--
-- Photographing a problem and asking what to do with it is the thing a student
-- actually wants from an app like this, and until now the only way to ask was
-- to type the question out - which for a geometry diagram or a printed test
-- paper means not asking at all.
--
-- Stored in the row rather than on disk. A file would mean paths to build,
-- orphans to sweep up after a deletion, and a second thing to back up beside
-- the database; a column is carried by the same ON DELETE CASCADE as
-- everything else and cannot be left behind. It is only affordable because
-- the browser shrinks the picture before sending it and the server refuses
-- anything past a hard cap - and because no query in this project selects *
-- from messages, so the hot paths never touch these bytes.
ALTER TABLE messages ADD COLUMN image BLOB;

-- The media type as accepted, so it can be served back and put into the
-- data: URI the model is sent. Trusting the file extension, or sniffing it
-- twice, are both worse than writing down what was checked on the way in.
ALTER TABLE messages ADD COLUMN image_type TEXT;
