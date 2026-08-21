// A conservative set of best-practice rules, all as warnings so they never
// break an otherwise schema-valid document.
module.exports = {
  name: 'recommended',
  extends: [],
  rules: {
    'stac/id-url-safe': 'warn',
    'stac/no-proprietary-license': 'warn',
    'stac/datetime-utc': 'warn',
    'stac/link-title-matches-target': 'warn',
  },
  ruleDefinitions: [],
};
