const { RuleEngineValidator, resolveRuleConfig, isRuleConfigActive, parseSeverity } = require('../src/ruleEngine');
const { Resolver } = require('../src/resolver');
const DocumentIndex = require('../src/documentIndex');
const nodeLoader = require('../src/loader/node');
const catalog = require('./rules-fixtures/catalog.json');

function runEngine(ruleConfig) {
  const config = { loader: nodeLoader };
  config._documentIndex = new DocumentIndex();
  config._resolver = new Resolver(config, config._documentIndex);
  const engine = new RuleEngineValidator(resolveRuleConfig(ruleConfig));
  const report = { source: 'tests/rules-fixtures/catalog.json', version: '1.0.0', valid: true, results: { rules: [] } };
  return engine.afterValidation(catalog, null, report, config).then(() => report);
}

describe('Rule engine configuration', () => {
  describe('isRuleConfigActive', () => {
    it('is false without any rule config', () => {
      expect(isRuleConfigActive({})).toBe(false);
      expect(isRuleConfigActive({ extends: [], rules: {} })).toBe(false);
    });

    it('is true when extends, rules or plugins are set', () => {
      expect(isRuleConfigActive({ extends: ['recommended'] })).toBe(true);
      expect(isRuleConfigActive({ rules: { 'stac/id-url-safe': 'error' } })).toBe(true);
      expect(isRuleConfigActive({ plugins: { osc: { rules: {} } } })).toBe(true);
    });
  });

  describe('parseSeverity', () => {
    it('accepts strings, numbers and tuples', () => {
      expect(parseSeverity('warn', 'x')).toEqual({ severity: 'warn', options: {} });
      expect(parseSeverity(2, 'x')).toEqual({ severity: 'error', options: {} });
      expect(parseSeverity(['error', { allow: ['various'] }], 'x')).toEqual({
        severity: 'error',
        options: { allow: ['various'] },
      });
    });

    it('rejects invalid severities', () => {
      expect(() => parseSeverity('bogus', 'x')).toThrow(/Invalid severity/);
    });
  });

  describe('resolveRuleConfig', () => {
    it('applies a built-in preset', () => {
      const { severities } = resolveRuleConfig({ extends: ['recommended'] });
      expect(severities.get('stac/id-url-safe').severity).toBe('warn');
      expect(severities.get('stac/link-title-matches-target').severity).toBe('warn');
    });

    it('lets extended presets cascade and top-level rules win', () => {
      const { severities } = resolveRuleConfig({
        extends: ['recommended'],
        rules: { 'stac/id-url-safe': 'off', 'stac/no-proprietary-license': 'error' },
      });
      expect(severities.get('stac/id-url-safe').severity).toBe('off');
      expect(severities.get('stac/no-proprietary-license').severity).toBe('error');
    });

    it('resolves nested preset extends (best-practices extends recommended)', () => {
      const { severities } = resolveRuleConfig({ extends: ['stac-best-practices'] });
      // from recommended
      expect(severities.get('stac/link-title-matches-target').severity).toBe('warn');
      // overridden by best-practices
      expect(severities.get('stac/id-url-safe').severity).toBe('error');
      expect(severities.get('stac/require-self-link').severity).toBe('warn');
    });

    it('registers plugin rules and enables them', () => {
      const plugin = {
        rules: {
          'my-rule': {
            meta: { needsCrossFile: false },
            check() {},
          },
        },
      };
      const { registry, severities } = resolveRuleConfig({
        plugins: { acme: plugin },
        rules: { 'acme/my-rule': 'error' },
      });
      expect(registry.has('acme/my-rule')).toBe(true);
      expect(severities.get('acme/my-rule').severity).toBe('error');
    });

    it('throws for an unknown rule id', () => {
      expect(() => resolveRuleConfig({ rules: { 'stac/nope': 'error' } })).toThrow(/Unknown rule/);
    });

    it('throws for an invalid severity', () => {
      expect(() => resolveRuleConfig({ rules: { 'stac/id-url-safe': 'sometimes' } })).toThrow(/Invalid severity/);
    });
  });

  describe('RuleEngineValidator.afterValidation', () => {
    it('records cross-file findings without failing on warnings', async () => {
      const report = await runEngine({ extends: ['recommended'] });
      const findings = report.results.rules;
      expect(findings.some((f) => f.ruleId === 'stac/link-title-matches-target')).toBe(true);
      expect(findings.every((f) => f.severity === 'warn')).toBe(true);
      expect(report.valid).toBe(true);
    });

    it('marks the report invalid when an enabled rule is an error', async () => {
      const report = await runEngine({ rules: { 'stac/link-title-matches-target': 'error' } });
      const errors = report.results.rules.filter((f) => f.severity === 'error');
      expect(errors).toHaveLength(1);
      expect(report.valid).toBe(false);
    });

    it('does nothing when the rule is turned off', async () => {
      const report = await runEngine({ rules: { 'stac/link-title-matches-target': 'off' } });
      expect(report.results.rules).toHaveLength(0);
      expect(report.valid).toBe(true);
    });

    it('reports an exception from a rule applies() hook as a crash', async () => {
      const badRule = {
        id: 'test/throwing-applies',
        meta: { needsCrossFile: false },
        applies() {
          throw new Error('boom in applies');
        },
        check() {},
      };
      const resolved = resolveRuleConfig({
        plugins: { test: { rules: { 'throwing-applies': badRule } } },
        rules: { 'test/throwing-applies': 'error' },
      });
      const engine = new RuleEngineValidator(resolved);
      const report = { source: 'x.json', version: '1.0.0', valid: true, results: { rules: [] } };
      await engine.afterValidation({ type: 'Catalog', id: 'x' }, null, report, {});
      expect(report.results.rules).toHaveLength(1);
      expect(report.results.rules[0].severity).toBe('error');
      expect(report.results.rules[0].message).toContain('Rule crashed');
      expect(report.valid).toBe(false);
    });
  });
});
