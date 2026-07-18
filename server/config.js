'use strict';

const fs = require('fs').promises;
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../data');
const CONFIG_FILE = path.join(DATA_DIR, 'locations.json');

let _config = { locations: [] };

async function initConfig() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    const raw = await fs.readFile(CONFIG_FILE, 'utf-8');
    _config = JSON.parse(raw);
  } catch {
    _config = { locations: [] };
    await saveConfig();
  }
}

async function saveConfig() {
  await fs.writeFile(CONFIG_FILE, JSON.stringify(_config, null, 2), 'utf-8');
}

function getLocations() {
  return _config.locations;
}

function getLocation(id) {
  return _config.locations.find(l => l.id === id) || null;
}

async function addLocation(location) {
  _config.locations.push(location);
  await saveConfig();
}

async function removeLocation(id) {
  _config.locations = _config.locations.filter(l => l.id !== id);
  await saveConfig();
}

async function updateLocation(id, updates) {
  const idx = _config.locations.findIndex(l => l.id === id);
  if (idx === -1) return false;
  _config.locations[idx] = { ..._config.locations[idx], ...updates };
  await saveConfig();
  return true;
}

module.exports = { initConfig, getLocations, getLocation, addLocation, removeLocation, updateLocation, DATA_DIR };
