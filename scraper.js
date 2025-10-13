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

  // Set a realistic user agent
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  );

  await page.goto(PROFILE_URL, { waitUntil: "networkidle2", timeout: 60000 });

  // Wait for items to load
  try {
    await page.waitForSelector("a[class*='item-card']", { timeout: 10000 });
  } catch (err) {
    log("⚠️ Items didn't load, trying to continue anyway...");
  }

  // Auto-scroll until all items load
  log("Scrolling page...");
  let lastHeight = 0;
  let scrollAttempts = 0;
  while (scrollAttempts < 10) {
    const height = await page.evaluate("document.body.scrollHeight");
    if (height === lastHeight) break;
    lastHeight = height;
    await page.evaluate("window.scrollTo(0, document.body.scrollHeight)");
    await page.waitForTimeout(1500);
    scrollAttempts++;
  }

  log("Extracting item data...");
  const products = await page.evaluate(() => {
    const items = [];
    document.querySelectorAll("a[class*='item-card']").forEach((el) => {
      const link = el.href;
      
      // Try multiple selectors for title
      let title = "";
      const titleEl = el.querySelector("h3, h2, [class*='ItemBox_title'], [class*='title']");
      if (titleEl) {
        title = titleEl.innerText?.trim() || titleEl.textContent?.trim() || "";
      }
      
      // Try multiple selectors for price  
      let price = "";
      const priceEl = el.querySelector("[class*='ItemBox_price'], [class*='Price'], [class*='price']");
      if (priceEl) {
        const priceText = priceEl.innerText?.trim() || priceEl.textContent?.trim() || "";
        // Only use price if it's reasonably short (actual prices are short)
        if (priceText && priceText.length < 100) {
          price = priceText;
        }
      }
      
      // Get image
      const img = el.querySelector("img")?.src || "";
      
      // Only add if we have at least a link and title, and filter out navigation/header text
      if (title && link && !title.includes("Přejít na obsah") && !title.includes("Katalog") && title.length < 200) {
        items.push({ link, title, price, img });
      }
    });
    return items;
  });

  await browser.close();
  log(`Found ${products.length} products.`);

  if (products.length === 0) {
    log("⚠️ Warning: No products found. Page structure may have changed.");
    // Don't overwrite existing data if we found nothing
    if (fs.existsSync(PRODUCTS_FILE)) {
      log("📋 Keeping existing products.json file.");
      return [];
    }
  }

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

  fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2));
  log(`💾 Saved ${products.length} items to products.json`);
  return products;
}

module.exports = { syncProfile, PRODUCTS_FILE };
