# Vinted profile sync (local)

This small project runs a local Express server that scrapes a public Vinted profile and exposes a simple API for a static frontend to display products.

IMPORTANT: This scraper is intended for personal/local use only. Scraping websites may violate their Terms of Service. Use responsibly and avoid aggressive polling.

Setup

1. Install Node.js (v16+ recommended).
2. In the project folder run:

```bash
npm install
```

Run

```bash
npm start
```

This starts the server on http://localhost:3000. The frontend (`index.html`) will fetch `/api/products` to display products.

Notes and limitations

- The scraper in `scraper.js` parses the current public HTML on Vinted and looks for links containing `/items/`.
- Vinted markup or anti-scraping measures may change; this code may require adjustments.
- Images are downloaded into `public/images/` when possible and served from `/public/images/*`. If downloading fails the remote image URL is used directly.
- A cron job runs every 5 minutes to re-sync the profile. You can call `POST /sync` to force a sync.

If you'd like, I can convert this into a serverless function, add authentication, or improve the scraping robustness by using Vinted's internal APIs (requires auth/consent). 
