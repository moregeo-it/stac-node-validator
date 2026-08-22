const DEFAULT_RELS = ['child', 'item', 'parent', 'root', 'related', 'collection'];

module.exports = {
  id: 'stac/link-title-matches-target',
  meta: {
    description: "A link's title should match the title of the document it references.",
    docsUrl: 'https://github.com/moregeo-it/stac-node-validator/blob/master/docs/rules/link-title-matches-target.md',
    category: 'links',
    defaultSeverity: 'warn',
    needsCrossFile: true,
    stacTypes: ['Catalog', 'Collection', 'Feature'],
    versions: null,
  },
  applies(data) {
    return Array.isArray(data.links) && data.links.length > 0;
  },
  async check(data, context) {
    const rels = new Set(context.options.rels || DEFAULT_RELS);
    const reportUnresolved = context.options.reportUnresolved === true;
    const links = data.links;
    for (let i = 0; i < links.length; i++) {
      const link = links[i];
      if (!link || !rels.has(link.rel) || typeof link.title !== 'string' || !link.href) {
        continue;
      }
      const target = await context.resolve(link);
      if (!target) {
        if (reportUnresolved) {
          context.report({
            message: `Link target "${link.href}" could not be resolved to check its title.`,
            instancePath: `/links/${i}/href`,
          });
        }
        continue;
      }
      const doc = target.data;
      const targetTitle = doc && doc.type === 'Feature' ? doc.properties && doc.properties.title : doc && doc.title;
      if (typeof targetTitle === 'string' && targetTitle !== link.title) {
        context.report({
          message: `Link title "${link.title}" does not match the referenced document's title "${targetTitle}".`,
          instancePath: `/links/${i}/title`,
        });
      }
    }
  },
};
