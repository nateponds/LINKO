-- Add user_id to couriers to link courier accounts directly to their user profiles.
ALTER TABLE couriers
    ADD COLUMN user_id INT REFERENCES users(user_id) ON UPDATE CASCADE ON DELETE SET NULL;
