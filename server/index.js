'use strict';

const express = require('express');
const cors = require('cors');
const compression = require('compression');
const path = require('path');
const { initConfig } = require('./config');
const { buildIndex, loadIndex } = require('./services/searchIndex');
const { syncWatchers } = require('./services/watcher');
const bus = require('./services/events');

const app = express();

app.use(compression());
app.use(cors());
app.use(express.json());

// API routes
app.use('/api/locations', require('./routes/locations'));
app.use('/api/files', require('./routes/files'));
app.use('/api/search', require('./routes/search'));

// Health check
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Server-Sent Events: live updates (file changes / reindex completion)
app.get('/api/events', (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // disable proxy buffering (nginx)
  });
  if (res.flushHeaders) res.flushHeaders();
  res.write('retry: 5000\n\n');

  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  send('hello', { ok: true });

  const onChanging = (d) => send('changing', d);
  const onReindexed = (d) => send('reindexed', d);
  bus.on('changing', onChanging);
  bus.on('reindexed', onReindexed);

  const keepalive = setInterval(() => res.write(': ping\n\n'), 25000);
  req.on('close', () => {
    clearInterval(keepalive);
    bus.off('changing', onChanging);
    bus.off('reindexed', onReindexed);
  });
});

// Serve frontend (the app shell must revalidate so updates are picked up)
const clientDir = path.join(__dirname, '../client');
app.use(express.static(clientDir, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
  },
}));
app.get('*', (_req, res) => {
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(path.join(clientDir, 'index.html'));
});

const PORT = process.env.PORT || 3000;

async function start() {
  await initConfig();

  // Serve search immediately from the persisted index, then refresh in the
  // background and start watching local locations for live updates.
  await loadIndex();

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`MDViewer running on http://0.0.0.0:${PORT}`);
  });

  syncWatchers();
  buildIndex().catch((err) => console.warn('Initial index build failed:', err.message));
}

start().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});
