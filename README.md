# stac-node-validator

Simple proof-of-concept to validate STAC Items, Catalogs, Collections and core extensions with node.

See the [STAC Validator Comparison](COMPARISON.md) for the features supported by this validator and the others out there.

## Versions

**Current version:** 2.0.0-rc.1

| STAC Node Validator Version | Supported STAC Versions |
| --------------------------- | ----------------------- |
| 1.1.0 / 1.2.x / 2.x.x       | >= 1.0.0-rc.1           |
| 0.4.x / 1.0.x               | >= 1.0.0-beta.2 and < 1.0.0-rc.3 |
| 0.3.0                       | 1.0.0-beta.2            |
| 0.2.1                       | 1.0.0-beta.1            |

## Quick Start

Two options:

1. Go to [check-stac.moregeo.it](https://check-stac.moregeo.it) for an online validator.
2. `npx stac-node-validator /path/to/your/file-or-folder` to temporarily install the library and validate the provided file for folder. See the chapters below for advanced usage options.

## Usage

### CLI

Install a recent version of [node](https://nodejs.org) (>= 22.1.0) and npm.

Then install the CLI on your computer:

```bash
npm install -g stac-node-validator
```

- Validate a single file: `stac-node-validator /path/to/your/file.json`
- Validate multiple files: `stac-node-validator /path/to/your/catalog.json /path/to/your/item.json`

Instead of paths to local files, you can also use HTTP(S) URLs. Other protocols such as S3 are not supported yet.

- Validate a single folder (considers all `json` files in the `examples` folder): `stac-node-validator ./stac-spec`
- Validate a single folder (considers all `json` files the given folder): `stac-node-validator ./stac-spec --all`

Further options to add to the commands above:

- To validate against schemas in a local STAC folder (e.g. `dev` branch): `--schemas /path/to/stac/folder`
- To validate against a specific local schema (e.g. an external extension): `--schemaMap https://stac-extensions.github.io/foobar/v1.0.0/schema.json=./json-schema/schema.json`
- To not verify SSL/TLS certificates: `--ignoreCerts`
- Add `--verbose` to get a more detailed output
- Add `--strict` to enable strict mode in validation for schemas and numbers (as defined by [ajv](https://ajv.js.org/strict-mode.html) for options `strictSchema`, `strictNumbers` and `strictTuples`)
- To lint local JSON files: `--lint` (add `--verbose` to get a diff with the changes required)
- To format / pretty-print local JSON files: `--format` (Attention: this will override the source files without warning!)
- To run custom validation code: `--custom ./path/to/validation.js` - The validation.js needs to contain a class that implements the `BaseValidator` interface. See [custom.example.js](./custom.example.js) for an example.

**Note on API support:** Validating lists of STAC items/collections (i.e. `GET /collections` and `GET /collections/:id/items`) is partially supported.
It only checks the contained items/collections, but not the other parts of the response (e.g. `links`).

You can also pass a config file via the `--config` option. Simply pass a file path as value.
Parameters set via CLI will not override the corresponding setting in the config file.

The config file uses the same option names as above.
To specify the files to be validated, add an array with paths.
The schema map is an object instead of string separated with a `=` character.

### Programmatic

You can also use the validator programmatically in your JavaScript/NodeJS applications.

Install it into an existing project:

```bash
npm install stac-node-validator
```

#### For browsers

Then in your code, you can for example do the following:

```javascript
const validate = require('stac-node-validator');

// Add any options, e.g. strict mode
const config = {
  strict: true
};

// Validate a STAC file from a URL
const result = await validate('https://example.com/catalog.json', config);

// Check if validation passed
if (result.valid) {
  console.log('STAC file is valid!');
} else {
  console.log('STAC file has errors:');
}
```

#### For NodeJS

```javascript
const validate = require('stac-node-validator');
const nodeLoader = require('stac-node-validator/src/loader/node');

// Add any options
const config = {
  loader: nodeLoader
};

// Validate a STAC file from a URL
const result = await validate('https://example.com/catalog.json', config);

// Check if validation passed
if (result.valid) {
  console.log('STAC file is valid!');
} else {
  console.log('STAC file has errors:');
}
```

#### Validation Results

The `validate` function returns a `Report` object with the following structure:

```javascript
{
  id: "catalog.json",	// File path or STAC ID
  type: "Catalog",		// STAC type (Catalog, Collection, Feature)
  version: "1.0.0",		// STAC version
  valid: true,			// Overall validation result
  skipped: false,		// Whether validation was skipped
  messages: [],			// Info/warning messages
  children: [],			// Child reports for collections/API responses
  results: {
    core: [],			// Core schema validation errors
    extensions: {},		// Extension validation errors (by schema URL)
    custom: []			// Custom validation errors
  },
  apiList: false		// Whether this is an API collection response
}
```

### Browser

The validator is also available as a browser bundle for client-side validation.

#### CDN Usage

```html
<!-- Include axios for HTTP requests -->
<script src="https://cdn.jsdelivr.net/npm/axios@1/dist/axios.min.js"></script>
<!-- Include the STAC validator bundle -->
<script src="https://cdn.jsdelivr.net/npm/stac-node-validator@2/dist/index.js"></script>

<script>
// The validator is available as a global 'validate' function
async function validateSTAC() {
  const stacData = {
    "stac_version": "1.0.0",
    "type": "Catalog",
    "id": "my-catalog",
    "description": "A sample catalog",
    "links": []
  };
  
  const result = await validate(stacData);
  
  if (result.valid) {
    console.log('STAC is valid!');
  } else {
    console.log('Validation errors:', result.results.core);
  }
}

validateSTAC();
</script>
```

## Development

1. `git clone https://github.com/moregeo-it/stac-node-validator` to clone the repo
2. `cd stac-node-validator` to switch into the new folder created by git
3. `npm install` to install dependencies
4. Run the commands as above, but replace `stac-node-validator` with `node bin/cli.js`, for example `node bin/cli.js /path/to/your/file.json`

### Tests

Simply run `npm test` in a working [development environment](#development).

### Browser Bundle

To work on the browser bundle build it: `npm run build`

Then you can import it from the `dist` folder.
