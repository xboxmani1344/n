-- Which plan a payment was for.
--
-- The first cut of the payments table left this out, and the checkout tried to
-- keep it in memory instead. That survives exactly as long as the process does:
-- a payer who comes back after a restart or a redeploy - which is a normal
-- thing to happen in the minutes they spend at the gateway - would have paid
-- for something the callback could no longer name.
ALTER TABLE payments ADD COLUMN plan TEXT;
