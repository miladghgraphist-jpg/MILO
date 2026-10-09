# Personal OS

A standalone personal planning and wellbeing app. This repository is independent from Persuna App, Persuna OS, and the Persuna Studio website.

## Stack
- React + TypeScript + Vite
- Responsive pastel-gradient interface
- Device-local persistence for tasks, mood, wellbeing sliders, reflections, and finance entries
- Supabase cloud sync planned; no credentials are committed

## Run locally
```bash
npm install
npm run dev
```

## Build validation
GitHub Actions runs a production build on pushes and pull requests to `main`.

## Data and privacy
Until cloud sync is configured, app data is stored in this browser on this device. It does not sync between devices and can be cleared with browser site data. Finance values begin at zero and are illustrative until edited. Do not enter highly sensitive medical or financial details until account access, cloud security, and backups are configured.
