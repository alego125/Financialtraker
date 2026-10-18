const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { createRequire } = require('node:module');

// Replace only unavailable external dependencies; local domain code runs unchanged.
function loadController(name, prisma, overrides = {}) {
  const cache = new Map();
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const mod = { exports: {} };
    cache.set(filename, mod);
    const nativeRequire = createRequire(filename);
    const requireDependency = id => {
      if (id === '../utils/prisma') return prisma;
      if (Object.hasOwn(overrides, id)) return overrides[id];
      if (id === 'express-validator') return { validationResult: () => ({ isEmpty: () => true }) };
      if (id.startsWith('.')) return load(path.resolve(path.dirname(filename), id + '.js'));
      return nativeRequire(id);
    };
    vm.runInNewContext(fs.readFileSync(filename, 'utf8'), { module: mod, require: requireDependency, console, process }, { filename });
    return mod.exports;
  }
  return load(path.resolve(__dirname, '../src/controllers', name + '.controller.js'));
}

function response() {
  return { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; }, end() { this.ended = true; return this; } };
}
const next = error => { throw error; };
module.exports = { loadController, response, next };
