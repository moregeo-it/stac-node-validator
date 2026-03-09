const validate = require('../src/index');
const nodeLoader = require('../src/loader/node');
const fs = require('fs/promises');
const path = require('path');

const validCatalogPath = 'tests/examples/catalog.json';
const invalidCatalogPath = 'tests/examples/invalid-catalog.json';
const invalidSchemaPath = 'tests/invalid-schema.json';
const invalidSchemaCatalogPath = 'tests/examples/catalog-with-invalid-schema.json';
const apiItemsPath = 'tests/api/items.json';
const apiCollectionsPath = 'tests/api/collections.json';

describe('Validate Function Tests', () => {
  describe('Validate a valid catalog', () => {
    it('Should return valid=true for a valid catalog', async () => {
      const config = { loader: nodeLoader };
      const result = await validate(validCatalogPath, config);

      expect(result.valid).toBe(true);
      expect(result.type).toBe('Catalog');
      expect(result.version).toBe('1.0.0');
      expect(result.id).toBe('tests/examples/catalog.json');
      expect(result.results.core).toEqual([]);
      expect(Object.keys(result.results.extensions)).toEqual([]);
      expect(result.results.custom).toEqual([]);
    });
  });

  describe('Validate an invalid catalog', () => {
    it('Should return valid=false for an invalid catalog', async () => {
      const config = { loader: nodeLoader };
      const result = await validate(invalidCatalogPath, config);

      expect(result.valid).toBe(false);
      expect(result.type).toBe('Catalog');
      expect(result.version).toBe('1.0.0');
      expect(result.id).toBe('tests/examples/invalid-catalog.json');
      expect(result.results.core).toHaveLength(1);
      expect(result.results.core[0].keyword).toBe('required');
      expect(result.results.core[0].params.missingProperty).toBe('links');
    });
  });

  describe('Validate valid API Collections', () => {
    it('Should return valid=true for valid API collections', async () => {
      const config = { loader: nodeLoader };
      const result = await validate(apiCollectionsPath, config);

      expect(result.valid).toBe(true);
      expect(result.apiList).toBe(true);
      expect(result.children).toHaveLength(1);
      expect(result.children[0].valid).toBe(true);
      expect(result.children[0].type).toBe('Collection');
      expect(result.children[0].version).toBe('1.0.0');
      expect(result.children[0].id).toBe('simple-collection');
    });
  });

  describe('Validate partially invalid API Items (Item Collection)', () => {
    it('Should return valid=false for partially invalid API items', async () => {
      const config = { loader: nodeLoader };
      const result = await validate(apiItemsPath, config);

      expect(result.valid).toBe(false);
      expect(result.apiList).toBe(true);
      expect(result.children).toHaveLength(2);

      // First item should be valid
      expect(result.children[0].valid).toBe(true);
      expect(result.children[0].type).toBe('Feature');
      expect(result.children[0].version).toBe('1.0.0');
      expect(result.children[0].id).toBe('20201211_223832_CS2');

      // Second item should be invalid
      expect(result.children[1].valid).toBe(false);
      expect(result.children[1].type).toBe('Feature');
      expect(result.children[1].version).toBe('1.0.0');
      expect(result.children[1].id).toBe('invalid');
    });
  });

  describe('Validate with custom schema mapping', () => {
    it('Should return valid=false when using invalid schema', async () => {
      const config = {
        loader: nodeLoader,
        schemaMap: {
          'https://example.org/invalid-schema.json': invalidSchemaPath,
        },
      };

      const result = await validate(invalidSchemaCatalogPath, config);

      expect(result.valid).toBe(false);
      expect(result.type).toBe('Catalog');
      expect(result.version).toBe('1.0.0');
      expect(result.id).toBe('tests/examples/catalog-with-invalid-schema.json');
      expect(result.results.extensions['https://example.org/invalid-schema.json']).toBeDefined();
    });
  });

  describe('Validate with verbose messaging', () => {
    it('Should include verbose messages for API collections', async () => {
      const config = { loader: nodeLoader, verbose: true };
      const result = await validate(apiCollectionsPath, config);

      expect(result.valid).toBe(true);
      expect(result.messages).toContain(
        'The file is a CollectionCollection. Validating all 1 collections, but ignoring the other parts of the response.',
      );
    });

    it('Should include verbose messages for API items', async () => {
      const config = { loader: nodeLoader, verbose: true };
      const result = await validate(apiItemsPath, config);

      expect(result.valid).toBe(false);
      expect(result.messages).toContain(
        'The file is a ItemCollection. Validating all 2 items, but ignoring the other parts of the response.',
      );
    });
  });

  describe('Validate with JSON objects directly', () => {
    it('Should validate a STAC catalog object directly', async () => {
      const catalogData = {
        stac_version: '1.0.0',
        id: 'test-catalog',
        type: 'Catalog',
        title: 'Test Catalog',
        description: 'A test catalog for validation',
        links: [],
      };

      const result = await validate(catalogData);

      expect(result.valid).toBe(true);
      expect(result.type).toBe('Catalog');
      expect(result.version).toBe('1.0.0');
      expect(result.id).toBe('test-catalog');
    });

    it('Should validate an invalid STAC catalog object directly', async () => {
      const catalogData = {
        stac_version: '1.0.0',
        id: 'test-catalog',
        type: 'Catalog',
        title: 'Test Catalog',
        description: 'A test catalog for validation',
        // missing required 'links' field
      };

      const result = await validate(catalogData);

      expect(result.valid).toBe(false);
      expect(result.type).toBe('Catalog');
      expect(result.version).toBe('1.0.0');
      expect(result.id).toBe('test-catalog');
      expect(result.results.core).toHaveLength(1);
      expect(result.results.core[0].keyword).toBe('required');
      expect(result.results.core[0].params.missingProperty).toBe('links');
    });
  });

  describe('Version compatibility', () => {
    it('Should skip validation for unsupported STAC versions', async () => {
      const oldCatalogData = {
        stac_version: '0.9.0',
        id: 'old-catalog',
        type: 'Catalog',
        title: 'Old Catalog',
        description: 'An old catalog',
        links: [],
      };

      const result = await validate(oldCatalogData);

      expect(result.skipped).toBe(true);
      expect(result.messages).toContain('Can only validate STAC version >= 1.0.0-rc.1');
    });

    it('Should skip validation for missing STAC version', async () => {
      const noVersionCatalogData = {
        id: 'no-version-catalog',
        type: 'Catalog',
        title: 'No Version Catalog',
        description: 'A catalog without version',
        links: [],
      };

      const result = await validate(noVersionCatalogData);

      expect(result.skipped).toBe(true);
      expect(result.messages).toContain('No STAC version found');
    });
  });

  describe('Type validation', () => {
    it('Should return error for invalid type', async () => {
      const invalidTypeData = {
        stac_version: '1.0.0',
        id: 'invalid-type',
        type: 'InvalidType',
        title: 'Invalid Type',
        description: 'An object with invalid type',
      };

      const result = await validate(invalidTypeData);

      expect(result.valid).toBe(false);
      expect(result.results.core).toHaveLength(1);
      expect(result.results.core[0].instancePath).toBe('/type');
      expect(result.results.core[0].message).toContain("Can't detect type of the STAC object");
    });
  });

  describe('Strict mode validation', () => {
    it('Should validate with strict mode enabled', async () => {
      const config = { loader: nodeLoader, strict: true };
      const result = await validate(validCatalogPath, config);

      expect(result.valid).toBe(true);
      expect(result.type).toBe('Catalog');
      expect(result.version).toBe('1.0.0');
    });
  });

  describe('JSON Schema draft support via schemaVersions', () => {
    const catalogWith2019Extension = {
      stac_version: '1.0.0',
      id: 'test-catalog-2019',
      type: 'Catalog',
      description: 'Catalog with 2019-09 extension',
      links: [],
      stac_extensions: ['https://example.org/test-2019-09/schema.json'],
      properties: {
        'test:name': 'hello',
      },
    };

    it('Should error when extension uses 2019-09 and schemaVersions not provided', async () => {
      const config = {
        schemaMap: {
          'https://example.org/test-2019-09/schema.json': 'tests/schemas/extension-2019-09.json',
        },
        loader: nodeLoader,
      };
      const result = await validate(catalogWith2019Extension, config);

      expect(result.valid).toBe(false);
      const extErrors = result.results.extensions['https://example.org/test-2019-09/schema.json'];
      expect(extErrors).toBeDefined();
      expect(extErrors.length).toBeGreaterThan(0);
      expect(extErrors[0].message).toContain('2019-09');
    });

    it('Should validate successfully when schemaVersions includes 2019-09', async () => {
      const Ajv2019 = require('ajv/dist/2019');
      const config = {
        schemaMap: {
          'https://example.org/test-2019-09/schema.json': 'tests/schemas/extension-2019-09.json',
        },
        loader: nodeLoader,
        schemaVersions: {
          '2019-09': Ajv2019,
        },
      };
      const result = await validate(catalogWith2019Extension, config);

      expect(result.valid).toBe(true);
      expect(result.type).toBe('Catalog');
    });

    it('Should validate draft-07 schemas normally when schemaVersions is provided', async () => {
      const Ajv2019 = require('ajv/dist/2019');
      const Ajv2020 = require('ajv/dist/2020');
      const config = {
        loader: nodeLoader,
        schemaVersions: {
          '2019-09': Ajv2019,
          '2020-12': Ajv2020,
        },
      };
      const result = await validate(validCatalogPath, config);

      expect(result.valid).toBe(true);
      expect(result.type).toBe('Catalog');
    });

    it('Should validate extensions using draft-07, 2019-09 and 2020-12 at the same time', async () => {
      const Ajv2019 = require('ajv/dist/2019');
      const Ajv2020 = require('ajv/dist/2020');
      const catalogWithAllDrafts = {
        stac_version: '1.0.0',
        id: 'test-catalog-all-drafts',
        type: 'Catalog',
        description: 'Catalog with extensions across all three JSON Schema drafts',
        links: [],
        stac_extensions: [
          'https://example.org/test-2019-09/schema.json',
          'https://example.org/test-2020-12/schema.json',
        ],
        properties: {
          'test:name': 'hello',
          'test:label': 'world',
        },
      };
      const config = {
        schemaMap: {
          'https://example.org/test-2019-09/schema.json': 'tests/schemas/extension-2019-09.json',
          'https://example.org/test-2020-12/schema.json': 'tests/schemas/extension-2020-12.json',
        },
        loader: nodeLoader,
        schemaVersions: {
          '2019-09': Ajv2019,
          '2020-12': Ajv2020,
        },
      };
      const result = await validate(catalogWithAllDrafts, config);

      expect(result.valid).toBe(true);
      expect(result.type).toBe('Catalog');
      expect(result.results.extensions['https://example.org/test-2019-09/schema.json']).toEqual([]);
      expect(result.results.extensions['https://example.org/test-2020-12/schema.json']).toEqual([]);
    });
  });
});
