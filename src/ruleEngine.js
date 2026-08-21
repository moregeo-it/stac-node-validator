const path = require('path');

const BaseValidator = require('./baseValidator');
const { isObject } = require('./utils');
const { createResolutionContext } = require('./resolver');
const { builtinRules, builtinRulesets } = require('./rules');

const SEVERITIES = ['off', 'warn', 'error'];

/**
 * Whether any rule configuration is present. When false the engine is not attached
 * and behavior is identical to previous versions.
 *
 * @param {import('./index').Config} config
 * @returns {boolean}
 */
function isRuleConfigActive(config) {
  const hasExtends = Array.isArray(config.extends) ? config.extends.length > 0 : Boolean(config.extends);
  const hasRules = isObject(config.rules) && Object.keys(config.rules).length > 0;
  const hasPlugins = isObject(config.plugins) && Object.keys(config.plugins).length > 0;
  return hasExtends || hasRules || hasPlugins;
}

/**
 * Normalizes a rule config value into `{ severity, options }`.
 * Accepts 'off'|'warn'|'error', ESLint numeric levels (0|1|2), or `[severity, options]`.
 *
 * @param {string|number|Array} value
 * @param {string} id
 * @returns {{ severity: string, options: Object }}
 */
function parseSeverity(value, id) {
  let severity = value;
  let options = {};
  if (Array.isArray(value)) {
    severity = value[0];
    options = value[1] || {};
  }
  if (typeof severity === 'number') {
    severity = SEVERITIES[severity];
  }
  if (!SEVERITIES.includes(severity)) {
    throw new Error(`Invalid severity for rule '${id}': ${JSON.stringify(value)}. Use 'off', 'warn' or 'error'.`);
  }
  return { severity, options };
}

/**
 * Resolves the effective rule configuration (registry of available rule
 * definitions + the enabled rules with their severities) from a config object.
 *
 * @param {import('./index').Config} config
 * @returns {{ registry: Map<string, Object>, severities: Map<string, { severity: string, options: Object }> }}
 */
function resolveRuleConfig(config) {
  const registry = new Map(builtinRules);
  const severities = new Map();

  const applyRulesMap = (rulesMap) => {
    for (const [id, value] of Object.entries(rulesMap)) {
      severities.set(id, parseSeverity(value, id));
    }
  };

  const applyPreset = (preset) => {
    let ruleset;
    if (typeof preset === 'string') {
      if (builtinRulesets[preset]) {
        ruleset = builtinRulesets[preset];
      } else {
        ruleset = require(path.resolve(process.cwd(), preset));
      }
    } else if (isObject(preset)) {
      ruleset = preset;
    } else {
      return;
    }
    if (Array.isArray(ruleset.ruleDefinitions)) {
      for (const def of ruleset.ruleDefinitions) {
        if (def && def.id) {
          if (registry.has(def.id)) {
            console.warn(`Rule '${def.id}' is defined more than once; using the last definition.`);
          }
          registry.set(def.id, def);
        }
      }
    }
    if (Array.isArray(ruleset.extends)) {
      ruleset.extends.forEach(applyPreset);
    }
    if (isObject(ruleset.rules)) {
      applyRulesMap(ruleset.rules);
    }
  };

  // Register namespaced rules provided by plugins.
  if (isObject(config.plugins)) {
    for (const [ns, plugin] of Object.entries(config.plugins)) {
      if (plugin && isObject(plugin.rules)) {
        for (const [name, def] of Object.entries(plugin.rules)) {
          const id = def && def.id ? def.id : `${ns}/${name}`;
          registry.set(id, Object.assign({ id }, def));
        }
      }
    }
  }

  // Apply presets (extends), then top-level rules (highest priority).
  const presets = Array.isArray(config.extends) ? config.extends : config.extends ? [config.extends] : [];
  presets.forEach(applyPreset);
  if (isObject(config.rules)) {
    applyRulesMap(config.rules);
  }

  // Fail fast on unknown rule ids (typo protection).
  for (const id of severities.keys()) {
    if (!registry.has(id)) {
      throw new Error(`Unknown rule '${id}' in configuration. Check the spelling or load the plugin that defines it.`);
    }
  }

  return { registry, severities };
}

/**
 * Determines whether a rule applies to the given document.
 *
 * @param {Object} rule
 * @param {Object} data
 * @param {import('./index').Report} report
 * @returns {boolean}
 */
function ruleApplies(rule, data, report) {
  const meta = rule.meta || {};
  if (Array.isArray(meta.stacTypes) && meta.stacTypes.length > 0 && !meta.stacTypes.includes(data.type)) {
    return false;
  }
  if (typeof rule.applies === 'function') {
    try {
      return Boolean(rule.applies(data, { report }));
    } catch {
      return false;
    }
  }
  return true;
}

/**
 * Builds the context object handed to a rule's `check` function.
 */
function buildContext({ rule, severity, options, data, report, config, resolver }) {
  const resolution = createResolutionContext({ report, data, resolver });
  const push = (message, instancePath = '') => {
    report.results.rules.push({
      ruleId: rule.id,
      severity,
      message,
      instancePath,
      source: report.source || null,
    });
  };
  return Object.assign({}, resolution, {
    type: data.type,
    version: report.version,
    stac: data,
    options: options || {},
    severity,
    config,
    report({ message, instancePath = '' }) {
      push(message, instancePath);
    },
    assert(condition, message, opts = {}) {
      if (!condition) {
        push(message, opts.instancePath || '');
      }
    },
  });
}

/**
 * A {@link BaseValidator} that runs the opt-in rule engine during `afterValidation`.
 * Findings are written to `report.results.rules`; only `error`-severity findings
 * mark the document invalid.
 */
class RuleEngineValidator extends BaseValidator {
  /**
   * @param {{ registry: Map<string, Object>, severities: Map<string, { severity: string, options: Object }> }} resolved
   */
  constructor(resolved) {
    super();
    this.registry = resolved.registry;
    this.severities = resolved.severities;
  }

  async afterValidation(data, test, report, config) {
    if (!Array.isArray(report.results.rules)) {
      report.results.rules = [];
    }
    const resolver = config._resolver;
    const links = Array.isArray(data.links) ? data.links : [];
    const crossFileAvailable = Boolean(resolver) && (Boolean(report.source) || links.some((l) => l && l.rel === 'self'));

    for (const [id, { severity, options }] of this.severities) {
      if (severity === 'off') {
        continue;
      }
      const rule = this.registry.get(id);
      if (!rule) {
        continue;
      }
      if (rule.meta && rule.meta.needsCrossFile && !crossFileAvailable) {
        continue;
      }
      if (!ruleApplies(rule, data, report)) {
        continue;
      }
      const context = buildContext({ rule, severity, options, data, report, config, resolver });
      try {
        await rule.check(data, context);
      } catch (error) {
        report.results.rules.push({
          ruleId: id,
          severity: 'error',
          message: `Rule crashed: ${error.message}`,
          instancePath: '',
          source: report.source || null,
        });
      }
    }

    if (report.results.rules.some((finding) => finding.severity === 'error')) {
      report.valid = false;
    }
  }
}

module.exports = { RuleEngineValidator, resolveRuleConfig, isRuleConfigActive, parseSeverity };
