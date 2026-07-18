'use strict';

const lunr = require('lunr');
const path = require('path');
const fs = require('fs').promises;
const { getLocations, updateLocation, DATA_DIR } = require('../config');
const { scanLocation, readFile } = require('./fileScanner');

const INDEX_FILE = path.join(DATA_DIR, 'search-index.json');

let _index = null;       // lunr index
let _docStore = {};      // id → { locationId, relativePath, name, excerpt }

/**
 * Extract a plain text excerpt from markdown (first 300 chars of content).
 */
function extractExcerpt(content, length = 300) {
  // Strip common markdown syntax for a cleaner excerpt
  return content
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_`~]/g, '')
    .replace(/\n+/g, ' ')
    .trim()
    .slice(0, length);
}

/**
 * Extract the title: first # heading, or filename.
 */
function extractTitle(content, filename) {
  const match = content.match(/^#{1,3}\s+(.+)$/m);
  return match ? match[1].trim() : filename.replace(/\.md$/i, '');
}

/**
 * Rebuild the full search index from all locations.
 */
async function buildIndex() {
  console.log('Building search index...');
  const locations = getLocations();
  const docs = [];

  for (const location of locations) {
    let files;
    try {
      files = await scanLocation(location);
    } catch (err) {
      console.warn(`Scan failed for location ${location.name}:`, err.message);
      continue;
    }

    for (const file of files) {
      let content;
      try {
        content = await readFile(location, file.relativePath);
      } catch {
        continue;
      }

      const id = `${file.locationId}::${file.relativePath}`;
      const title = extractTitle(content, file.name);
      const excerpt = extractExcerpt(content);

      docs.push({ id, title, body: content, locationId: file.locationId, relativePath: file.relativePath, name: file.name, excerpt });
    }

    await updateLocation(location.id, { lastScanned: new Date().toISOString(), fileCount: files.length });
  }

  _docStore = {};
  for (const doc of docs) {
    _docStore[doc.id] = {
      locationId: doc.locationId,
      relativePath: doc.relativePath,
      name: doc.name,
      title: doc.title,
      excerpt: doc.excerpt,
    };
  }

  _index = lunr(function () {
    this.ref('id');
    this.field('title', { boost: 10 });
    this.field('body');
    this.field('name', { boost: 5 });
    docs.forEach(doc => this.add(doc));
  });

  // Persist to disk
  try {
    await fs.writeFile(INDEX_FILE, JSON.stringify({ index: _index, docStore: _docStore }), 'utf-8');
  } catch (err) {
    console.warn('Could not save index:', err.message);
  }

  console.log(`Index built: ${docs.length} documents`);
  return docs.length;
}

/**
 * Load index from disk (called on startup if available).
 */
async function loadIndex() {
  try {
    const raw = await fs.readFile(INDEX_FILE, 'utf-8');
    const { index, docStore } = JSON.parse(raw);
    _index = lunr.Index.load(index);
    _docStore = docStore;
    console.log(`Search index loaded from disk (${Object.keys(_docStore).length} docs)`);
  } catch {
    // No cached index yet — will be built on first scan
  }
}

/**
 * Search the index. Returns array of result objects.
 */
function search(query) {
  if (!_index) return [];
  try {
    const hits = _index.search(query);
    return hits.map(hit => _docStore[hit.ref]).filter(Boolean);
  } catch {
    // lunr throws on parse errors for some queries
    return [];
  }
}

module.exports = { buildIndex, loadIndex, search };
