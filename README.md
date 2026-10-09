# Personal OS

A standalone personal planning and wellbeing app. This repository is independent from Persuna App, Persuna OS, and the Persuna Studio website.

## Stack
- React + TypeScript + Vite
- Responsive pastel-gradient interface
- Device-local persistence plus optional Supabase cloud sync
- Private per-user data stored in PostgreSQL with Row Level Security (RLS)

## Run locally
1. Copy `.env.example` to `.env.local` (the public project URL/key are prefilled for this project).
2. Install dependencies and start the app:
```bash
npm install
npm run dev
```
3. Use the account/avatar button in the app and request a secure email sign-in link to enable cloud sync.

## Build validation
GitHub Actions runs a production build on pushes and pull requests to `main`.

## Data and privacy
The app always keeps a local copy in this browser. Once signed in, it also syncs the workspace to the private `user_workspace` table. Row Level Security restricts reads/writes to the authenticated user's own row. Only the publishable browser key is used; never add a service-role key to the client or repository. Cloud sync requires the deployment's environment variables and the Supabase Auth email sign-in to be configured. Finance values begin at zero and are illustrative until edited. This is a personal planning tool, not a diagnostic or medical record system.
