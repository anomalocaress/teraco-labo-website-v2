# Deploying to Vercel

This project is a static website with an Express-based API under `api/`.
The file `api/[...all].js` adapts the existing Express app to Vercel
serverless functions so all routes like `/api/health` work on Vercel.

## Quick steps

1. Commit and push to GitHub.
2. In Vercel, click "New Project" → Import this repository.
3. Settings:
   - Framework Preset: `Other` (No Build Step)
   - Build Command: leave empty
   - Output Directory: `.`
   - Root Directory: repository root (contains `index.html` and `api/`)
4. Set Environment Variables (optional, used by the API):
   - `TW_BEARER_TOKEN` or the pair `TW_CONSUMER_KEY`/`TW_CONSUMER_SECRET`
   - `TW_ACCESS_TOKEN`, `TW_ACCESS_SECRET`
   - `NOTE_API_TOKEN`
5. Deploy.

## Endpoints

- Health check: `/api/health`
- Web reservations intake: `/api/web-reservations`
- Simulated Twitter post: `/api/twitter/post`
- Simulated note post: `/api/note/post`
- Blog publish (generates `blog/*.html` on the fly and writes to storage on the server filesystem during the function execution window): `/api/blog/publish`

Note: On Vercel, the function execution filesystem is ephemeral. The `blog/*.html`
files are generated during a call to `/api/blog/publish` and returned with a URL,
but they are not persisted across deployments. If you want permanent blog files,
commit them to the repo or back them with object storage (e.g. S3) from the API.

## Local development

You can run the API locally with:

```bash
node api/social-integration.js
```

This starts an Express server on `http://localhost:3001`.

