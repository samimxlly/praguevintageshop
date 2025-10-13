/**
 * Enhanced Vinted Scraper Module
 * Works with server.js and GitHub Actions
 */

const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const fs = require("fs");
const path = require("path");
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

puppeteer.use(StealthPlugin());

const PROFILE_URL =
  process.env.VINTED_URL ||
  "https://www.vinted.cz/member/288077372-praguevintageshop";

const PRODUCTS_FILE = path.join(__dirname, "products.json");
const IMAGES_DIR = path.join(__dirname, "public", "images");
if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR, { recursive: true });

const SKIP_IMAGE_DOWNLOAD = process.env.SKIP_IMAGE_DOWNLOAD === "1";

function log(msg) {
  const now = new Date().toISOString().replace("T", " ").split(".")[0];
  console.log(`[${now}] ${msg}`);
}

function sanitizeFilename(s) {
  return s.replace(/[^a-z0-9-_\.]/gi, "_").slice(0, 120);
}

async function downloadImage(url, filename) {
  const outPath = path.join(IMAGES_DIR, filename);
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const fileStream = fs.createWriteStream(outPath);
    await new Promise((resolve, reject) => {
      res.body.pipe(fileStream);
      res.body.on("error", reject);
      fileStream.on("finish", resolve);
    });
    return `/public/images/${filename}`;
  } catch (err) {
    log(`⚠️ Image download failed: ${url} (${err.message})`);
    return url;
  }
}

/**
 * Scrape with retry logic
 */
async function syncProfile(maxRetries = 3) {
  console.log("Starting scraper...");
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await scrapeOnce();
    } catch (err) {
      log(`❌ Attempt ${attempt}/${maxRetries} failed: ${err.message}`);
      if (attempt < maxRetries) {
        log("⏳ Retrying in 10 seconds...");
        await new Promise((r) => setTimeout(r, 10000));
      } else {
        log("🚫 All retries failed. Giving up.");
        throw err;
      }
    }
  }
}

async function scrapeOnce() {
  log(`Starting scrape of ${PROFILE_URL}`);

  const launchOptions = {
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  };
  const browser = await puppeteer.launch(launchOptions);
  const page = await browser.newPage();

  await page.goto(PROFILE_URL, { waitUntil: "networkidle2", timeout: 0 });

  // Auto-scroll until all items load
  log("Scrolling page...");
  let lastHeight = 0;
  while (true) {
    const height = await page.evaluate("document.body.scrollHeight");
    if (height === lastHeight) break;
    lastHeight = height;
    await page.evaluate("window.scrollTo(0, document.body.scrollHeight)");
    await new Promise(resolve => setTimeout(resolve, 1500));
  }

  log("Extracting item data...");
  const products = await page.evaluate(() => {
    const items = [];
    
    // Use the correct selector for current Vinted structure
    const productLinks = document.querySelectorAll('a[href*="/items/"]');
    
    productLinks.forEach((linkEl) => {
      const link = linkEl.href;
      
      // Get title from the title attribute or nearby text
      let title = linkEl.getAttribute('title') || '';
      if (!title) {
        // Try to find title in parent container
        const parentBox = linkEl.closest('[class*="new-item-box"]');
        if (parentBox) {
          const titleEl = parentBox.querySelector('h3, h2, [class*="title"]');
          title = titleEl?.innerText?.trim() || '';
        }
      }
      
      // Extract price from title attribute or nearby elements
      let price = '';
      if (title.includes('Kč')) {
        const priceMatch = title.match(/(\d+(?:,\d+)?\s*Kč)/);
        price = priceMatch ? priceMatch[1] : '';
      }
      
      // Get image - look in the parent container and siblings
      let img = '';
      const parentBox = linkEl.closest('[class*="new-item-box"]');
      if (parentBox && parentBox.parentElement) {
        // Images are often in sibling elements
        const imgEl = parentBox.parentElement.querySelector('img.web_ui__Image__content, img[src*="vinted.net"]');
        img = imgEl?.src || '';
      }
      
      // Only add if we have essential data
      if (title && link) {
        items.push({ link, title, price, img });
      }
    });
    
    return items;
  });

  await browser.close();
  log(`Found ${products.length} products.`);

  if (!SKIP_IMAGE_DOWNLOAD) {
    log("Downloading images...");
    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      if (!p.img) continue;
      const ext = path.extname(new URL(p.img).pathname) || ".jpg";
      const fname = sanitizeFilename(`${i}_${path.basename(p.link)}${ext}`);
      p.localImage = await downloadImage(p.img, fname);
    }
  } else {
    log("⚡ Image download skipped (SKIP_IMAGE_DOWNLOAD=1).");
    for (const p of products) p.localImage = p.img;
  }

  const result = {
    lastUpdated: new Date().toISOString(),
    itemCount: products.length,
    items: products,
  };
  fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(result, null, 2));
  log(`💾 Saved ${products.length} items to products.json`);
  console.log("Scraper finished!");
  return products;
}

module.exports = { syncProfile, PRODUCTS_FILE };

// Run the scraper if this file is executed directly
if (require.main === module) {
  syncProfile()
    .then(() => {
      console.log('Scraper completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Scraper failed:', error);
      process.exit(1);
    });
}

