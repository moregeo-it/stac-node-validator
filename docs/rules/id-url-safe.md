# stac/id-url-safe

Applies to: any STAC object with an `id`. Default severity: `warn`.

The `id` is often used in URLs (e.g. as a path segment in a static catalog or an API). This rule
flags ids that contain characters outside `A-Z`, `a-z`, `0-9` and `_ . ~ -`.

## Options

None.

## Examples

Fails: `"id": "my catalog"` (space), `"id": "a/b"` (slash).

Passes: `"id": "my-catalog"`, `"id": "sentinel_2.l2a"`.
