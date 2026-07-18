'use strict';

const express = require('express');
const cors = require('cors');
const path = require('path');
const { initConfig } = require('./config');
const { buildIndex } = require('./services/searchIndex');

const app = express();

app.use(cors());
app.use(express.json());

// API routes
app.use('/api/locations', require('./routes/locations'));
app.use('/api/files', require('./routes/files'));
app.use('/api/search', require('./routes/search'));

// Health check
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Serve frontend
const clientDir = path.join(__dirname, '../client');
app.use(express.static(clientDir));
app.get('*', (_req, res) => res.sendFile(path.join(clientDir, 'index.html')));

const PORT = process.env.PORT || 3000;

async function start() {
  await initConfig();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`MDViewer running on http://0.0.0.0:${PORT}`);
  });
  // Build search index in background on startup
  buildIndex().catch(err => console.warn('Initial index build failed:', err.message));
}

start().catch(err => {
  console.error('Failed to start:', err);
  process.exit(1);
});
