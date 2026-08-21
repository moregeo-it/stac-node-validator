# stac/datetime-utc

Applies to: Items (Features). Default severity: `warn`.

STAC recommends expressing date/time values in UTC. This rule flags string values in Item
`properties` that do not end in `Z` or `+00:00`.

Checked fields (default): `datetime`, `start_datetime`, `end_datetime`, `created`, `updated`,
`expires`, `published`.

## Options

- `fields` (array of strings) — override the list of property names to check.

## Examples

Fails: `"datetime": "2020-01-01T00:00:00"`, `"datetime": "2020-01-01T00:00:00+02:00"`.

Passes: `"datetime": "2020-01-01T00:00:00Z"`, `"datetime": "2020-01-01T00:00:00+00:00"`.
