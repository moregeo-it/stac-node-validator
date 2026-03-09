const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs-extra');

const CLI_PATH = path.resolve(__dirname, '../bin/cli.js');
const VALID_CATALOG = 'tests/examples/catalog.json';
const INVALID_CATALOG = 'tests/examples/invalid-catalog.json';
const MALFORMED_CATALOG = 'tests/fixtures/malformed-catalog.json';
const CUSTOM_VALIDATOR = 'tests/fixtures/customValidator.js';
const CONFIG_FILE = 'tests/example-config.json';

function runCLI(args = [], timeout = 15000) {
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      [CLI_PATH, ...args],
      { cwd: path.resolve(__dirname, '..'), timeout },
      (error, stdout, stderr) => {
        resolve({
          exitCode: error ? (error.code ?? 1) : 0,
          stdout,
          stderr,
        });
      },
    );
  });
}

describe('CLI Parameter Tests', () => {
  describe('Positional files argument', () => {
    it('Should validate a single file', async () => {
      const { exitCode, stdout } = await runCLI([VALID_CATALOG]);
      expect(exitCode).toBe(0);
      expect(stdout).toContain('Passed: 1');
    });

    it('Should validate multiple files', async () => {
      const { exitCode, stdout } = await runCLI([VALID_CATALOG, INVALID_CATALOG]);
      expect(exitCode).toBe(1);
      expect(stdout).toContain('Passed: 1');
      expect(stdout).toContain('Invalid: 1');
    });

    it('Should exit with error when no files are provided', async () => {
      const { exitCode, stderr } = await runCLI([]);
      expect(exitCode).toBe(1);
      expect(stderr).toContain('No path or URL specified');
    });

    it('Should report error for non-existent files', async () => {
      const { exitCode, stderr } = await runCLI(['non-existent-file.json']);
      expect(exitCode).toBe(1);
      expect(stderr).toContain("Can't be validated");
    });
  });

  describe('--version', () => {
    it('Should print the version number', async () => {
      const { exitCode, stdout } = await runCLI(['--version']);
      const { version } = require('../package.json');
      expect(exitCode).toBe(0);
      expect(stdout).toContain(version);
    });
  });

  describe('--verbose / -v', () => {
    it('Should show verbose output with --verbose', async () => {
      const { exitCode, stdout } = await runCLI([VALID_CATALOG, '--verbose']);
      expect(exitCode).toBe(0);
      expect(stdout).toContain('STAC Version:');
      expect(stdout).toContain('Config');
    });

    it('Should show verbose output with -v alias', async () => {
      const { exitCode, stdout } = await runCLI([VALID_CATALOG, '-v']);
      expect(exitCode).toBe(0);
      expect(stdout).toContain('STAC Version:');
    });
  });

  describe('--strict', () => {
    it('Should validate in strict mode', async () => {
      const { exitCode, stdout } = await runCLI([VALID_CATALOG, '--strict']);
      expect(exitCode).toBe(0);
      expect(stdout).toContain('Passed: 1');
    });
  });

  describe('--lint / -l', () => {
    it('Should detect malformed JSON with --lint on a single file', async () => {
      const { exitCode, stdout } = await runCLI([MALFORMED_CATALOG, '--lint']);
      expect(exitCode).toBe(1);
      expect(stdout).toContain('Malformed: 1');
    });

    it('Should pass lint for a well-formatted single file', async () => {
      const { exitCode, stdout } = await runCLI([VALID_CATALOG, '--lint']);
      expect(exitCode).toBe(0);
      expect(stdout).toContain('Malformed: 0');
    });

    it('Should detect malformed JSON across multiple files', async () => {
      const { exitCode, stdout } = await runCLI([MALFORMED_CATALOG, VALID_CATALOG, '--lint']);
      expect(exitCode).toBe(1);
      expect(stdout).toContain('Malformed: 1');
    });

    it('Should work with -l alias', async () => {
      const { exitCode, stdout } = await runCLI([MALFORMED_CATALOG, '-l']);
      expect(exitCode).toBe(1);
      expect(stdout).toContain('Malformed: 1');
    });

    it('Should show verbose lint details', async () => {
      const { stdout } = await runCLI([VALID_CATALOG, '--lint', '--verbose']);
      expect(stdout).toContain('File is well-formed');
    });

    it('Should show verbose malformed details', async () => {
      const { stdout } = await runCLI([MALFORMED_CATALOG, '--lint', '--verbose']);
      expect(stdout).toContain('File is malformed');
      expect(stdout).toContain('File Diff');
    });
  });

  describe('--format / -f', () => {
    let tempFile;

    beforeEach(async () => {
      tempFile = path.resolve(__dirname, 'fixtures', 'temp-format-test.json');
      await fs.copy(path.resolve(__dirname, 'fixtures', 'malformed-catalog.json'), tempFile);
    });

    afterEach(async () => {
      if (await fs.pathExists(tempFile)) {
        await fs.remove(tempFile);
      }
    });

    it('Should fix malformed JSON with --format on a single file', async () => {
      const relativeTempFile = path.relative(path.resolve(__dirname, '..'), tempFile);
      const { stdout } = await runCLI([relativeTempFile, '--format']);
      expect(stdout).toContain('Malformed: 1');

      // Verify the file was re-formatted
      const content = await fs.readFile(tempFile, 'utf8');
      const parsed = JSON.parse(content);
      const expected = JSON.stringify(parsed, null, 2);
      expect(content).toBe(expected);
    });

    it('Should fix malformed JSON with --format across multiple files', async () => {
      const relativeTempFile = path.relative(path.resolve(__dirname, '..'), tempFile);
      const { stdout } = await runCLI([relativeTempFile, VALID_CATALOG, '--format']);
      expect(stdout).toContain('Malformed: 1');

      const content = await fs.readFile(tempFile, 'utf8');
      const parsed = JSON.parse(content);
      const expected = JSON.stringify(parsed, null, 2);
      expect(content).toBe(expected);
    });

    it('Should work with -f alias', async () => {
      const relativeTempFile = path.relative(path.resolve(__dirname, '..'), tempFile);
      await runCLI([relativeTempFile, '-f']);

      const content = await fs.readFile(tempFile, 'utf8');
      const parsed = JSON.parse(content);
      const expected = JSON.stringify(parsed, null, 2);
      expect(content).toBe(expected);
    });
  });

  describe('--schemaMap', () => {
    it('Should validate with a mapped schema', async () => {
      const { exitCode, stdout } = await runCLI([
        'tests/examples/catalog-with-invalid-schema.json',
        '--schemaMap',
        'https://example.org/invalid-schema.json=tests/invalid-schema.json',
      ]);
      expect(exitCode).toBe(1);
      expect(stdout).toContain('Invalid: 1');
    });
  });

  describe('--schemas / -s', () => {
    it('Should reject a non-directory path', async () => {
      const { exitCode, stderr } = await runCLI([VALID_CATALOG, '--schemas', VALID_CATALOG]);
      expect(exitCode).toBe(1);
      expect(stderr).toContain('Schema folder is not a directory');
    });
  });

  describe('--custom', () => {
    it('Should load and run a custom validator', async () => {
      const { exitCode, stdout } = await runCLI([VALID_CATALOG, '--custom', CUSTOM_VALIDATOR]);
      expect(exitCode).toBe(0);
      expect(stdout).toContain('Passed: 1');
    });

    it('Should show custom validation results in verbose mode', async () => {
      const { exitCode, stdout } = await runCLI([VALID_CATALOG, '--custom', CUSTOM_VALIDATOR, '--verbose']);
      expect(exitCode).toBe(0);
      expect(stdout).toContain('Custom: passed');
    });
  });

  describe('--depth', () => {
    it('Should find files in a directory', async () => {
      const { stdout } = await runCLI(['tests/examples', '--depth', '0']);
      const match = stdout.match(/Summary \((\d+)\)/);
      expect(match).not.toBeNull();
      expect(Number(match[1])).toBeGreaterThan(0);
    });

    it('Should find the same files with depth -1 and 0 when no subfolders exist', async () => {
      const { stdout: depthZero } = await runCLI(['tests/examples', '--depth', '0']);
      const { stdout: depthUnlimited } = await runCLI(['tests/examples', '--depth', '-1']);
      const totalZero = depthZero.match(/Summary \((\d+)\)/);
      const totalUnlimited = depthUnlimited.match(/Summary \((\d+)\)/);
      expect(totalZero).not.toBeNull();
      expect(totalUnlimited).not.toBeNull();
      expect(totalZero[1]).toBe(totalUnlimited[1]);
    });
  });

  describe('--config / -c', () => {
    it('Should load options from a config file', async () => {
      const { exitCode, stdout } = await runCLI(['--config', CONFIG_FILE]);
      expect(exitCode).toBe(0);
      expect(stdout).toContain('Passed: 1');
      // The example config has verbose: true
      expect(stdout).toContain('Config');
    });

    it('Should work with -c alias', async () => {
      const { exitCode, stdout } = await runCLI(['-c', CONFIG_FILE]);
      expect(exitCode).toBe(0);
      expect(stdout).toContain('Passed: 1');
    });

    it('Should error for non-existent config file', async () => {
      const { exitCode, stderr } = await runCLI([VALID_CATALOG, '-c', 'nonexistent.json']);
      expect(exitCode).toBe(1);
      expect(stderr).toContain('Config file does not exist');
    });
  });

  describe('--ignoreCerts', () => {
    it('Should accept the ignoreCerts flag without error', async () => {
      const { exitCode, stdout } = await runCLI([VALID_CATALOG, '--ignoreCerts']);
      expect(exitCode).toBe(0);
      expect(stdout).toContain('Passed: 1');
    });
  });

  describe('Validation warning disclaimer', () => {
    it('Should print the validation warning on every run', async () => {
      const { stderr } = await runCLI([VALID_CATALOG]);
      expect(stderr).toContain('Schema-based STAC validation may be incomplete');
    });
  });

  describe('Exit codes', () => {
    it('Should exit 0 for valid files', async () => {
      const { exitCode } = await runCLI([VALID_CATALOG]);
      expect(exitCode).toBe(0);
    });

    it('Should exit 1 for invalid files', async () => {
      const { exitCode } = await runCLI([INVALID_CATALOG]);
      expect(exitCode).toBe(1);
    });

    it('Should exit 1 when lint detects malformed files', async () => {
      const { exitCode } = await runCLI([MALFORMED_CATALOG, '--lint']);
      expect(exitCode).toBe(1);
    });
  });
});
