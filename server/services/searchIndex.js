'use strict';

const lunr = require('lunr');
const path = require('path');
const fs = require('fs').promises;
const { getLocations, updateLocation, DATA_DIR } = require('../config');
const { scanLocation, readFile } = require('./fileScanner');
const bus = require('./events');

const INDEX_FILE = path.join(DATA_DIR, 'search-index.json');
const SNIPPET_TEXT_CAP = 4000; // chars of plain text kept per doc for snippets

let _index = null;       // lunr index
let _docStore = {};       // id → { locationId, relativePath, name, title, excerpt, text }

/**
 * Strip common markdown syntax to plain-ish text (for excerpts + snippets).
 */
function stripMarkdown(content) {
  return content
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_`~]/g, '')
    .replace(/\n+/g, ' ')
    .trim();
}

/**
 * Extract the title: first # heading, or filename.
 */
function extractTitle(content, filename) {
  const match = content.match(/^#{1,3}\s+(.+)$/m);
  return match ? match[1].trim() : filename.replace(/\.md$/i, '');
}

/**
 * Split a raw query into plain lowercase tokens for snippet/highlight matching.
 */
function tokenize(query) {
  return (query || '')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length >= 2);
}

/**
 * Build a short snippet from plain text, centered on the first query-token match.
 * Returns plain text (the client escapes + highlights it).
 */
function makeSnippet(text, tokens, radius = 120) {
  if (!text) return '';
  const lower = text.toLowerCase();
  let idx = -1;
  for (const t of tokens) {
    const i = lower.indexOf(t);
    if (i !== -1 && (idx === -1 || i < idx)) idx = i;
  }
  if (idx === -1) return text.slice(0, 200).trim();
  const start = Math.max(0, idx - radius);
  const end = Math.min(text.length, idx + radius * 1.5);
  let snip = text.slice(start, end).trim();
  if (start > 0) snip = '… ' + snip;
  if (end < text.length) snip = snip + ' …';
  return snip;
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
      const stripped = stripMarkdown(content);

      docs.push({
        id,
        title,
        body: content,
        locationId: file.locationId,
        relativePath: file.relativePath,
        name: file.name,
        excerpt: stripped.slice(0, 300),
        text: stripped.slice(0, SNIPPET_TEXT_CAP),
      });
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
      text: doc.text,
    };
  }

  _index = lunr(function () {
    this.ref('id');
    this.field('title', { boost: 10 });
    this.field('body');
    this.field('name', { boost: 5 });
    docs.forEach((doc) => this.add(doc));
  });

  // Persist to disk
  try {
    await fs.writeFile(INDEX_FILE, JSON.stringify({ index: _index, docStore: _docStore }), 'utf-8');
  } catch (err) {
    console.warn('Could not save index:', err.message);
  }

  console.log(`Index built: ${docs.length} documents`);
  bus.emit('reindexed', { count: docs.length, at: Date.now() });
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
    _docStore = docStore || {};
    console.log(`Search index loaded from disk (${Object.keys(_docStore).length} docs)`);
    return true;
  } catch {
    // No cached index yet — will be built on first scan
    return false;
  }
}

/**
 * Search the index. Optionally filter to a single location.
 * Returns result objects with a match-centered snippet.
 */
function search(query, locationId = null) {
  if (!_index) return [];
  let hits;
  try {
    hits = _index.search(query);
  } catch {
    return []; // lunr throws on some query parse errors
  }

  const tokens = tokenize(query);
  const out = [];
  for (const hit of hits) {
    const entry = _docStore[hit.ref];
    if (!entry) continue;
    if (locationId && entry.locationId !== locationId) continue;
    out.push({
      locationId: entry.locationId,
      relativePath: entry.relativePath,
      name: entry.name,
      title: entry.title,
      excerpt: entry.excerpt,
      snippet: makeSnippet(entry.text || entry.excerpt || '', tokens),
    });
  }
  return out;
}

module.exports = { buildIndex, loadIndex, search };
