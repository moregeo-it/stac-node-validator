// Example of a custom ruleset module.
//
// Reference it from a config via `extends`, e.g.:
//   { extends: ['recommended', './examples/custom-ruleset.js'] }
// or on the CLI:
//   stac-node-validator ./catalog --ruleset recommended --ruleset ./examples/custom-ruleset.js
//
// A ruleset bundles its own rule definitions (in `ruleDefinitions`) and assigns default
// severities (in `rules`). It may also `extends` other rulesets.

/** A single-document rule: Collections should have a keywords array. */
const requireKeywords = {
  id: 'example/require-keywords',
  meta: {
    description: 'Collections should provide keywords to aid discovery.',
    category: 'metadata',
    defaultSeverity: 'warn',
    needsCrossFile: false,
    stacTypes: ['Collection'],
    versions: null,
  },
  applies(data) {
    return data.type === 'Collection';
  },
  async check(data, context) {
    if (!Array.isArray(data.keywords) || data.keywords.length === 0) {
      context.report({ message: 'Collection should have a non-empty "keywords" array.', instancePath: '/keywords' });
    }
  },
};

/** A cross-file rule: every child link should point to an existing document. */
const childLinksExist = {
  id: 'example/child-links-exist',
  meta: {
    description: 'Every child/item link should resolve to an existing document.',
    category: 'links',
    defaultSeverity: 'error',
    needsCrossFile: true,
    stacTypes: ['Catalog', 'Collection'],
    versions: null,
  },
  applies(data) {
    return Array.isArray(data.links) && data.links.length > 0;
  },
  async check(data, context) {
    const links = data.links;
    for (let i = 0; i < links.length; i++) {
      const link = links[i];
      if (!link || !['child', 'item'].includes(link.rel) || !link.href) {
        continue;
      }
      const target = await context.resolve(link);
      if (!target) {
        context.report({
          message: `The ${link.rel} link "${link.href}" does not resolve to an existing document.`,
          instancePath: `/links/${i}/href`,
        });
      }
    }
  },
};

module.exports = {
  name: 'example',
  extends: [],
  ruleDefinitions: [requireKeywords, childLinksExist],
  rules: {
    'example/require-keywords': 'warn',
    'example/child-links-exist': 'error',
  },
};
