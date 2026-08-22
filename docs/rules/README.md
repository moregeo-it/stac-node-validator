# Best Practice Rules

These rules are run by the opt-in [rule engine](../../README.md#best-practice-rules). Each rule has
a severity (`off`, `warn`, `error`) that you set via `rules` / `--rules` or a ruleset (`extends` /
`--ruleset`).

| Rule | Cross-file |
| --- | --- |
| [stac/id-url-safe](./id-url-safe.md) | no |
| [stac/no-proprietary-license](./no-proprietary-license.md) | no |
| [stac/datetime-utc](./datetime-utc.md) | no |
| [stac/require-self-link](./require-self-link.md) | no |
| [stac/link-title-matches-target](./link-title-matches-target.md) | yes |
