'use strict';

// Live file watching for LOCAL locations. On any .md add/change/unlink we
// debounce and rebuild the search index, emitting events so the UI can refresh.
// SMB locations can't be watched cheaply — they still rely on manual / periodic
// scans (see the Scan button and POST /locations/:id/scan).
const chokidar = require('chokidar');
const { getLocations } = require('../config');
const { buildIndex } = require('./searchIndex');
const bus = require('./events');

let watcher = null;
let debounceTimer = null;
const pending = new Set();

function scheduleReindex(changedPath) {
  if (changedPath) pending.add(changedPath);
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(async () => {
    const changed = [...pending];
    pending.clear();
    bus.emit('changing', { changed });
    try {
      await buildIndex(); // emits 'reindexed' on completion
    } catch (err) {
      console.warn('Watch-triggered reindex failed:', err.message);
    }
  }, 1500);
}

// (Re)build watchers to match the current set of local locations. Call on boot
// and whenever locations are added/removed.
function syncWatchers() {
  const localPaths = getLocations()
    .filter((l) => l.type === 'local' && l.path)
    .map((l) => l.path);

  if (watcher) {
    watcher.close().catch(() => {});
    watcher = null;
  }
  if (!localPaths.length) return;

  try {
    watcher = chokidar.watch(localPaths, {
      ignoreInitial: true,
      // Skip dotfiles and noisy generated dirs
      ignored: (p) => /(^|[\\/])\.[^\\/]/.test(p) || /[\\/](node_modules|\.git)([\\/]|$)/.test(p),
      depth: 20,
      awaitWriteFinish: { stabilityThreshold: 400, pollInterval: 100 },
    });

    const onEvent = (p) => {
      if (/\.md$/i.test(p)) scheduleReindex(p);
    };

    watcher
      .on('add', onEvent)
      .on('change', onEvent)
      .on('unlink', onEvent)
      .on('error', (err) => console.warn('Watcher error:', err.message));

    console.log(`Watching ${localPaths.length} local location(s) for changes`);
  } catch (err) {
    console.warn('Failed to start file watcher:', err.message);
  }
}

module.exports = { syncWatchers, scheduleReindex };
