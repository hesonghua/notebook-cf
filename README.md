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

Copy `wrangler.jsonc.example` to `wrangler.jsonc` and fill in your database details. The `wrangler.jsonc` file is ignored by Git, so your credentials will not be committed.

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
	"d1_databases": [
		{
			"binding": "DB",
			"database_name": "<YOUR_DATABASE_NAME>",
			"database_id": "<YOUR_DATABASE_ID>",
			"migrations_dir": "./migrations"
		}
	]
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
