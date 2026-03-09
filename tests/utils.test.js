const {
  isObject,
  isHttpUrl,
  normalizePath,
  makeAjvErrorMessage,
  createAjv,
  getAjvForSchema,
  SCHEMA_DRAFT_URLS,
} = require('../src/utils');
const iri = require('../src/iri');

describe('Utility functions', () => {
  describe('isObject', () => {
    it('Should return true for plain objects', () => {
      expect(isObject({})).toBe(true);
      expect(isObject({ a: 1 })).toBe(true);
    });

    it('Should return false for arrays', () => {
      expect(isObject([])).toBe(false);
      expect(isObject([1, 2])).toBe(false);
    });

    it('Should return false for primitives', () => {
      expect(isObject(null)).toBe(false);
      expect(isObject(undefined)).toBe(false);
      expect(isObject(42)).toBe(false);
      expect(isObject('string')).toBe(false);
      expect(isObject(true)).toBe(false);
    });
  });

  describe('isHttpUrl', () => {
    it('Should return true for HTTP URLs', () => {
      expect(isHttpUrl('http://example.com')).toBe(true);
      expect(isHttpUrl('http://example.com/path')).toBe(true);
    });

    it('Should return true for HTTPS URLs', () => {
      expect(isHttpUrl('https://example.com')).toBe(true);
      expect(isHttpUrl('https://schemas.stacspec.org/v1.0.0/item.json')).toBe(true);
    });

    it('Should return false for non-HTTP URLs', () => {
      expect(isHttpUrl('ftp://example.com')).toBe(false);
      expect(isHttpUrl('file:///path/to/file')).toBe(false);
    });

    it('Should return false for file paths', () => {
      expect(isHttpUrl('./relative/path.json')).toBe(false);
      expect(isHttpUrl('/absolute/path.json')).toBe(false);
    });
  });

  describe('normalizePath', () => {
    it('Should replace backslashes with forward slashes', () => {
      expect(normalizePath('tests\\examples\\catalog.json')).toBe('tests/examples/catalog.json');
    });

    it('Should strip trailing slashes', () => {
      expect(normalizePath('path/to/dir/')).toBe('path/to/dir');
    });

    it('Should handle already normalized paths', () => {
      expect(normalizePath('path/to/file.json')).toBe('path/to/file.json');
    });
  });

  describe('makeAjvErrorMessage', () => {
    it('Should format error with instancePath', () => {
      const error = {
        instancePath: '/links',
        message: 'must be array',
        params: {},
      };
      expect(makeAjvErrorMessage(error)).toBe('/links must be array');
    });

    it('Should format error with params', () => {
      const error = {
        instancePath: '',
        message: 'must have required property',
        params: { missingProperty: 'links' },
        schemaPath: '#/required',
      };
      expect(makeAjvErrorMessage(error)).toBe(
        'must have required property (missing property: links), for schema #/required',
      );
    });

    it('Should format error with just a message', () => {
      const error = {
        message: 'Something went wrong',
        params: {},
      };
      expect(makeAjvErrorMessage(error)).toBe('Something went wrong');
    });

    it('Should format error with schemaPath when no instancePath', () => {
      const error = {
        message: 'invalid format',
        params: {},
        schemaPath: '#/properties/datetime/format',
      };
      expect(makeAjvErrorMessage(error)).toBe('invalid format, for schema #/properties/datetime/format');
    });

    it('Should stringify error object when message is undefined', () => {
      const error = { params: {} };
      expect(makeAjvErrorMessage(error)).toBe('[object Object]');
    });
  });
});

