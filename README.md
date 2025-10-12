# Prague Vintage Shop

This project displays a Vinted profile's products on a static website that can be hosted on GitHub Pages.

## GitHub Pages Setup

The site is automatically deployed to GitHub Pages using GitHub Actions. To enable it:

1. Go to your repository Settings → Pages
2. Under "Build and deployment", select:
   - Source: **GitHub Actions**
3. The site will be deployed automatically on every push to the main branch

The site will be available at: `https://samimxlly.github.io/praguevintageshop/`

## Local Development (Optional)

If you want to run the scraper and server locally:

### Setup

1. Install Node.js (v16+ recommended).
2. In the project folder run:

```bash
npm install
```

### Run

```bash
npm start
```

This starts the server on http://localhost:3000. The frontend (`index.html`) will fetch `/api/products` to display products.

## How It Works

- The GitHub Actions workflow (`.github/workflows/scrape-and-commit.yml`) scrapes the Vinted profile every 3 minutes and updates `products.json`
- Another workflow (`.github/workflows/deploy-pages.yml`) deploys the static site to GitHub Pages whenever changes are pushed to the main branch
- The `index.html` page fetches data from `products.json` and displays the products
- Product images are loaded from Vinted's CDN (external URLs)

**Note on Scheduled Workflows:** GitHub Actions scheduled workflows only run on the default branch and may be disabled in repositories with limited activity. You can also manually trigger the workflow from the Actions tab using the "Run workflow" button.

## Notes and Limitations

- The scraper in `scraper.js` parses the current public HTML on Vinted and looks for links containing `/items/`.
- Vinted markup or anti-scraping measures may change; this code may require adjustments.
- Images are served from Vinted's CDN directly (not downloaded locally to keep the repository size small)
- The scraper runs every 3 minutes via GitHub Actions to keep products up to date

**IMPORTANT:** This scraper is intended for personal use only. Scraping websites may violate their Terms of Service. Use responsibly and avoid aggressive polling. 
