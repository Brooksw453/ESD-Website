-- ============================================
-- Document Ally Pro — Waitlist Table
-- Run this in your Supabase SQL Editor
-- ============================================

-- Create the waitlist table
CREATE TABLE IF NOT EXISTS waitlist (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    created_at timestamptz DEFAULT now() NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    institution text,
    role text,
    pilot_interest boolean DEFAULT false,
    message text
);

-- Add a unique constraint on email to prevent duplicate signups
ALTER TABLE waitlist ADD CONSTRAINT waitlist_email_unique UNIQUE (email);

-- Enable Row Level Security
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts (website visitors can submit the form)
CREATE POLICY "Allow anonymous inserts"
    ON waitlist
    FOR INSERT
    TO anon
    WITH CHECK (true);

-- Allow authenticated users (you) to read all rows
CREATE POLICY "Allow authenticated reads"
    ON waitlist
    FOR SELECT
    TO authenticated
    USING (true);

-- Optional: add an index on created_at for sorting
CREATE INDEX idx_waitlist_created_at ON waitlist (created_at DESC);
