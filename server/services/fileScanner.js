'use strict';

const fs = require('fs').promises;
const path = require('path');
const smbManager = require('./smbManager');

/**
 * Recursively list all .md files in a location.
 * Returns array of { locationId, relativePath, name }
 */
async function scanLocation(location) {
  if (location.type === 'local') {
    return scanLocalDir(location, location.path, '');
  } else if (location.type === 'smb') {
    return scanSmbDir(location, '');
  }
  return [];
}

async function scanLocalDir(location, rootPath, relDir) {
  const results = [];
  const absDir = relDir ? path.join(rootPath, relDir) : rootPath;

  let entries;
  try {
    entries = await fs.readdir(absDir, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const entry of entries) {
    // Skip hidden dirs/files
    if (entry.name.startsWith('.')) continue;

    const relPath = relDir ? `${relDir}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      const sub = await scanLocalDir(location, rootPath, relPath);
      results.push(...sub);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
      results.push({
        locationId: location.id,
        relativePath: relPath,
        name: entry.name,
      });
    }
  }

  return results;
}

async function scanSmbDir(location, relDir) {
  const results = [];
  let entries;
  try {
    entries = await smbManager.listDirectory(location, relDir);
  } catch {
    return results;
  }

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const relPath = relDir ? `${relDir}/${entry.name}` : entry.name;

    if (entry.isDir) {
      const sub = await scanSmbDir(location, relPath);
      results.push(...sub);
    } else if (entry.name.toLowerCase().endsWith('.md')) {
      results.push({
        locationId: location.id,
        relativePath: relPath,
        name: entry.name,
      });
    }
  }

  return results;
}

/**
 * Read a file's content given a location and relative path.
 */
async function readFile(location, relativePath) {
  if (location.type === 'local') {
    const absPath = path.join(location.path, relativePath);
    // Security: ensure path stays within root
    const resolved = path.resolve(absPath);
    const root = path.resolve(location.path);
    if (!resolved.startsWith(root)) throw new Error('Path traversal denied');
    return fs.readFile(absPath, 'utf-8');
  } else if (location.type === 'smb') {
    return smbManager.readFile(location, relativePath);
  }
  throw new Error(`Unknown location type: ${location.type}`);
}

/**
 * List directory entries for the file tree.
 */
async function listDirectory(location, relativePath) {
  if (location.type === 'local') {
    const absPath = relativePath
      ? path.join(location.path, relativePath)
      : location.path;
    const resolved = path.resolve(absPath);
    const root = path.resolve(location.path);
    if (!resolved.startsWith(root)) throw new Error('Path traversal denied');

    const entries = await fs.readdir(absPath, { withFileTypes: true });
    return entries
      .filter(e => !e.name.startsWith('.'))
      .map(e => ({
        name: e.name,
        isDir: e.isDirectory(),
        isMd: e.isFile() && e.name.toLowerCase().endsWith('.md'),
        path: relativePath ? `${relativePath}/${e.name}` : e.name,
      }))
      .sort((a, b) => {
        // Dirs first, then files
        if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
  } else if (location.type === 'smb') {
    const entries = await smbManager.listDirectory(location, relativePath);
    return entries
      .filter(e => !e.name.startsWith('.'))
      .map(e => ({
        name: e.name,
        isDir: e.isDir,
        isMd: !e.isDir && e.name.toLowerCase().endsWith('.md'),
        path: relativePath ? `${relativePath}/${e.name}` : e.name,
      }))
      .sort((a, b) => {
        if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
  }
  throw new Error(`Unknown location type: ${location.type}`);
}

module.exports = { scanLocation, readFile, listDirectory };
