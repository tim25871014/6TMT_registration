# 6TMT_registration

Registration webpage + backend for 6TMT2, built with Node.js, osu! API v2 OAuth2 and PostgreSQL, deployable on Railway.

## Features

- Simple landing page with a "Sign up with osu!" button
- Redirects users to osu! OAuth2 authorization page
- After authorization, exchanges the code for an access token and calls `/api/v2/me` to get user info
- Stores osu user id and username in a PostgreSQL `participants` table

## Environment variables

Copy `.env.example` to `.env` and fill in:

- `PORT`: Local server port, e.g. `3000` (Railway sets this automatically in production)
- `OSU_CLIENT_ID`: Your osu OAuth client ID
- `OSU_CLIENT_SECRET`: Your osu OAuth client secret
- `OSU_REDIRECT_URI`: OAuth redirect URL registered in osu (e.g. `http://localhost:3000/auth/osu/callback` for local dev, and your Railway URL + `/auth/osu/callback` in production)
- `USE_POSTGRES`: Set to `true` **only** when you want to use PostgreSQL (e.g. on Railway). For local/simple testing, leave it unset or `false` to use file-based storage.
- `DATABASE_URL`: PostgreSQL connection string (Railway will provide one if you attach a PostgreSQL plugin).
- `PGSSLMODE`: Usually `require` on Railway; set to `disable` only for local DB without SSL
- `ADMIN_TOKEN`: Optional token for admin API/page. If set, requests to `/api/admin/participants` must include `Authorization: Bearer YOUR_TOKEN`.

## Local development

1. Install dependencies:

	```bash
	npm install
	```

2. Start the dev server with auto-restart:

	```bash
	npm run dev
	```

3. Open the page:

	- http://localhost:3000

Click the button to be redirected to the osu authorization page. After granting access, you will be redirected back to `/auth/osu/callback`, your osu user will be stored in the database, and a simple success message will be displayed.

If `USE_POSTGRES` is **not** `true`, data is stored locally in `data/participants.json` instead of PostgreSQL.

### Admin page

- Open http://localhost:3000/admin
- (Optional) If you set `ADMIN_TOKEN` in `.env`, enter that token in the "Admin Token" field before loading; otherwise the admin API is open.
- You can:
	- View all participants
	- Add/update a participant (by osu user id + username)
	- Delete a participant from the list

## Railway deployment

1. Push this project to a Git repository (GitHub, GitLab, etc.).
2. In Railway, create a new project and select "Deploy from Repo" (or similar) and connect your repo.
3. Add a PostgreSQL plugin in Railway; it will create a `DATABASE_URL` environment variable automatically.
4. In the Railway project settings, add the following environment variables:

	- `OSU_CLIENT_ID`
	- `OSU_CLIENT_SECRET`
	- `OSU_REDIRECT_URI` set to `https://your-railway-app-url/auth/osu/callback`

5. Railway will detect `npm start` as the start command (or configure it manually if needed).
6. Update your osu OAuth application settings to include the Railway callback URL as an allowed redirect.

Once deployed, users can open your Railway URL, click the button, login via osu, and their user id + username will be stored in the `participants` table.

