const { Resolver, createResolutionContext } = require('../src/resolver');
const DocumentIndex = require('../src/documentIndex');
const nodeLoader = require('../src/loader/node');

const idUrlSafe = require('../src/rules/id-url-safe');
const noProprietaryLicense = require('../src/rules/no-proprietary-license');
const datetimeUtc = require('../src/rules/datetime-utc');
const requireSelfLink = require('../src/rules/require-self-link');
const linkTitle = require('../src/rules/link-title-matches-target');

const catalog = require('./rules-fixtures/catalog.json');
const catalogOk = require('./rules-fixtures/catalog-ok.json');

function makeContext(data, { source = null, version = '1.0.0', options = {} } = {}) {
  const report = { source, version, results: { rules: [] } };
  const resolver = new Resolver({ loader: nodeLoader }, new DocumentIndex());
  const resolution = createResolutionContext({ report, data, resolver });
  const findings = [];
  const context = Object.assign({}, resolution, {
    type: data.type,
    version,
    stac: data,
    options,
    report: ({ message, instancePath = '' }) => findings.push({ message, instancePath }),
    assert(condition, message, opts = {}) {
      if (!condition) {
        findings.push({ message, instancePath: opts.instancePath || '' });
      }
    },
  });
  return { context, findings };
}

describe('Built-in rules', () => {
  describe('stac/id-url-safe', () => {
    it('accepts a URL-safe id', async () => {
      const { context, findings } = makeContext({ type: 'Catalog', id: 'a-good_id.1' });
      await idUrlSafe.check({ type: 'Catalog', id: 'a-good_id.1' }, context);
      expect(findings).toHaveLength(0);
    });

    it('flags an id with unsafe characters', async () => {
      const data = { type: 'Catalog', id: 'not safe/id' };
      const { context, findings } = makeContext(data);
      await idUrlSafe.check(data, context);
      expect(findings).toHaveLength(1);
      expect(findings[0].instancePath).toBe('/id');
    });
  });

  describe('stac/no-proprietary-license', () => {
    it('flags a proprietary license', async () => {
      const data = { type: 'Collection', license: 'proprietary' };
      const { context, findings } = makeContext(data);
      await noProprietaryLicense.check(data, context);
      expect(findings).toHaveLength(1);
      expect(findings[0].instancePath).toBe('/license');
    });

    it('accepts a concrete license', async () => {
      const data = { type: 'Collection', license: 'CC-BY-4.0' };
      const { context, findings } = makeContext(data);
      await noProprietaryLicense.check(data, context);
      expect(findings).toHaveLength(0);
    });

    it('honors the allow option', async () => {
      const data = { type: 'Collection', license: 'various' };
      const { context, findings } = makeContext(data, { options: { allow: ['various'] } });
      await noProprietaryLicense.check(data, context);
      expect(findings).toHaveLength(0);
    });
  });

  describe('stac/datetime-utc', () => {
    it('flags a non-UTC datetime', async () => {
      const data = { type: 'Feature', properties: { datetime: '2020-01-01T00:00:00' } };
      const { context, findings } = makeContext(data);
      await datetimeUtc.check(data, context);
      expect(findings).toHaveLength(1);
      expect(findings[0].instancePath).toBe('/properties/datetime');
    });

    it('accepts a UTC datetime', async () => {
      const data = { type: 'Feature', properties: { datetime: '2020-01-01T00:00:00Z' } };
      const { context, findings } = makeContext(data);
      await datetimeUtc.check(data, context);
      expect(findings).toHaveLength(0);
    });
  });

  describe('stac/require-self-link', () => {
    it('flags a missing self link', async () => {
      const data = { type: 'Catalog', links: [] };
      const { context, findings } = makeContext(data);
      await requireSelfLink.check(data, context);
      expect(findings).toHaveLength(1);
    });

    it('flags a relative self link', async () => {
      const data = { type: 'Catalog', links: [{ rel: 'self', href: './catalog.json' }] };
      const { context, findings } = makeContext(data);
      await requireSelfLink.check(data, context);
      expect(findings).toHaveLength(1);
    });

    it('accepts an absolute self link', async () => {
      const data = { type: 'Catalog', links: [{ rel: 'self', href: 'https://example.com/catalog.json' }] };
      const { context, findings } = makeContext(data);
      await requireSelfLink.check(data, context);
      expect(findings).toHaveLength(0);
    });
  });

  describe('stac/link-title-matches-target (cross-file)', () => {
    it('flags a link whose title differs from the target document title', async () => {
      const { context, findings } = makeContext(catalog, { source: 'tests/rules-fixtures/catalog.json' });
      await linkTitle.check(catalog, context);
      expect(findings).toHaveLength(1);
      expect(findings[0].instancePath).toBe('/links/1/title');
      expect(findings[0].message).toContain('Actual Child Title');
    });

    it('does not flag when link titles match their targets', async () => {
      const { context, findings } = makeContext(catalogOk, { source: 'tests/rules-fixtures/catalog-ok.json' });
      await linkTitle.check(catalogOk, context);
      expect(findings).toHaveLength(0);
    });
  });
});
