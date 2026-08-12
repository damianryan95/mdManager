'use strict';

const express = require('express');
const { getLocation } = require('../config');
const { listDirectory, readFile, readRaw } = require('../services/fileScanner');

const router = express.Router();

// GET /api/files/list?locationId=&path=
router.get('/list', async (req, res) => {
  const { locationId, path: relPath = '' } = req.query;
  if (!locationId) return res.status(400).json({ error: 'locationId required' });

  const location = getLocation(locationId);
  if (!location) return res.status(404).json({ error: 'Location not found' });

  try {
    const entries = await listDirectory(location, relPath);
    res.json(entries);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/files/content?locationId=&path=
router.get('/content', async (req, res) => {
  const { locationId, path: relPath } = req.query;
  if (!locationId || !relPath) return res.status(400).json({ error: 'locationId and path required' });

  const location = getLocation(locationId);
  if (!location) return res.status(404).json({ error: 'Location not found' });

  try {
    const content = await readFile(location, relPath);
    res.json({ content, path: relPath, locationId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/files/raw?locationId=&path=  → raw bytes (images/PDF/etc. beside docs)
router.get('/raw', async (req, res) => {
  const { locationId, path: relPath } = req.query;
  if (!locationId || !relPath) return res.status(400).json({ error: 'locationId and path required' });

  const location = getLocation(locationId);
  if (!location) return res.status(404).json({ error: 'Location not found' });

  try {
    const { buffer, contentType } = await readRaw(location, relPath);
    res.set('Content-Type', contentType);
    res.set('Cache-Control', 'private, max-age=300');
    res.send(buffer);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

module.exports = router;
