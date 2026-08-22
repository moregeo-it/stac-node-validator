module.exports = {
  id: 'stac/no-proprietary-license',
  meta: {
    description:
      'Collections should provide a concrete license instead of the placeholder values "proprietary" or "various".',
    docsUrl: 'https://github.com/moregeo-it/stac-node-validator/blob/master/docs/rules/no-proprietary-license.md',
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
    const deny = new Set(context.options.deny || ['proprietary', 'various']);
    const allow = new Set(context.options.allow || []);
    const license = data.license;
    if (typeof license === 'string' && deny.has(license) && !allow.has(license)) {
      context.report({
        message: `Collection license "${license}" is discouraged; use a SPDX license identifier, or "other" with a rel="license" link.`,
        instancePath: '/license',
      });
    }
  },
};
