# stac/require-self-link

Applies to: Catalogs, Collections, Items. Default severity: `warn` (only enabled in the
`stac-best-practices` ruleset).

Published documents should include an absolute `self` link so their canonical location is known,
even when the file is moved or copied. This rule flags a missing `self` link, or a `self` link whose
`href` is not an absolute HTTP(S) URL.

## Options

None.

> Note: purely static, relative-only catalogs intentionally omit `self` links, so keep this rule at
> `off` for those. It is not part of the `recommended` ruleset.
