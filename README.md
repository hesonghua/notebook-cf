# Notebook-CF

A simple, self-hosted note-taking application deployed on Cloudflare.

## Features

- Create, edit, and delete notes
- Organize notes into categories
- Markdown support for note formatting
- Syntax highlighting for code blocks
- **Image upload support** with drag & drop and paste
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
	"r2_buckets": [
		{
			"binding": "IMAGES",
			"bucket_name": "notebook-images"
		}
	],
	"vars": {
		"DATABASE_NAME": "notebook-db",
		"TURNSTILE_SITE_KEY": "your turnsitile site key, ignore if TURNSTILE_ENABLED=false",
		"TURNSTILE_ENABLED": "true",
		"R2_PUBLIC_URL": "https://pub-xxxxx.r2.dev"
	}
}
```

**6. Create R2 Bucket for Images (Optional)**

If you want to enable image upload functionality:

1. Create an R2 bucket named `notebook-images`:
	  ```bash
	  npx wrangler r2 bucket create notebook-images
	  ```

2. Enable public access:
	  - Go to [Cloudflare Dashboard](https://dash.cloudflare.com/) → R2
	  - Select `notebook-images` bucket
	  - Click **Settings** tab
	  - Under **Public access**, click **Allow Access**
	  - Copy the R2.dev URL (e.g., `https://pub-xxxxx.r2.dev`)

3. Update `R2_PUBLIC_URL` in `wrangler.jsonc` with your R2.dev URL

For production, you can use a custom domain instead of R2.dev URL. See the **Image Upload Configuration** section below for details.

**7. Apply Database Migrations**

Apply the database migrations to your D1 database. Wrangler will automatically find and apply the migrations from the `migrations` directory.

```bash
npx wrangler d1 migrations apply <YOUR_DATABASE_NAME>
```

**8. Deploy to Cloudflare**

Deploy the application to your Cloudflare account:

```bash
npm run deploy
```

**9. Configure Environment Variables**

After deploying, you need to configure the following environment variables in your Cloudflare dashboard (Workers & Pages -> Your Application -> Settings -> Variables):

| Type      | Name                 | Value                    |
|-----------|----------------------|--------------------------|
| Text      | `DATABASE_NAME`      | `notebook-db`            |
| Secret    | `JWT_SECRET`         | (Generate a secure secret) |
| Text      | `TURNSTILE_ENABLED`  | `true`                   |
| Secret    | `TURNSTILE_SECRET_KEY` | (Your Turnstile secret key) |
| Text      | `TURNSTILE_SITE_KEY` | (Your Turnstile site key) |
| Text      | `R2_PUBLIC_URL` | (Your R2.dev URL or custom domain) |

**Note:** If you set `TURNSTILE_ENABLED` to `false`, you may ignore `TURNSTILE_SECRET_KEY` and `TURNSTILE_SITE_KEY`.

## Image Upload Configuration

This application supports image uploads using Cloudflare R2 storage. Images can be uploaded by:
- **Drag & Drop**: Drag image files directly into the editor
- **Paste**: Copy an image and paste it in the editor (Ctrl+V)

### Setup R2 for Image Storage

**1. Create R2 Bucket**

```bash
npx wrangler r2 bucket create notebook-images
```

**2. Configure Public Access**

Choose one of the following methods:

#### Method A: Using R2.dev Subdomain (Recommended for Testing)

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/) → R2
2. Select `notebook-images` bucket
3. Click **Settings** tab
4. Under **Public access**, click **Allow Access**
5. Copy the R2.dev URL (format: `https://pub-xxxxx.r2.dev`)
6. Update `wrangler.jsonc`:
   ```jsonc
   "vars": {
     ...
     "R2_PUBLIC_URL": "https://pub-xxxxx.r2.dev"
   }
   ```

#### Method B: Using Custom Domain (Recommended for Production)

1. Go to your `notebook-images` bucket
2. Click **Settings** tab
3. Under **Custom Domains**, click **Connect Domain**
4. Enter your domain (e.g., `images.yourdomain.com`)
5. Follow the prompts to add DNS records
6. Update `wrangler.jsonc`:
   ```jsonc
   "vars": {
     ...
     "R2_PUBLIC_URL": "https://images.yourdomain.com"
   }
   ```

**3. Deploy**

After configuring R2, deploy your application:

```bash
npm run deploy
```

**4. Test Image Upload**

1. Log in to your application
2. Open or create a note
3. Switch to edit mode
4. Test the following:
   - **Drag & Drop**: Drag an image file into the editor
   - **Paste**: Copy an image and press Ctrl+V in the editor

Successfully uploaded images will be automatically inserted as Markdown: `![filename](url)`

### Image Upload Details

- **Free Tier**: 10GB storage, 10 million Class A operations per month
- **Max File Size**: 5MB (configurable in `api/upload-image.js`)
- **Supported Formats**: JPEG, PNG, GIF, WebP
- **Storage Structure**: Images are organized by user ID for easy management

### Troubleshooting

**Upload Fails**
1. Verify R2 bucket `notebook-images` exists
2. Check bucket name in `wrangler.jsonc` is correct
3. Verify `R2_PUBLIC_URL` environment variable is set correctly
4. Check browser console and Workers logs

**Images Don't Display**
1. Confirm R2 bucket has public access enabled
2. Verify image URLs are correct
3. Check browser console for CORS errors

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
