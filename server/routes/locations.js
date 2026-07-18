'use strict';

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getLocations, getLocation, addLocation, removeLocation } = require('../config');
const { buildIndex } = require('../services/searchIndex');
const smbManager = require('../services/smbManager');
const { scanLocation } = require('../services/fileScanner');

const router = express.Router();

// GET /api/locations
router.get('/', (_req, res) => {
  res.json(getLocations());
});

// POST /api/locations — add a location
router.post('/', async (req, res) => {
  const { name, type, path: localPath, host, share, username, password, domain } = req.body;

  if (!name || !type) return res.status(400).json({ error: 'name and type are required' });
  if (type === 'local' && !localPath) return res.status(400).json({ error: 'path is required for local locations' });
  if (type === 'smb' && (!host || !share)) return res.status(400).json({ error: 'host and share are required for SMB locations' });

  const location = {
    id: uuidv4(),
    name,
    type,
    ...(type === 'local' ? { path: localPath } : { host, share, username, password, domain }),
    createdAt: new Date().toISOString(),
    lastScanned: null,
    fileCount: 0,
  };

  await addLocation(location);
  res.status(201).json(location);
});

// DELETE /api/locations/:id
router.delete('/:id', async (req, res) => {
  const location = getLocation(req.params.id);
  if (!location) return res.status(404).json({ error: 'Not found' });
  await removeLocation(req.params.id);
  res.json({ ok: true });
});

// POST /api/locations/:id/scan — trigger rescan + reindex
router.post('/:id/scan', async (req, res) => {
  const location = getLocation(req.params.id);
  if (!location) return res.status(404).json({ error: 'Not found' });

  // Respond immediately, scan in background
  res.json({ ok: true, message: 'Scan started' });

  buildIndex().catch(err => console.warn('Scan error:', err.message));
});

// POST /api/locations/test-smb — test SMB connection without saving
router.post('/test-smb', async (req, res) => {
  const { host, share, username, password, domain } = req.body;
  if (!host || !share) return res.status(400).json({ error: 'host and share required' });
  const result = await smbManager.testConnection({ host, share, username, password, domain });
  res.json(result);
});

module.exports = router;
