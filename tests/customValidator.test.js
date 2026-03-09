const validate = require('../src/index');
const BaseValidator = require('../src/baseValidator');

const validCatalog = {
  stac_version: '1.0.0',
  id: 'test-catalog',
  type: 'Catalog',
  description: 'Test catalog',
  links: [],
};

const validItem = {
  stac_version: '1.0.0',
  stac_extensions: [],
  type: 'Feature',
  id: 'test-item',
  bbox: [0, 0, 1, 1],
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
        [0, 0],
      ],
    ],
  },
  properties: {
    datetime: '2020-01-01T00:00:00Z',
  },
  links: [],
  assets: {},
};

describe('Custom Validators', () => {
  describe('BaseValidator defaults', () => {
    it('Should validate without errors when using a no-op BaseValidator', async () => {
      const result = await validate(validCatalog, {
        customValidator: new BaseValidator(),
      });

      expect(result.valid).toBe(true);
      expect(result.results.custom).toEqual([]);
    });

    it('createAjv should return the ajv instance unchanged', async () => {
      const validator = new BaseValidator();
      const fakeAjv = { fake: true };
      const result = await validator.createAjv(fakeAjv);
      expect(result).toBe(fakeAjv);
    });

    it('afterLoading should return data unchanged', async () => {
      const validator = new BaseValidator();
      const data = { id: 'test' };
      const result = await validator.afterLoading(data, {}, {});
      expect(result).toBe(data);
    });

    it('bypassValidation should return null', async () => {
      const validator = new BaseValidator();
      const result = await validator.bypassValidation({}, {}, {});
      expect(result).toBeNull();
    });
  });

  describe('afterValidation with test assertions', () => {
    it('Should collect errors from failing test assertions', async () => {
      class FailingValidator extends BaseValidator {
        async afterValidation(data, test) {
          test.equal(data.id, 'wrong-id', 'ID should be wrong-id');
        }
      }

      const result = await validate(validCatalog, {
        customValidator: new FailingValidator(),
      });

      expect(result.valid).toBe(false);
      expect(result.results.custom).toHaveLength(1);
    });

    it('Should pass with no custom errors when assertions succeed', async () => {
      class PassingValidator extends BaseValidator {
        async afterValidation(data, test) {
          test.equal(data.id, 'test-catalog');
          test.truthy(data.links);
        }
      }

      const result = await validate(validCatalog, {
        customValidator: new PassingValidator(),
      });

      expect(result.valid).toBe(true);
      expect(result.results.custom).toEqual([]);
    });

    it('Should collect multiple failing assertions', async () => {
      class MultiFailValidator extends BaseValidator {
        async afterValidation(data, test) {
          test.equal(data.id, 'wrong');
          test.equal(data.type, 'Item');
          test.truthy(false, 'should be truthy');
        }
      }

      const result = await validate(validCatalog, {
        customValidator: new MultiFailValidator(),
      });

      expect(result.valid).toBe(false);
      expect(result.results.custom).toHaveLength(3);
    });

    it('Should catch thrown errors in afterValidation', async () => {
      class ThrowingValidator extends BaseValidator {
        async afterValidation() {
          throw new Error('Custom validation failed');
        }
      }

      const result = await validate(validCatalog, {
        customValidator: new ThrowingValidator(),
      });

      expect(result.valid).toBe(false);
      expect(result.results.custom).toHaveLength(1);
      expect(result.results.custom[0].message).toBe('Custom validation failed');
    });
  });

  describe('afterLoading hook', () => {
    it('Should transform data before validation', async () => {
      class TransformValidator extends BaseValidator {
        async afterLoading(data) {
          // Add missing links field to make it valid
          if (!data.links) {
            data.links = [];
          }
          return data;
        }
      }

      const catalogWithoutLinks = {
        stac_version: '1.0.0',
        id: 'test-catalog',
        type: 'Catalog',
        description: 'Test catalog',
        // missing links
      };

      const result = await validate(catalogWithoutLinks, {
        customValidator: new TransformValidator(),
      });

      expect(result.valid).toBe(true);
    });
  });

  describe('bypassValidation hook', () => {
    it('Should return the bypass report instead of validating', async () => {
      class BypassValidator extends BaseValidator {
        async bypassValidation(data, report) {
          report.valid = true;
          report.messages.push('Bypassed validation');
          return report;
        }
      }

      const result = await validate(validCatalog, {
        customValidator: new BypassValidator(),
      });

      expect(result.valid).toBe(true);
      expect(result.messages).toContain('Bypassed validation');
      // Core validation should not have run
      expect(result.results.core).toEqual([]);
    });
  });

  describe('createAjv hook', () => {
    it('Should allow customizing the ajv instance', async () => {
      let ajvCustomized = false;

      class AjvCustomizer extends BaseValidator {
        async createAjv(ajv) {
          ajvCustomized = true;
          ajv.addKeyword({
            keyword: 'x-custom',
            validate: () => true,
          });
          return ajv;
        }
      }

      const result = await validate(validCatalog, {
        customValidator: new AjvCustomizer(),
      });

      expect(ajvCustomized).toBe(true);
      expect(result.valid).toBe(true);
    });
  });

  describe('testFn method', () => {
    it('Should collect errors from the test callback', async () => {
      const validator = new BaseValidator();
      const report = { valid: true, results: { custom: [] } };

      await validator.testFn(report, async (report, test) => {
        test.equal(1, 2);
      });

      expect(report.valid).toBe(false);
      expect(report.results.custom).toHaveLength(1);
    });

    it('Should not set valid=false when all tests pass', async () => {
      const validator = new BaseValidator();
      const report = { valid: true, results: { custom: [] } };

      await validator.testFn(report, async (report, test) => {
        test.equal(1, 1);
      });

      expect(report.valid).toBe(true);
      expect(report.results.custom).toEqual([]);
    });

    it('Should catch thrown errors in the callback', async () => {
      const validator = new BaseValidator();
      const report = { valid: true, results: { custom: [] } };

      await validator.testFn(report, async () => {
        throw new Error('boom');
      });

      expect(report.valid).toBe(false);
      expect(report.results.custom).toHaveLength(1);
      expect(report.results.custom[0].message).toBe('boom');
    });

    it('Should append to existing custom errors', async () => {
      const validator = new BaseValidator();
      const existingError = new Error('previous');
      const report = { valid: false, results: { custom: [existingError] } };

      await validator.testFn(report, async (report, test) => {
        test.equal(1, 2);
      });

      expect(report.results.custom).toHaveLength(2);
      expect(report.results.custom[0]).toBe(existingError);
    });

    it('Should not override valid=false from previous failures', async () => {
      const validator = new BaseValidator();
      const report = { valid: false, results: { custom: [] } };

      await validator.testFn(report, async (report, test) => {
        test.equal(1, 1); // passing test
      });

      expect(report.valid).toBe(false);
    });
  });

  describe('Custom validator with Items', () => {
    it('Should run custom validation on Items', async () => {
      class ItemValidator extends BaseValidator {
        async afterValidation(data, test) {
          test.truthy(data.bbox, 'Item must have a bbox');
          test.truthy(data.geometry, 'Item must have geometry');
        }
      }

      const result = await validate(validItem, {
        customValidator: new ItemValidator(),
      });

      expect(result.valid).toBe(true);
      expect(result.results.custom).toEqual([]);
    });
  });

  describe('Custom validator with API lists', () => {
    it('Should run custom validation on each child in an ItemCollection', async () => {
      let validatedIds = [];

      class TrackingValidator extends BaseValidator {
        async afterValidation(data, test) {
          validatedIds.push(data.id);
        }
      }

      const itemCollection = {
        features: [
          { ...validItem, id: 'item-1' },
          { ...validItem, id: 'item-2' },
        ],
        links: [],
      };

      const result = await validate(itemCollection, {
        customValidator: new TrackingValidator(),
      });

      expect(result.apiList).toBe(true);
      expect(result.children).toHaveLength(2);
      expect(validatedIds).toContain('item-1');
      expect(validatedIds).toContain('item-2');
    });
  });

  describe('Combined core and custom failures', () => {
    it('Should report both core schema errors and custom errors', async () => {
      class AlwaysFailValidator extends BaseValidator {
        async afterValidation(data, test) {
          test.fail('Custom check always fails');
        }
      }

      // Invalid catalog (missing links) + custom validator that always fails
      const invalidCatalog = {
        stac_version: '1.0.0',
        id: 'test',
        type: 'Catalog',
        description: 'Missing links',
      };

      const result = await validate(invalidCatalog, {
        customValidator: new AlwaysFailValidator(),
      });

      expect(result.valid).toBe(false);
      expect(result.results.core.length).toBeGreaterThan(0);
      expect(result.results.custom.length).toBeGreaterThan(0);
    });
  });
});
