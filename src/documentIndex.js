const { locationKey } = require('./utils');

/**
 * @typedef DocumentEntry
 * @type {Object}
 * @property {string} key Stable key from `locationKey(location)`.
 * @property {string} location Resolved absolute path or URL.
 * @property {string|null} source The original `report.source` (null for objects passed directly).
 * @property {Object} data The parsed STAC document.
 */

/**
 * An in-memory index of all documents parsed during a validation run.
 *
 * It lets cross-file rules reuse already-parsed input files instead of loading
 * them from disk/network again. It is built once per `validate()` call and shared
 * across the per-file loop.
 */
class DocumentIndex {
  constructor() {
    /** @type {Map<string, DocumentEntry>} */
    this.map = new Map();
  }

  /**
   * Registers a document. The first entry for a given key wins.
   *
   * @param {{ location: string, source: string|null, data: Object }} entry
   * @returns {DocumentEntry|null}
   */
  register({ location, source, data }) {
    if (typeof location !== 'string' || !location) {
      return null;
    }
    const key = locationKey(location);
    if (this.map.has(key)) {
      return this.map.get(key);
    }
    const entry = { key, location, source: source || null, data };
    this.map.set(key, entry);
    return entry;
  }

  has(key) {
    return this.map.has(key);
  }

  get(key) {
    return this.map.get(key) || null;
  }

  values() {
    return [...this.map.values()];
  }
}

module.exports = DocumentIndex;
