/**
 * 🧭 Vinted Profile Scraper
 * ---------------------------------
 * Scrapes all listings from a Vinted profile (title, price, image, link)
 * and saves them locally as JSON + downloaded images.
 *
 * ✅ Uses Puppeteer Stealth Plugin to avoid detection
 * ✅ Auto-scrolls to load all listings
 * ✅ Saves results to products.json
 * ✅ Downloads images to /public/images
 *
 * Run with:   node vintedSync.js
 * Dependencies: puppeteer-extra, puppeteer-extra-plugin-stealth, node-fetch@2
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

// === CONFIG ===
const PROFILE_URL = 'https://www.vinted.cz/member/288077372-praguevintageshop';
const PRODUCTS_FILE = path.join(__dirname, 'products.json');
const IMAGES_DIR = path.join(__dirname, 'public', 'images');

// Ensure folders exist
if (!fs.existsSync(path.join(__dirname, 'public'))) fs.mkdirSync(path.join(__dirname, 'public'));
if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR, { recursive: true });

// === HELPERS ===
function sanitizeFilename(s) {
  return s.replace(/[^a-z0-9-_\.]/gi, '_').slice(0, 200);
}

async function downloadImage(url, filename) {
  const outPath = path.join(IMAGES_DIR, filename);
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Fetch failed: ${res.statusText}`);
    const fileStream = fs.createWriteStream(outPath);
    await new Promise((resolve, reject) => {
      res.body.pipe(fileStream);
      res.body.on('error', reject);
      fileStream.on('finish', resolve);
    });
    return `/public/images/${filename}`;
  } catch (err) {
    console.warn('⚠️ Failed to download image:', url, err.message);
    return url;
  }
}

async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 600;
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;
        if (totalHeight >= scrollHeight - window.innerHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 500);
    });
  });
}

// === MAIN ===
async function syncProfile() {
  console.log(`🧭 Syncing profile: ${PROFILE_URL}`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();

  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0 Safari/537.36'
  );
  await page.setViewport({ width: 1280, height: 900 });

  await page.goto(PROFILE_URL, { waitUntil: 'networkidle2', timeout: 60000 });

  console.log('🔄 Scrolling to load all items...');
  await autoScroll(page);

  console.log('📦 Extracting product links...');
  const productLinks = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('a[href*="/items/"]'));
    const seen = new Set();
    const links = [];
    for (const el of items) {
      const href = el.getAttribute('href');
      if (!href) continue;
      const full = href.startsWith('http') ? href : `https://www.vinted.cz${href}`;
      if (!seen.has(full)) {
        seen.add(full);
        links.push(full);
      }
    }
    return links;
  });

  console.log(`✅ Found ${productLinks.length} products`);

  const products = [];

  for (let i = 0; i < productLinks.length; i++) {
    const link = productLinks[i];
    console.log(`🛍️ [${i + 1}/${productLinks.length}] ${link}`);
    const prodPage = await browser.newPage();
    try {
      await prodPage.goto(link, { waitUntil: 'networkidle2', timeout: 40000 });
      await prodPage.waitForSelector('h1, [class*="price"], img[src*="vinted.net"]', { timeout: 15000 });

      const data = await prodPage.evaluate(() => {
        const title =
          document.querySelector('h1')?.textContent.trim() ||
          document.querySelector('meta[property="og:title"]')?.content || '';

        const priceEl = Array.from(document.querySelectorAll('[class*="price"], span, div')).find(e =>
          /[0-9]+.*(Kč|€|\$)/.test(e.textContent)
        );
        const price = priceEl ? priceEl.textContent.trim() : '';

        const img =
          document.querySelector('meta[property="og:image"]')?.content ||
          document.querySelector('img[src*="vinted.net"]')?.src || '';

        return { title, price, img };
      });

      if (!data.title && !data.price && !data.img) {
        console.warn('⚠️ Empty product data:', link);
      }

      // Download image
      let localImage = data.img;
      if (data.img && data.img.startsWith('http')) {
        const ext = path.extname(new URL(data.img).pathname) || '.jpg';
        const fname = sanitizeFilename(`${i}_${path.basename(link)}${ext}`);
        localImage = await downloadImage(data.img, fname);
      }

      products.push({ link, ...data, localImage });
    } catch (err) {
      console.warn('⚠️ Failed to process product:', link, err.message);
      products.push({ link, title: '', price: '', img: '', localImage: '' });
    }
    await prodPage.close();
  }

  await browser.close();

  fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2));
  console.log(`💾 Saved ${products.length} products to ${PRODUCTS_FILE}`);

  return products;
}

// Run if executed directly
if (require.main === module) {
  syncProfile().catch(console.error);
}

module.exports = { syncProfile, PRODUCTS_FILE };

/*
----------------------------------------
📦 HOW TO USE (for your GitHub repo)
----------------------------------------
1. npm install puppeteer-extra puppeteer-extra-plugin-stealth node-fetch@2
2. node vintedSync.js
3. Results:
   - products.json with all scraped data
   - /public/images/ with downloaded images
4. Add this to .gitignore:
     node_modules/
     public/images/
     products.json
     debug_product_page.html
----------------------------------------
*/
