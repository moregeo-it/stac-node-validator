const path = require('path');
const { Resolver } = require('../src/resolver');
const DocumentIndex = require('../src/documentIndex');
const nodeLoader = require('../src/loader/node');

const ROOT = 'tests/rules-fixtures';

function makeResolver(extra = {}) {
  return new Resolver({ loader: nodeLoader, ...extra }, new DocumentIndex());
}

describe('Resolver', () => {
  describe('resolveLocation', () => {
    it('resolves relative hrefs against a local base', () => {
      const r = makeResolver();
      const { location, remote } = r.resolveLocation('./child/collection.json', 'tests/rules-fixtures/catalog.json');
      expect(remote).toBe(false);
      expect(location.endsWith('tests/rules-fixtures/child/collection.json')).toBe(true);
    });

    it('marks absolute HTTP hrefs as remote', () => {
      const r = makeResolver();
      expect(r.resolveLocation('https://example.com/x.json', null)).toEqual({
        location: 'https://example.com/x.json',
        remote: true,
      });
    });
  });

  describe('linkPrefix -> localRoot mapping', () => {
    const linkPrefix = 'https://example.com/data/';
    const localRoot = ROOT;

    it('maps a prefixed URL into the local root', () => {
      const r = makeResolver({ linkPrefix, localRoot });
      const res = r.resolveLocation(`${linkPrefix}child/collection.json`, null);
      expect(res.outsideRoot).toBeFalsy();
      expect(res.location.endsWith('tests/rules-fixtures/child/collection.json')).toBe(true);
    });

    it('flags a suffix that escapes the root via ..', () => {
      const r = makeResolver({ linkPrefix, localRoot });
      const res = r.resolveLocation(`${linkPrefix}../../src/index.js`, null);
      expect(res.outsideRoot).toBe(true);
    });

    it('confines an absolute-looking suffix to the root instead of escaping', () => {
      const r = makeResolver({ linkPrefix, localRoot });
      const res = r.resolveLocation(`${linkPrefix}/etc/passwd`, null);
      expect(res.outsideRoot).toBeFalsy();
      const expected = path.resolve(localRoot, 'etc/passwd');
      expect(res.location).toBe(expected.replace(/\\/g, '/'));
    });

    it('drops query/fragment from the mapped suffix', () => {
      const r = makeResolver({ linkPrefix, localRoot });
      const res = r.resolveLocation(`${linkPrefix}child/collection.json?foo=1#bar`, null);
      expect(res.location.endsWith('tests/rules-fixtures/child/collection.json')).toBe(true);
    });
  });

  describe('load', () => {
    it('does not load targets that escape the configured root', async () => {
      const r = makeResolver({ linkPrefix: 'https://example.com/data/', localRoot: ROOT });
      const result = await r.load('https://example.com/data/../../src/index.js', null);
      expect(result.found).toBe(false);
      expect(result.skipped).toBe('outside-root');
    });

    it('does not fetch remote targets unless resolveRemote is set', async () => {
      const r = makeResolver();
      const result = await r.load('https://example.com/remote.json', null);
      expect(result.found).toBe(false);
      expect(result.skipped).toBe('remote');
    });

    it('loads a local target and caches it', async () => {
      const r = makeResolver();
      const first = await r.load('./child/collection.json', 'tests/rules-fixtures/catalog.json');
      expect(first.found).toBe(true);
      expect(first.data.title).toBe('Actual Child Title');
      const second = await r.load('./child/collection.json', 'tests/rules-fixtures/catalog.json');
      expect(second).toBe(first); // served from cache
    });
  });
});
