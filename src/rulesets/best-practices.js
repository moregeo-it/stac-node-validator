// A broader, stricter preset that builds on `recommended`.
module.exports = {
  name: 'stac-best-practices',
  extends: ['recommended'],
  rules: {
    'stac/id-url-safe': 'error',
    'stac/require-self-link': 'warn',
  },
  ruleDefinitions: [],
};
