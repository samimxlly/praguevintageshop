# Vinted profile sync (GitHub Pages)

This project scrapes a public Vinted profile and displays products on a static GitHub Pages site.

**IMPORTANT**: This scraper is intended for personal/local use only. Scraping websites may violate their Terms of Service. Use responsibly and avoid aggressive polling.

## Live Site

The site is automatically deployed to GitHub Pages at: `https://[username].github.io/praguevintageshop`

## How it works

1. A GitHub Actions workflow (`scrape-and-commit.yml`) runs every 3 minutes to scrape the Vinted profile
2. The scraped data is committed to `products.json` in the repository
3. Another workflow (`deploy-github-pages.yml`) automatically deploys the static site to GitHub Pages
4. The frontend (`index.html`) fetches and displays products from `products.json`

## Setup

### Enable GitHub Pages

1. Go to your repository Settings → Pages
2. Under "Build and deployment", select "GitHub Actions" as the source
3. The site will be automatically deployed on every push to the main branch

### Local Development

1. Install Node.js (v16+ recommended)
2. In the project folder run:

```bash
npm install
```

### Run locally

```bash
npm start
```

This starts a local server on http://localhost:3000 for testing. The frontend (`index.html`) will fetch `/api/products` from the server.

### Open index.html directly

You can also open `index.html` directly in a browser. It will load products from `products.json` in the same directory, simulating the GitHub Pages environment.

## Notes and limitations

- The scraper in `scraper.js` parses the current public HTML on Vinted and looks for links containing `/items/`
- Vinted markup or anti-scraping measures may change; this code may require adjustments
- Images are loaded directly from Vinted CDN URLs
- A GitHub Actions workflow runs every 3 minutes to re-sync the profile
- The site is hosted on GitHub Pages and updates automatically when `products.json` changes

## Architecture

- **GitHub Actions**: Automated scraping workflow that updates product data
- **GitHub Pages**: Hosts the static frontend
- **Static files**: `index.html` (frontend), `products.json` (product data)
- **No server required**: Everything runs as static files on GitHub Pages 
