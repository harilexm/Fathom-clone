-- Migration: Add text column to highlights table for storing selected transcript text
-- Allows user-created and AI highlights to store the corresponding transcript excerpt

begin;

alter table public.highlights add column if not exists text text;

commit;
