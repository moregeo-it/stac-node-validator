// Built-in rules, registered in a deterministic order.
const RULES = [
  require('./id-url-safe'),
  require('./no-proprietary-license'),
  require('./require-self-link'),
  require('./datetime-utc'),
  require('./link-title-matches-target'),
];

/** @type {Map<string, Object>} */
const builtinRules = new Map(RULES.map((rule) => [rule.id, rule]));

// Built-in rulesets/presets.
const builtinRulesets = {
  recommended: require('../rulesets/recommended'),
  'stac-best-practices': require('../rulesets/best-practices'),
};

module.exports = { builtinRules, builtinRulesets };
