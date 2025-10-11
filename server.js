const express = require('express');
const path = require('path');
const fs = require('fs');
const cron = require('node-cron');
const { syncProfile, PRODUCTS_FILE } = require('./scraper');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname)));

// API to get cached products
app.get('/api/products', (req, res) => {
  try {
    if (!fs.existsSync(PRODUCTS_FILE)) return res.json([]);
    const raw = fs.readFileSync(PRODUCTS_FILE, 'utf8');
    const data = JSON.parse(raw);
    res.json(data);
  } catch (err) {
    console.error('Error reading products file', err);
    res.status(500).send({ error: 'Failed to read products' });
  }
});

// Manual trigger
app.post('/sync', async (req, res) => {
  try {
    const result = await syncProfile();
    res.json({ ok: true, synced: result.length });
  } catch (err) {
    console.error('Sync failed', err);
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// schedule: every 5 minutes
cron.schedule('*/5 * * * *', async () => {
  try {
    console.log('[cron] running sync');
    await syncProfile();
    console.log('[cron] sync done');
  } catch (err) {
    console.error('[cron] sync error', err);
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
