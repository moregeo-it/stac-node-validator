const Ajv = require('ajv');
const addFormats = require('ajv-formats');
const iriFormats = require('./iri');
const { join } = require('path');

const SUPPORTED_PROTOCOLS = ['http:', 'https:'];

const SCHEMA_DRAFT_URLS = {
  'http://json-schema.org/draft-07/schema#': 'draft-07',
  'http://json-schema.org/draft-07/schema': 'draft-07',
  'https://json-schema.org/draft/2019-09/schema': '2019-09',
  'https://json-schema.org/draft/2020-12/schema': '2020-12',
};

function isObject(obj) {
  return typeof obj === 'object' && obj === Object(obj) && !Array.isArray(obj);
}

function isHttpUrl(url) {
  const parsed = URL.parse(url);
  if (parsed && SUPPORTED_PROTOCOLS.includes(parsed.protocol)) {
    return true;
  }
  return false;
}

function createAjv(config, AjvClass = null) {
  if (!AjvClass) {
    AjvClass = Ajv;
  }
  let instance = new AjvClass({
    formats: iriFormats,
    allErrors: config.verbose,
    strict: false,
    logger: config.verbose ? console : false,
    loadSchema: async (uri) => await loadSchemaFromUri(uri, config),
  });
  addFormats(instance);
  if (config.strict) {
    instance.opts.strictSchema = true;
    instance.opts.strictNumbers = true;
    instance.opts.strictTuples = true;
  }
  return instance;
}

function getAjvForSchema(config, schemaJson) {
  if (!schemaJson.$schema) {
    return config.ajv;
  }
  const draft = SCHEMA_DRAFT_URLS[schemaJson.$schema];
  if (!draft || draft === 'draft-07') {
    return config.ajv;
  }
  if (!isObject(config.schemaVersions) || !config.schemaVersions[draft]) {
    return null;
  }
  // Lazily create and cache Ajv instances for other drafts
  if (!config._ajvInstances) {
    config._ajvInstances = {};
  }
  if (!config._ajvInstances[draft]) {
    config._ajvInstances[draft] = createAjv(config, config.schemaVersions[draft]);
  }
  return config._ajvInstances[draft];
}

async function loadSchema(config, schemaId) {
  let schema = config.ajv.getSchema(schemaId);
  if (schema) {
    return schema;
  }

  let json;
  try {
    json = await loadSchemaFromUri(schemaId, config);
  } catch (error) {
    throw new Error(`Schema at '${schemaId}' not found. Please ensure all entries in 'stac_extensions' are valid.`);
  }

  // Determine the correct Ajv instance based on the schema's $schema draft
  const ajv = getAjvForSchema(config, json);
  if (!ajv) {
    const draft = SCHEMA_DRAFT_URLS[json.$schema] || json.$schema;
    throw new Error(
      `Schema at '${schemaId}' uses JSON Schema ${draft}, which is not supported. ` +
        'Pass the corresponding Ajv class via config.schemaVersions to enable support.',
    );
  }

  schema = ajv.getSchema(json.$id);
  if (schema) {
    return schema;
  }

  return await ajv.compileAsync(json);
}

async function loadSchemaFromUri(uri, config) {
  let newUri = uri;
  if (isObject(config.schemaMap)) {
    const patterns = Object.entries(config.schemaMap);
    const match = patterns.find((map) => uri.startsWith(map[0]));
    if (match) {
      const [pattern, target] = match;
      newUri = join(target, uri.substring(pattern.length));
    }
  }
  if (config.schemas) {
    newUri = newUri.replace(/^https:\/\/schemas\.stacspec\.org\/v[^/]+/, config.schemas);
  }
  const schema = await config.loader(newUri);
  if (!schema.$id) {
    schema.$id = uri;
  }
  return schema;
}

function normalizePath(p) {
  return p.replace(/\\/g, '/').replace(/\/$/, '');
}

/**
 * Computes a stable cache/index key for a resolved location (local path or URL).
 *
 * Local paths are lower-cased on Windows to absorb the case-insensitive file system;
 * URLs keep their path case but normalize scheme and host.
 *
 * @param {string} loc
 * @returns {string}
 */
function locationKey(loc) {
  if (typeof loc !== 'string') {
    return String(loc);
  }
  if (isHttpUrl(loc)) {
    const parsed = URL.parse(loc);
    if (parsed) {
      return `${parsed.protocol.toLowerCase()}//${(parsed.host || '').toLowerCase()}${parsed.pathname}${parsed.search || ''}`;
    }
    return loc;
  }
  const normalized = normalizePath(loc);
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
}

/**
 * Counts rule-engine findings by severity across a report and all its children.
 *
 * @param {import('./index').Report} report
 * @returns {{ warnings: number, ruleErrors: number }}
 */
function countRuleFindings(report) {
  let warnings = 0;
  let ruleErrors = 0;
  const walk = (r) => {
    if (!r) {
      return;
    }
    if (r.results && Array.isArray(r.results.rules)) {
      for (const finding of r.results.rules) {
        if (finding.severity === 'warn') {
          warnings++;
        } else if (finding.severity === 'error') {
          ruleErrors++;
        }
      }
    }
    if (Array.isArray(r.children)) {
      r.children.forEach(walk);
    }
  };
  walk(report);
  return { warnings, ruleErrors };
}

function getSummary(result, config) {
  let summary = {
    total: 0,
    valid: 0,
    invalid: 0,
    malformed: null,
    skipped: 0,
    warnings: 0,
    ruleErrors: 0,
  };
  const findings = countRuleFindings(result);
  summary.warnings = findings.warnings;
  summary.ruleErrors = findings.ruleErrors;
  if (result.children.length > 0) {
    // todo: speed this up by computing in one iteration
    summary.total = result.children.length;
    summary.valid = result.children.filter((c) => c.valid === true).length;
    summary.invalid = result.children.filter((c) => c.valid === false).length;
    if (config.lint || config.format) {
      summary.malformed = result.children.filter((c) => c.lint && !c.lint.valid).length;
    }
    summary.skipped = result.children.filter((c) => c.skipped).length;
  } else {
    summary.total = 1;
    summary.valid = result.valid === true ? 1 : 0;
    summary.invalid = result.valid === false ? 1 : 0;
    if (result.lint) {
      summary.malformed = result.lint.valid ? 0 : 1;
    }
    summary.skipped = result.skipped ? 1 : 0;
  }
  return summary;
}

function makeAjvErrorMessage(error) {
  let message = error.message;
  if (isObject(error.params) && Object.keys(error.params).length > 0) {
    let params = Object.entries(error.params)
      .map(([key, value]) => {
        let label = key.replace(/([^A-Z]+)([A-Z])/g, '$1 $2').toLowerCase();
        return `${label}: ${value}`;
      })
      .join(', ');
    message += ` (${params})`;
  }
  if (error.instancePath) {
    return `${error.instancePath} ${message}`;
  } else if (error.schemaPath) {
    return `${message}, for schema ${error.schemaPath}`;
  } else if (message) {
    return message;
  } else {
    return String(error);
  }
}

module.exports = {
  countRuleFindings,
  createAjv,
  getAjvForSchema,
  getSummary,
  isObject,
  isHttpUrl,
  loadSchema,
  loadSchemaFromUri,
  locationKey,
  makeAjvErrorMessage,
  normalizePath,
  SCHEMA_DRAFT_URLS,
  SUPPORTED_PROTOCOLS,
};
