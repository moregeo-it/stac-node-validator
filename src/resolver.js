const path = require('path');

const { isHttpUrl, locationKey, normalizePath } = require('./utils');

/**
 * @typedef ResolvedTarget
 * @type {Object}
 * @property {string} location Resolved absolute path or URL.
 * @property {boolean} found Whether the target could be loaded.
 * @property {Object|null} data The parsed target document, if found.
 * @property {string|null} source Where the data came from (index entry source or location).
 * @property {boolean} remote Whether the target is a remote (HTTP) location.
 * @property {boolean} [fromIndex] Whether the data was reused from the document index.
 * @property {string} [skipped] Reason the target was not loaded (e.g. 'remote').
 * @property {Error} [error] The load error, if any.
 */

const hrefOf = (linkOrHref) => (typeof linkOrHref === 'string' ? linkOrHref : linkOrHref && linkOrHref.href);

/**
 * Resolves and loads documents referenced from other documents (e.g. via links),
 * caching every resolved location so each target is loaded at most once per run.
 */
class Resolver {
  /**
   * @param {import('./index').Config} config
   * @param {import('./documentIndex')} index
   */
  constructor(config, index) {
    this.config = config;
    this.index = index;
    /** @type {Map<string, ResolvedTarget>} */
    this.cache = new Map();
  }

  /**
   * Pure string resolution of an href against a base location. Never touches disk/network.
   *
   * @param {string} href
   * @param {string|null} base The document's own location (self href or source path).
   * @returns {{ location: string, remote: boolean }}
   */
  resolveLocation(href, base) {
    const { linkPrefix, localRoot } = this.config;

    // 1. Rewrite a known public URL prefix to a local root, if configured.
    if (linkPrefix && typeof href === 'string' && href.startsWith(linkPrefix)) {
      const root = localRoot || this.config._runRoot || '.';
      const rel = href.slice(linkPrefix.length);
      return { location: normalizePath(path.resolve(root, rel)), remote: false };
    }

    // 2. Absolute HTTP(S) URL.
    if (isHttpUrl(href)) {
      return { location: href, remote: true };
    }

    // 3. Resolve relative to the base.
    if (base && isHttpUrl(base)) {
      try {
        return { location: new URL(href, base).href, remote: true };
      } catch {
        return { location: href, remote: false };
      }
    }
    if (path.isAbsolute(href)) {
      return { location: normalizePath(path.resolve(href)), remote: false };
    }
    const dir = base ? path.dirname(base) : this.config._runRoot || process.cwd();
    return { location: normalizePath(path.resolve(dir, href)), remote: false };
  }

  /**
   * Resolves and loads a target, reusing the document index and caching results
   * (including negative results). Never throws.
   *
   * @param {string} href
   * @param {string|null} base
   * @returns {Promise<ResolvedTarget>}
   */
  async load(href, base) {
    if (!href) {
      return { location: '', found: false, data: null, source: null, remote: false };
    }
    const { location, remote } = this.resolveLocation(href, base);
    const key = locationKey(location);
    if (this.cache.has(key)) {
      return this.cache.get(key);
    }

    let result;
    if (this.index && this.index.has(key)) {
      const entry = this.index.get(key);
      result = { location, found: true, data: entry.data, source: entry.source, remote, fromIndex: true };
    } else if (remote && !this.config.resolveRemote) {
      result = { location, found: false, data: null, source: null, remote, skipped: 'remote' };
    } else {
      try {
        const data = await this.config.loader(location);
        result = { location, found: true, data, source: location, remote, fromIndex: false };
      } catch (error) {
        result = { location, found: false, data: null, source: null, remote, error };
      }
    }
    this.cache.set(key, result);
    return result;
  }
}

/**
 * Determines the base location against which relative links in `data` are resolved.
 * Prefers an absolute self link, falling back to the report source.
 *
 * @param {import('./index').Report} report
 * @param {Object} data
 * @returns {string|null}
 */
function deriveBase(report, data) {
  const links = Array.isArray(data.links) ? data.links : [];
  const self = links.find((l) => l && l.rel === 'self' && typeof l.href === 'string');
  if (self && isHttpUrl(self.href)) {
    return self.href;
  }
  if (report.source) {
    return report.source;
  }
  return self ? self.href : null;
}

/**
 * Builds the cross-file resolution helpers handed to rules via their context.
 *
 * @param {{ report: import('./index').Report, data: Object, resolver: Resolver }} args
 * @returns {Object}
 */
function createResolutionContext({ report, data, resolver }) {
  const base = deriveBase(report, data);
  return {
    base,
    source: report.source,

    /**
     * Returns the first link with the given relation type.
     * @param {string} rel
     * @returns {Object|null}
     */
    getLinkWithRel(rel) {
      const links = Array.isArray(data.links) ? data.links : [];
      return links.find((l) => l && l.rel === rel && l.href) || null;
    },

    /**
     * Resolves an href/link to an absolute location string (no I/O).
     * @param {string|Object} linkOrHref
     * @returns {string|null}
     */
    resolveLink(linkOrHref) {
      const href = hrefOf(linkOrHref);
      return href ? resolver.resolveLocation(href, base).location : null;
    },

    /**
     * Loads a referenced document. Returns `null` when it cannot be resolved
     * (missing, or a remote target while remote resolution is disabled).
     * @param {string|Object} linkOrHref
     * @returns {Promise<{ data: Object, source: string|null }|null>}
     */
    async resolve(linkOrHref) {
      const href = hrefOf(linkOrHref);
      if (!href) {
        return null;
      }
      const target = await resolver.load(href, base);
      return target.found ? { data: target.data, source: target.source } : null;
    },

    /**
     * Returns the title of a referenced document (properties.title for Items),
     * or `null` if the target cannot be resolved or has no title.
     * @param {string|Object} linkOrHref
     * @returns {Promise<string|null>}
     */
    async getTitle(linkOrHref) {
      const resolved = await this.resolve(linkOrHref);
      if (!resolved) {
        return null;
      }
      const doc = resolved.data;
      if (doc && doc.type === 'Feature') {
        return (doc.properties && doc.properties.title) || null;
      }
      return (doc && doc.title) || null;
    },
  };
}

module.exports = { Resolver, createResolutionContext, deriveBase };
