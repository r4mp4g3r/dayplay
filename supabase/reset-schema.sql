-- Run this FIRST to drop existing tables, then run schema.sql

-- Drop tables in reverse order (dependencies first)
drop table if exists public.saves cascade;
drop table if exists public.swipes cascade;
drop table if exists public.listing_tags cascade;
drop table if exists public.listing_photos cascade;
drop table if exists public.tags cascade;
drop table if exists public.listings cascade;
drop table if exists public.profiles cascade;

-- Now run schema.sql to recreate with correct types

