# GitHub Pages Setup Instructions

To complete the GitHub Pages setup, follow these manual steps:

## 1. Enable GitHub Pages in Repository Settings

1. Go to your repository: https://github.com/samimxlly/praguevintageshop
2. Click on **Settings** (top menu)
3. In the left sidebar, click on **Pages** (under "Code and automation")
4. Under "Build and deployment":
   - **Source**: Select "GitHub Actions" from the dropdown
   - This will allow the workflow to deploy automatically
5. Click **Save** if needed

## 2. Verify the Deployment

Once you merge this PR and the workflow runs:

1. Go to the **Actions** tab in your repository
2. You should see two workflows running:
   - "Scrape and commit" - Updates product data
   - "Deploy to GitHub Pages" - Deploys the site
3. Wait for both workflows to complete
4. Your site will be available at: `https://samimxlly.github.io/praguevintageshop`

## 3. Troubleshooting

If the site doesn't work:

- Check that GitHub Pages is enabled with "GitHub Actions" as the source
- Verify the workflow completed successfully in the Actions tab
- Check that `products.json` exists in your repository
- Try manually triggering the "Deploy to GitHub Pages" workflow:
  - Go to Actions → Deploy to GitHub Pages → Run workflow

## What Happens Automatically

- Every 3 minutes, the scraper workflow updates `products.json` with fresh Vinted data
- When `products.json` is updated, the deployment workflow automatically publishes the changes to GitHub Pages
- No server is needed - everything runs as static files!
