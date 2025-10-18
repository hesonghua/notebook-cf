# Notebook-CF

A simple, self-hosted note-taking application deployed on Cloudflare.

## Features

- Create, edit, and delete notes
- Organize notes into categories
- Markdown support for note formatting
- Syntax highlighting for code blocks
- Self-hosted on Cloudflare's serverless platform

## Deployment

You can deploy your own instance of this application to Cloudflare with a single click.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/YOUR_USERNAME/YOUR_REPOSITORY)

### Manual Deployment

Follow these steps to deploy the application manually:

**1. Clone the Repository**

```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
cd YOUR_REPOSITORY
```

**2. Install Dependencies**

```bash
npm install
```

**3. Log in to Cloudflare**

```bash
npx wrangler login
```

**4. Create a D1 Database**

Create a new D1 database for your application. Take note of the `database_name` and `database_id`.

```bash
npx wrangler d1 create <YOUR_DATABASE_NAME>
```

**5. Configure `wrangler.jsonc`**

```json
// wrangler.jsonc
{
	"$schema": "node_modules/wrangler/config-schema.json",
	"name": "notebook-cf",
	"compatibility_date": "2025-09-27",
	"main": "api/index.js",
	"assets": {
		"not_found_handling": "single-page-application"
	},
	"observability": {
		"enabled": true
	},
	"d1_databases": [
		{
			"binding": "DB",
			"database_name": "notebook-db",
			"database_id": "7e29a982-21c1-4f87-be73-87afd1c6ce65",
			"migrations_dir": "./migrations"
		}
	],
	"vars": {
		"DATABASE_NAME": "notebook-db",
		"TURNSTILE_SITE_KEY": "your turnsitile site key, ignore if TURNSTILE_ENABLED=false",
		"TURNSTILE_ENABLED": "true"
	}
}
```

**6. Apply Database Migrations**

Apply the database migrations to your D1 database. Wrangler will automatically find and apply the migrations from the `migrations` directory.

```bash
npx wrangler d1 migrations apply <YOUR_DATABASE_NAME>
```

**7. Deploy to Cloudflare**

Deploy the application to your Cloudflare account:

```bash
npm run deploy
```

**8. Configure Environment Variables**

After deploying, you need to configure the following environment variables in your Cloudflare dashboard (Workers & Pages -> Your Application -> Settings -> Variables):

| Type      | Name                 | Value                    |
|-----------|----------------------|--------------------------|
| Text      | `DATABASE_NAME`      | `notebook-db`            |
| Secret    | `JWT_SECRET`         | (Generate a secure secret) |
| Text      | `TURNSTILE_ENABLED`  | `true`                   |
| Secret    | `TURNSTILE_SECRET_KEY` | (Your Turnstile secret key) |
| Text      | `TURNSTILE_SITE_KEY` | (Your Turnstile site key) |
- if you set TURNSTILE_ENABLED to false, then may ignore TURNSTILE_SECRET_KEY and TURNSTILE_SITE_KEY

## Development

To run the application locally for development:

**1. Clone and Install**

```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
cd YOUR_REPOSITORY
npm install
```

**2. Configure Local Wrangler**

Set up your `wrangler.jsonc` as described in the deployment steps.

**3. Run the Development Server**

This command will start a local server with live reloading:

```bash
npm run dev
```

## License

This project is licensed under the MIT License.
