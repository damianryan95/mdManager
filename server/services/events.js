'use strict';

// Tiny in-process event bus used to push live updates (file changes, reindex
// completion) to connected SSE clients. See routes wired in server/index.js.
const { EventEmitter } = require('events');

const bus = new EventEmitter();
bus.setMaxListeners(100); // one listener pair per open SSE connection

module.exports = bus;
