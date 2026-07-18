'use strict';

const { execFile } = require('child_process');
const { promisify } = require('util');
const os = require('os');
const path = require('path');
const fs = require('fs').promises;

const execFileAsync = promisify(execFile);

function buildAuthArgs(location) {
  const { username = 'guest', password = '', domain = 'WORKGROUP' } = location;
  // Format: domain/user%password  or  user%password
  const userStr = domain ? `${domain}\\${username}%${password}` : `${username}%${password}`;
  return ['-U', userStr];
}

function shareUrl(location) {
  return `//${location.host}/${location.share}`;
}

/**
 * Run an smbclient command and return stdout.
 */
async function smbCommand(location, commands) {
  const args = [
    shareUrl(location),
    ...buildAuthArgs(location),
    '--no-pass',      // password is embedded in -U
    '-t', '10',       // timeout
    '-c', commands,
  ];

  // Remove --no-pass if password is provided (it conflicts)
  const finalArgs = location.password
    ? [shareUrl(location), ...buildAuthArgs(location), '-t', '10', '-c', commands]
    : [shareUrl(location), '-U', 'guest', '-N', '-t', '10', '-c', commands];

  try {
    const { stdout } = await execFileAsync('smbclient', finalArgs, { timeout: 15000 });
    return stdout;
  } catch (err) {
    throw new Error(`smbclient error: ${err.message}`);
  }
}

/**
 * Parse smbclient ls output into entries.
 * Lines look like:
 *   Documents                  D        0  Mon Jan  1 00:00:00 2024
 *   readme.md                  A     1234  Mon Jan  1 00:00:00 2024
 */
function parseListing(output) {
  const entries = [];
  const lines = output.split('\n');
  for (const line of lines) {
    // Match: name (padded), type flags, size, date
    const match = line.match(/^  (.+?)\s{2,}([DAHRSI]+)\s+(\d+)\s+/);
    if (!match) continue;
    const name = match[1].trim();
    const flags = match[2];
    if (name === '.' || name === '..') continue;
    entries.push({
      name,
      isDir: flags.includes('D'),
      size: parseInt(match[3], 10),
    });
  }
  return entries;
}

async function listDirectory(location, relDir = '') {
  const cmd = relDir ? `cd "${relDir.replace(/"/g, '\\"')}"; ls` : 'ls';
  const output = await smbCommand(location, cmd);
  return parseListing(output);
}

async function readFile(location, filePath) {
  const tmpFile = path.join(
    os.tmpdir(),
    `mdv_${Date.now()}_${Math.random().toString(36).slice(2)}.md`
  );
  try {
    // smbclient get downloads to local path
    const escapedRemote = filePath.replace(/"/g, '\\"').replace(/\//g, '\\');
    const escapedLocal = tmpFile.replace(/"/g, '\\"');
    await smbCommand(location, `get "${escapedRemote}" "${escapedLocal}"`);
    const content = await fs.readFile(tmpFile, 'utf-8');
    return content;
  } finally {
    await fs.unlink(tmpFile).catch(() => {});
  }
}

/**
 * Test connectivity to an SMB share. Returns true on success.
 */
async function testConnection(location) {
  try {
    await listDirectory(location, '');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

module.exports = { listDirectory, readFile, testConnection };
