const DATETIME_FIELDS = ['datetime', 'start_datetime', 'end_datetime', 'created', 'updated', 'expires', 'published'];

module.exports = {
  id: 'stac/datetime-utc',
  meta: {
    description: 'Date and time values in Item properties should be expressed in UTC.',
    docsUrl: 'https://github.com/moregeo-it/stac-node-validator/blob/master/docs/rules/datetime-utc.md',
    category: 'metadata',
    defaultSeverity: 'warn',
    needsCrossFile: false,
    stacTypes: ['Feature'],
    versions: null,
  },
  applies(data) {
    return data.type === 'Feature' && data.properties && typeof data.properties === 'object';
  },
  async check(data, context) {
    const fields = context.options.fields || DATETIME_FIELDS;
    const properties = data.properties;
    for (const field of fields) {
      const value = properties[field];
      if (typeof value === 'string' && value.length > 0 && !/(Z|[+-]00:00)$/.test(value)) {
        context.report({
          message: `properties.${field} should use UTC (suffix "Z" or "+00:00").`,
          instancePath: `/properties/${field}`,
        });
      }
    }
  },
};
