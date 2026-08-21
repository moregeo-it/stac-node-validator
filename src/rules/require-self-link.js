module.exports = {
  id: 'stac/require-self-link',
  meta: {
    description:
      'Published documents should include an absolute self link so their canonical location is discoverable.',
    docsUrl: 'https://github.com/moregeo-it/stac-node-validator/blob/master/docs/rules/require-self-link.md',
    category: 'links',
    defaultSeverity: 'warn',
    needsCrossFile: false,
    stacTypes: ['Catalog', 'Collection', 'Feature'],
    versions: null,
  },
  applies(data) {
    return ['Catalog', 'Collection', 'Feature'].includes(data.type);
  },
  async check(data, context) {
    const links = Array.isArray(data.links) ? data.links : [];
    const self = links.find((l) => l && l.rel === 'self');
    if (!self) {
      context.report({
        message: 'A self link is recommended so the absolute location of the document is known.',
        instancePath: '/links',
      });
    } else if (typeof self.href !== 'string' || !/^https?:\/\//i.test(self.href)) {
      context.report({
        message: 'The self link should be an absolute URL.',
        instancePath: '/links',
      });
    }
  },
};
