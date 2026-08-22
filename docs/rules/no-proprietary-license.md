# stac/no-proprietary-license

Applies to: Collections. Default severity: `warn`.

The `license` field should carry a concrete [SPDX license identifier](https://spdx.org/licenses/),
or `other` together with a `rel="license"` link. The placeholder values `proprietary` and `various`
are discouraged because they carry no actionable licensing information.

## Options

- `deny` (array of strings, default `["proprietary", "various"]`) — the license values to flag.
- `allow` (array of strings, default `[]`) — values to exempt even if listed in `deny`.

```javascript
'stac/no-proprietary-license': ['warn', { allow: ['various'] }]
```
