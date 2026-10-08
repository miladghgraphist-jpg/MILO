# MILO — Personal Operating Planner

Independent personal planner built with React + Vite + Supabase.

## Architecture
- GitHub: miladghgraphist-jpg/MILO
- Supabase: independent MILO project
- Vercel: deploy this repository as its own project
- Auth + PostgreSQL + RLS + Realtime

## Local setup
1. Copy .env.example to .env.local
2. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY
3. npm install
4. npm run dev

## Design direction
Dark gray premium UI, restrained purple accent, RTL/Persian-first, responsive desktop/mobile.

## Isolation
This repository must never share deployment, environment variables, or database resources with Persuna-App.
