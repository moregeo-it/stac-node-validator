const BaseValidator = require('../../src/baseValidator');

class TestCustomValidator extends BaseValidator {
  async afterValidation(data, test) {
    test.truthy(data.id, 'id must be truthy');
  }
}

module.exports = TestCustomValidator;
