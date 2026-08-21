module.exports = {
  id: 'stac/id-url-safe',
  meta: {
    description: 'The id should only use characters that are safe to use in URLs.',
    docsUrl: 'https://github.com/moregeo-it/stac-node-validator/blob/master/docs/rules/id-url-safe.md',
    category: 'naming',
    defaultSeverity: 'warn',
    needsCrossFile: false,
    stacTypes: null,
    versions: null,
  },
  applies(data) {
    return typeof data.id === 'string' && data.id.length > 0;
  },
  async check(data, context) {
    if (!/^[A-Za-z0-9_.~-]+$/.test(data.id)) {
      context.report({
        message: `id "${data.id}" contains characters that are not URL-safe; prefer A-Z, a-z, 0-9 and _ . ~ -`,
        instancePath: '/id',
      });
    }
  },
};
