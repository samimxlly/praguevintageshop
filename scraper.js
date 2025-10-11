const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const PROFILE_URL = 'https://www.vinted.cz/member/288077372-praguevintageshop';
const PRODUCTS_FILE = path.join(__dirname, 'products.json');
const IMAGES_DIR = path.join(__dirname, 'public', 'images');
if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR, { recursive: true });

async function downloadImage(url, filename) {
  const outPath = path.join(IMAGES_DIR, filename);
  try {
    // Dynamically import node-fetch for Node.js streaming
    const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch image');
    const fileStream = fs.createWriteStream(outPath);
    await new Promise((resolve, reject) => {
      res.body.pipe(fileStream);
      res.body.on('error', reject);
      fileStream.on('finish', resolve);
    });
    return `/public/images/${filename}`;
  } catch (err) {
    console.warn('Failed to download image', url, err.message);
    return url;
  }
}

function sanitizeFilename(s) {
  return s.replace(/[^a-z0-9-_\.]/gi, '_').slice(0, 200);
}

async function syncProfile() {
  console.log('Syncing profile (puppeteer)', PROFILE_URL);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  });
  const page = await browser.newPage();
  await page.goto(PROFILE_URL, { waitUntil: 'networkidle2', timeout: 60000 });

  // Wait for product tiles to appear
  await page.waitForSelector('a[href*="/items/"]', { timeout: 20000 }).catch(() => {});

  // Extract product links from the DOM
  const productLinks = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('a[href*="/items/"]'));
    const seen = new Set();
    const links = [];
    for (const el of items) {
      const href = el.getAttribute('href');
      if (!href) continue;
      const full = href.startsWith('http') ? href : `https://www.vinted.cz${href}`;
      if (seen.has(full)) continue;
      seen.add(full);
      links.push(full);
    }
    return links;
  });

  const products = [];
  // Visit each product page and extract info
  for (let idx = 0; idx < productLinks.length; idx++) {
    const link = productLinks[idx];
    try {
      const prodPage = await browser.newPage();
      const response = await prodPage.goto(link, { waitUntil: 'networkidle2', timeout: 40000 });
      const status = response ? response.status() : 'NO_RESPONSE';
      if (status !== 200) {
        console.warn(`[SCRAPER] Failed to load product page: ${link} (status: ${status})`);
      }
      // Wait for main content: h1, price, or image
      await prodPage.waitForSelector('h1, [class*="price"], img[src*="vinted.net"]', { timeout: 15000 }).catch(() => {});
      const data = await prodPage.evaluate(() => {
        // Title: h1 or meta og:title
        let title = '';
        const h1 = document.querySelector('h1');
        if (h1) title = h1.textContent.trim();
        if (!title) {
          const og = document.querySelector('meta[property="og:title"]');
          if (og) title = og.getAttribute('content') || '';
        }
        // Price: look for any element with a currency
        let price = '';
        const priceEl = Array.from(document.querySelectorAll('[class*="price"], span, div')).find(e => /[0-9]+.*(Kč|€|\$)/.test(e.textContent));
        if (priceEl) price = priceEl.textContent.trim();
        // Image: og:image or first vinted.net image
        let img = '';
        const ogimg = document.querySelector('meta[property="og:image"]');
        if (ogimg) img = ogimg.getAttribute('content') || '';
        if (!img) {
          const imgEl = document.querySelector('img[src*="vinted.net"]');
          if (imgEl) img = imgEl.src;
        }
        return { title, price, img };
      });
      // If all fields are empty, log HTML for debugging (only for first product)
      if (!data.title && !data.price && !data.img && idx === 0) {
        const html = await prodPage.content();
        require('fs').writeFileSync('debug_product_page.html', html);
        console.warn(`[SCRAPER] Extracted nothing from: ${link} (status: ${status})`);
      }
      products.push({ link, ...data });
      await prodPage.close();
    } catch (err) {
      console.warn(`[SCRAPER] Exception for product: ${link} - ${err}`);
      products.push({ link, title: '', price: '', img: '' });
    }
  }
  await browser.close();

  // Download images and add localImage
  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    if (p.img && p.img.startsWith('http')) {
      try {
        const ext = path.extname(new URL(p.img).pathname) || '.jpg';
        const fname = sanitizeFilename(`${i}_${path.basename(p.link)}${ext}`);
        // Use node-fetch for image download
        const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
        const local = await downloadImage(p.img, fname, fetch);
        p.localImage = local;
      } catch (err) {
        p.localImage = p.img;
      }
    } else {
      p.localImage = p.img;
    }
  }

  fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2));
  console.log('Saved', products.length, 'products to', PRODUCTS_FILE);
  return products;
}

module.exports = { syncProfile, PRODUCTS_FILE };
