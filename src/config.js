const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const fs = require('fs-extra');
const path = require('path');

const { strArrayToObject } = require('./nodeUtils');

// Default values for the CLI options. Applied as the base of the config so that
// values from a config file and explicitly passed CLI options override them.
const defaults = {
  lint: false,
  format: false,
  schemas: null,
  schemaMap: {},
  custom: null,
  ignoreCerts: false,
  depth: -1,
  strict: false,
  verbose: false,
  config: null,
  maxWarnings: -1,
  resolveRemote: false,
  linkPrefix: null,
  localRoot: null,
};

function fromCLI() {
  // Note: The options intentionally don't declare defaults so that the parsed
  // object only contains the options that were explicitly passed. This lets the
  // CLI options override the config file options (see bin/cli.js).
  let config = yargs(hideBin(process.argv))
    .parserConfiguration({
      'camel-case-expansion': false,
      'boolean-negation': false,
      'strip-aliased': true,
    })
    .option('lint', {
      alias: 'l',
      type: 'boolean',
      description:
        'Check whether the JSON files are well-formatted, based on the JavaScript implementation with a 2-space indentation.',
    })
    .option('format', {
      alias: 'f',
      type: 'boolean',
      description: 'Writes the JSON files according to the linting rules.\nATTENTION: Overrides the source files!',
    })
    .option('schemas', {
      alias: 's',
      type: 'string',
      requiresArg: true,
      description: 'Validate against schemas in a local or remote STAC folder.',
    })
    .option('schemaMap', {
      type: 'array',
      requiresArg: true,
      description:
        'Validate against a specific local schema (e.g. an external extension). Provide the schema URI and the local path separated by an equal sign.\nExample: https://stac-extensions.github.io/foobar/v1.0.0/schema.json=./json-schema/schema.json\nThis can also be a partial URL and path so that all children are also mapped.\nExample: https://stac-extensions.github.io/foobar/=./json-schema/',
      coerce: strArrayToObject,
    })
    .option('custom', {
      type: 'string',
      description: 'Load a custom validation routine from a JavaScript file.',
    })
    .option('ruleset', {
      type: 'array',
      requiresArg: true,
      description:
        'Enable an opt-in best-practice ruleset by name (e.g. "recommended", "stac-best-practices") or a path/module.\nCan be given multiple times.',
    })
    .option('rules', {
      type: 'array',
      requiresArg: true,
      description:
        'Enable or configure individual rules. Provide the rule id and severity (off, warn or error) separated by an equal sign.\nExample: stac/id-url-safe=error',
      coerce: strArrayToObject,
    })
    .option('maxWarnings', {
      type: 'number',
      description: 'Number of rule warnings to allow before exiting with an error. -1 = unlimited.',
    })
    .option('resolveRemote', {
      type: 'boolean',
      description: 'Allow cross-file rules to fetch remote (HTTP) link targets. Disabled by default.',
    })
    .option('linkPrefix', {
      type: 'string',
      requiresArg: true,
      description: 'A public URL prefix that cross-file rules map to a local root (see --localRoot).',
    })
    .option('localRoot', {
      type: 'string',
      requiresArg: true,
      description: 'The local folder that --linkPrefix maps to. Defaults to the current working directory.',
    })
    .option('ignoreCerts', {
      type: 'boolean',
      description: 'Disable verification of SSL/TLS certificates.',
    })
    .option('depth', {
      type: 'integer',
      description:
        'The number of levels to recurse into when looking for files in folders. 0 = no subfolders, -1 = unlimited',
    })
    .option('strict', {
      type: 'boolean',
      description:
        'Enable strict mode in validation for schemas and numbers (as defined by ajv for options `strictSchema`, `strictNumbers` and `strictTuples`.',
    })
    .option('verbose', {
      alias: 'v',
      type: 'boolean',
      description: 'Run with verbose logging and a diff for linting.',
    })
    .option('config', {
      alias: 'c',
      type: 'string',
      description: 'Load the options from a config file (.js or .json). CLI options override config options.',
    })
    .version()
    .parse();

  delete config.$0;
  config.files = config._;
  delete config._;

  // Map the --ruleset flag onto the `extends` config key; drop empty defaults so
  // config-file values can take over and the rule engine stays off when unused.
  if (Array.isArray(config.ruleset) && config.ruleset.length > 0) {
    config.extends = config.ruleset;
  }
  delete config.ruleset;
  if (config.rules && Object.keys(config.rules).length === 0) {
    delete config.rules;
  }

  return config;
}

async function fromFile(filepath) {
  filepath = path.resolve(filepath);
  if (filepath.endsWith('.js')) {
    return require(filepath);
  } else {
    let configFile;
    try {
      configFile = await fs.readFile(filepath, 'utf8');
    } catch (error) {
      throw new Error('Config file does not exist.');
    }
    try {
      return JSON.parse(configFile);
    } catch (error) {
      throw new Error('Config file is invalid JSON.');
    }
  }
}

module.exports = {
  defaults,
  fromCLI,
  fromFile,
};