describe('IRI format validators', () => {
  describe('iri', () => {
    it('Should accept valid absolute IRIs', () => {
      expect(iri.iri('https://example.com')).toBe(true);
      expect(iri.iri('http://example.com/path')).toBe(true);
      expect(iri.iri('ftp://files.example.com/file.txt')).toBe(true);
    });

    it('Should accept file URIs', () => {
      expect(iri.iri('file:///path/to/file')).toBe(true);
    });

    it('Should reject relative references', () => {
      expect(iri.iri('./relative/path')).toBe(false);
      expect(iri.iri('../parent/path')).toBe(false);
      expect(iri.iri('relative/path')).toBe(false);
    });

    it('Should reject empty strings', () => {
      expect(iri.iri('')).toBe(false);
    });

    it('Should reject non-strings', () => {
      expect(iri.iri(42)).toBe(false);
      expect(iri.iri(null)).toBe(false);
    });
  });

  describe('iri-reference', () => {
    it('Should accept valid absolute IRIs', () => {
      expect(iri['iri-reference']('https://example.com')).toBe(true);
      expect(iri['iri-reference']('http://example.com/path')).toBe(true);
    });

    it('Should accept relative references', () => {
      expect(iri['iri-reference']('./relative/path')).toBe(true);
      expect(iri['iri-reference']('../parent/path')).toBe(true);
      expect(iri['iri-reference']('relative/path')).toBe(true);
    });

    it('Should reject empty strings', () => {
      expect(iri['iri-reference']('')).toBe(false);
    });

    it('Should reject non-strings', () => {
      expect(iri['iri-reference'](42)).toBe(false);
    });
  });
});

describe('JSON Schema draft detection', () => {
  describe('SCHEMA_DRAFT_URLS', () => {
    it('Should map draft-07 URLs', () => {
      expect(SCHEMA_DRAFT_URLS['http://json-schema.org/draft-07/schema#']).toBe('draft-07');
      expect(SCHEMA_DRAFT_URLS['http://json-schema.org/draft-07/schema']).toBe('draft-07');
    });

    it('Should map 2019-09 URL', () => {
      expect(SCHEMA_DRAFT_URLS['https://json-schema.org/draft/2019-09/schema']).toBe('2019-09');
    });

    it('Should map 2020-12 URL', () => {
      expect(SCHEMA_DRAFT_URLS['https://json-schema.org/draft/2020-12/schema']).toBe('2020-12');
    });
  });

  describe('getAjvForSchema', () => {
    const baseConfig = { ajv: { fake: true } };

    it('Should return default ajv for schemas without $schema', () => {
      const result = getAjvForSchema(baseConfig, { type: 'object' });
      expect(result).toBe(baseConfig.ajv);
    });

    it('Should return default ajv for draft-07 schemas', () => {
      const result = getAjvForSchema(baseConfig, { $schema: 'http://json-schema.org/draft-07/schema#' });
      expect(result).toBe(baseConfig.ajv);
    });

    it('Should return null for 2019-09 when schemaVersions not provided', () => {
      const result = getAjvForSchema(baseConfig, { $schema: 'https://json-schema.org/draft/2019-09/schema' });
      expect(result).toBeNull();
    });

    it('Should return null for 2020-12 when schemaVersions not provided', () => {
      const result = getAjvForSchema(baseConfig, { $schema: 'https://json-schema.org/draft/2020-12/schema' });
      expect(result).toBeNull();
    });

    it('Should create and cache ajv instance for 2019-09 when class provided', () => {
      const Ajv2019 = require('ajv/dist/2019');
      const config = { ...baseConfig, schemaVersions: { '2019-09': Ajv2019 } };
      const result = getAjvForSchema(config, { $schema: 'https://json-schema.org/draft/2019-09/schema' });
      expect(result).toBeDefined();
      expect(result).not.toBe(config.ajv);
      // Should cache the instance
      const result2 = getAjvForSchema(config, { $schema: 'https://json-schema.org/draft/2019-09/schema' });
      expect(result2).toBe(result);
    });

    it('Should create and cache ajv instance for 2020-12 when class provided', () => {
      const Ajv2020 = require('ajv/dist/2020');
      const config = { ...baseConfig, schemaVersions: { '2020-12': Ajv2020 } };
      const result = getAjvForSchema(config, { $schema: 'https://json-schema.org/draft/2020-12/schema' });
      expect(result).toBeDefined();
      expect(result).not.toBe(config.ajv);
    });

    it('Should return default ajv for unknown $schema values', () => {
      const result = getAjvForSchema(baseConfig, { $schema: 'http://some-unknown-schema.org/draft/foo' });
      expect(result).toBe(baseConfig.ajv);
    });
  });
});
