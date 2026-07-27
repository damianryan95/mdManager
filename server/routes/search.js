'use strict';

const express = require('express');
const { search, buildIndex } = require('../services/searchIndex');

const router = express.Router();

// GET /api/search?q=&locationId=
router.get('/', (req, res) => {
  const { q, locationId } = req.query;
  if (!q || q.trim().length < 2) return res.json([]);
  const results = search(q.trim(), locationId || null);
  res.json(results.slice(0, 50)); // cap at 50 results
});

// POST /api/search/reindex — rebuild the whole index
router.post('/reindex', async (req, res) => {
  res.json({ ok: true, message: 'Reindex started' });
  buildIndex().catch(err => console.warn('Reindex error:', err.message));
});

module.exports = router;
