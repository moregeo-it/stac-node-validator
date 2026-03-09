const Test = require('../src/test');

describe('Test class', () => {
  let test;

  beforeEach(() => {
    test = new Test();
  });

  it('Should start with an empty errors array', () => {
    expect(test.errors).toEqual([]);
  });

  describe('truthy', () => {
    it('Should not add error for truthy value', () => {
      test.truthy(true);
      test.truthy(1);
      test.truthy('hello');
      expect(test.errors).toEqual([]);
    });

    it('Should add error for falsy value', () => {
      test.truthy(false);
      expect(test.errors).toHaveLength(1);
    });
  });

  describe('equal', () => {
    it('Should not add error for equal values', () => {
      test.equal(1, 1);
      test.equal('a', 'a');
      expect(test.errors).toEqual([]);
    });

    it('Should add error for unequal values', () => {
      test.equal(1, 2);
      expect(test.errors).toHaveLength(1);
    });

    it('Should use loose equality', () => {
      test.equal(1, '1');
      expect(test.errors).toEqual([]);
    });
  });

  describe('strictEqual', () => {
    it('Should not add error for strictly equal values', () => {
      test.strictEqual(1, 1);
      expect(test.errors).toEqual([]);
    });

    it('Should add error for loosely equal but not strict values', () => {
      test.strictEqual(1, '1');
      expect(test.errors).toHaveLength(1);
    });
  });

  describe('notEqual', () => {
    it('Should not add error for unequal values', () => {
      test.notEqual(1, 2);
      expect(test.errors).toEqual([]);
    });

    it('Should add error for equal values', () => {
      test.notEqual(1, 1);
      expect(test.errors).toHaveLength(1);
    });
  });

  describe('notStrictEqual', () => {
    it('Should not add error for strictly unequal values', () => {
      test.notStrictEqual(1, '1');
      expect(test.errors).toEqual([]);
    });

    it('Should add error for strictly equal values', () => {
      test.notStrictEqual(1, 1);
      expect(test.errors).toHaveLength(1);
    });
  });

  describe('deepEqual', () => {
    it('Should not add error for deeply equal objects', () => {
      test.deepEqual({ a: 1, b: [2, 3] }, { a: 1, b: [2, 3] });
      expect(test.errors).toEqual([]);
    });

    it('Should add error for deeply unequal objects', () => {
      test.deepEqual({ a: 1 }, { a: 2 });
      expect(test.errors).toHaveLength(1);
    });
  });

  describe('deepStrictEqual', () => {
    it('Should not add error for deeply strictly equal objects', () => {
      test.deepStrictEqual([1, 2, 3], [1, 2, 3]);
      expect(test.errors).toEqual([]);
    });

    it('Should add error for type differences', () => {
      test.deepStrictEqual({ a: 1 }, { a: '1' });
      expect(test.errors).toHaveLength(1);
    });
  });

  describe('notDeepEqual', () => {
    it('Should not add error for unequal objects', () => {
      test.notDeepEqual({ a: 1 }, { a: 2 });
      expect(test.errors).toEqual([]);
    });

    it('Should add error for equal objects', () => {
      test.notDeepEqual({ a: 1 }, { a: 1 });
      expect(test.errors).toHaveLength(1);
    });
  });

  describe('notDeepStrictEqual', () => {
    it('Should not add error for not deeply strictly equal', () => {
      test.notDeepStrictEqual({ a: 1 }, { a: '1' });
      expect(test.errors).toEqual([]);
    });

    it('Should add error for deeply strictly equal', () => {
      test.notDeepStrictEqual({ a: 1 }, { a: 1 });
      expect(test.errors).toHaveLength(1);
    });
  });

  describe('ok', () => {
    it('Should not add error for truthy value', () => {
      test.ok(true);
      test.ok(1);
      test.ok({});
      expect(test.errors).toEqual([]);
    });

    it('Should add error for falsy value', () => {
      test.ok(false);
      test.ok(0);
      expect(test.errors).toHaveLength(2);
    });
  });

  describe('fail', () => {
    it('Should always add an error', () => {
      test.fail('intentional failure');
      expect(test.errors).toHaveLength(1);
      expect(test.errors[0].message).toBe('intentional failure');
    });
  });

  describe('match', () => {
    it('Should not add error when string matches regex', () => {
      test.match('hello world', /hello/);
      expect(test.errors).toEqual([]);
    });

    it('Should add error when string does not match regex', () => {
      test.match('hello', /world/);
      expect(test.errors).toHaveLength(1);
    });
  });

  describe('doesNotMatch', () => {
    it('Should not add error when string does not match regex', () => {
      test.doesNotMatch('hello', /world/);
      expect(test.errors).toEqual([]);
    });

    it('Should add error when string matches regex', () => {
      test.doesNotMatch('hello world', /hello/);
      expect(test.errors).toHaveLength(1);
    });
  });

  describe('throws', () => {
    it('Should not add error when function throws', () => {
      test.throws(() => {
        throw new Error('boom');
      });
      expect(test.errors).toEqual([]);
    });

    it('Should add error when function does not throw', () => {
      test.throws(() => {});
      expect(test.errors).toHaveLength(1);
    });
  });

  describe('doesNotThrow', () => {
    it('Should not add error when function does not throw', () => {
      test.doesNotThrow(() => {});
      expect(test.errors).toEqual([]);
    });

    it('Should add error when function throws', () => {
      test.doesNotThrow(() => {
        throw new Error('boom');
      });
      expect(test.errors).toHaveLength(1);
    });
  });

  describe('rejects', () => {
    it('Should not add error when promise rejects', async () => {
      await test.rejects(async () => {
        throw new Error('rejected');
      });
      expect(test.errors).toEqual([]);
    });

    it('Should add error when promise resolves', async () => {
      await test.rejects(async () => {});
      expect(test.errors).toHaveLength(1);
    });
  });

  describe('doesNotReject', () => {
    it('Should not add error when promise resolves', async () => {
      await test.doesNotReject(async () => {});
      expect(test.errors).toEqual([]);
    });

    it('Should add error when promise rejects', async () => {
      await test.doesNotReject(async () => {
        throw new Error('rejected');
      });
      expect(test.errors).toHaveLength(1);
    });
  });

  describe('ifError', () => {
    it('Should not add error for null/undefined', () => {
      test.ifError(null);
      test.ifError(undefined);
      expect(test.errors).toEqual([]);
    });

    it('Should add error for truthy value', () => {
      test.ifError(new Error('something'));
      expect(test.errors).toHaveLength(1);
    });
  });

  describe('accumulates multiple errors', () => {
    it('Should collect all errors from multiple failed assertions', () => {
      test.equal(1, 2);
      test.ok(false);
      test.fail('nope');
      test.strictEqual('a', 'b');

      expect(test.errors).toHaveLength(4);
    });
  });
});
