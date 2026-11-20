# Daniel Burden — Portfolio CMS

A full-stack personal portfolio for Cloudflare Pages, Pages Functions, D1 and optional R2.
The public site is served at `/`; the private content dashboard is at `/admin`.

## Important deployment note

This is a deployable source project, not a live website. It becomes live only after you connect it to your Cloudflare account, create the D1 database, configure bindings/secrets, and attach your domain. I cannot access your Cloudflare account or publish it on your behalf.

## Features

- Responsive portfolio homepage with About, selected work and contact sections.
- `/admin` dashboard with login, first-admin setup, site settings and project management.
- D1-backed content; changes appear on the public site after saving.
- Optional R2 image uploads (the dashboard clearly reports when R2 is not configured).
- PBKDF2 password hashing, opaque server-side sessions, HttpOnly/Secure/SameSite cookies, expiry, login throttling, authorization checks, same-origin checks and server-side validation.
- No frontend credentials or default password.

## Cloudflare free-tier notes (checked 20 Nov 2026)

Cloudflare's published free allowances include Pages 500 builds/month, 100 custom domains per project, D1 500 MB per database, 5 million rows read/day and 100,000 rows written/day. R2 Standard includes 10 GB-month, 1 million Class A requests and 10 million Class B requests/month, with internet egress free. Pages Function invocations count against Workers Free request limits (currently 100,000/day). Limits can change; check the official pages before deployment:
- https://developers.cloudflare.com/pages/platform/limits/
- https://developers.cloudflare.com/d1/platform/pricing/
- https://developers.cloudflare.com/r2/pricing/
- https://developers.cloudflare.com/pages/functions/pricing/

Free-tier usage is not unlimited. Exceeding included limits can stop requests or incur charges depending on product/settings. R2 is optional, but image upload requires an R2 bucket binding.

## Beginner-friendly deployment

You will need a Cloudflare account and a GitHub account. The easiest no-terminal route is to upload the extracted project files to a new GitHub repository using GitHub's website, then connect that repository to Cloudflare Pages.

### A. Upload the project to GitHub in your browser
1. Download and extract this ZIP on your computer.
2. Sign in to GitHub and create a new **private** repository named `daniel-burden-portfolio`.
3. Choose **Add file → Upload files**.
4. Drag the *contents* of the extracted project folder into the upload area (including the `functions` folder and `wrangler.toml`).
5. Commit the files to the repository's default branch.

### B. Create the D1 database
1. In Cloudflare Dashboard, open **Workers & Pages → D1 SQL Database**.
2. Create a database named `daniel-portfolio`.
3. Open its SQL console and paste the complete contents of `schema.sql`, then run it.
4. Copy the database ID shown in its overview.

### C. Create the Pages project
1. Open **Workers & Pages → Create → Pages → Connect to Git**.
2. Select the GitHub repository you just created.
3. Framework preset: **None**. Build command: leave blank. Build output directory: `public`.
4. Create/deploy the project.
5. In the Pages project, open **Settings → Functions → D1 database bindings**. Add binding name `DB` and select `daniel-portfolio`.
6. Add an environment variable named `SITE_ORIGIN` with your eventual canonical origin, e.g. `https://example.com`. You can initially use your `https://your-project.pages.dev` address.
7. Add a secret named `SETUP_TOKEN`. Generate a long random value (at least 32 characters); do not reuse a password. Keep it private. In Cloudflare's dashboard, add it under **Settings → Environment variables → Secrets**.
8. Save and redeploy.

### D. Optional image uploads
1. In Cloudflare, open **R2 Object Storage** and create a bucket named `daniel-portfolio-media`.
2. In Pages project **Settings → Functions → R2 bucket bindings**, add binding name `MEDIA` and select that bucket.
3. Redeploy. The application serves uploaded images through its own public read-only media endpoint; you do not need to make the bucket public or create a separate media domain.
4. Without this binding, the rest of the site works; image upload is disabled and projects can still use externally hosted image URLs.

### E. Create your administrator
1. Visit `https://your-project.pages.dev/admin`.
2. Enter the exact `SETUP_TOKEN` you created, your email address and a strong unique password.
3. The first administrator is created once only. The setup endpoint is disabled after an administrator exists.
4. Sign in. Change the placeholder copy, projects, contact details and social links in the dashboard.
5. After successful setup, remove the `SETUP_TOKEN` secret from the Pages project settings and redeploy. This prevents any future setup attempt even if the database is later emptied accidentally.

### F. Connect your own domain
1. In Cloudflare, open your Pages project → **Custom domains** → **Set up a custom domain**.
2. Enter your root domain, e.g. `example.com`, and follow Cloudflare's DNS prompts.
3. Add `www.example.com` too if you want the www version. Choose one canonical address and set `SITE_ORIGIN` to it (including `https://`).
4. Redeploy after changing `SITE_ORIGIN`.

## How to use the dashboard

- **Overview:** quick links and sign-out.
- **Site content:** edit the hero heading, introduction, biography, contact email and social URLs.
- **Projects:** add, edit, delete, reorder, set a featured image URL, or upload an image if R2 is configured.
- Save each section to publish changes. The public website fetches current content from D1.

## Security and operational notes

- Use a unique password and keep `SETUP_TOKEN` private. Do not commit secrets to GitHub.
- Session cookies are `HttpOnly`, `Secure` on HTTPS, `SameSite=Strict`, and expire after seven days. Sessions are stored as SHA-256 hashes in D1.
- Login attempts are throttled by hashed client IP; this is a basic application-level throttle, not a replacement for Cloudflare WAF/rate limiting.
- The initial setup token is a bootstrap secret. Remove it after creating the admin.
- Uploads are limited to 5 MB and accepted image MIME types are JPEG, PNG, WebP and GIF. Use only images you have permission to publish.
- The project has no analytics, email marketing or external tracking.
- Back up D1 content periodically using Cloudflare's export tools.

## Project structure

```text
public/                 Public pages, styles and browser JavaScript
functions/api/[[path]].js  API, authentication, content management and uploads
schema.sql              D1 schema and initial placeholder content
wrangler.toml           Cloudflare project configuration reference
```

## Local preview

The app requires Cloudflare Pages Functions and D1 bindings. A plain file preview will show the design but API-backed content/login will not work. For a full local development environment, a developer can use Wrangler with local D1 and R2 emulation; deployment through the Cloudflare/GitHub dashboards above avoids requiring you to run commands.
