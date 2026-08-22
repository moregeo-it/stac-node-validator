const BaseValidator = require('./baseValidator');

/**
 * Chains multiple {@link BaseValidator} instances so the core engine can treat
 * them as a single `config.customValidator`. Hooks are invoked in order.
 */
class CompositeValidator extends BaseValidator {
  /**
   * @param {Array.<BaseValidator>} validators
   */
  constructor(validators) {
    super();
    this.validators = (validators || []).filter(Boolean);
  }

  async createAjv(ajv) {
    for (const validator of this.validators) {
      ajv = await validator.createAjv(ajv);
    }
    return ajv;
  }

  async afterLoading(data, report, config) {
    for (const validator of this.validators) {
      data = await validator.afterLoading(data, report, config);
    }
    return data;
  }

  async bypassValidation(data, report, config) {
    for (const validator of this.validators) {
      const bypass = await validator.bypassValidation(data, report, config);
      if (bypass) {
        return bypass;
      }
    }
    return null;
  }

  async afterValidation(data, test, report, config) {
    for (const validator of this.validators) {
      await validator.afterValidation(data, test, report, config);
    }
  }
}

module.exports = CompositeValidator;
