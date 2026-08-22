# stac/link-title-matches-target

Applies to: Catalogs, Collections, Items. Default severity: `warn`. **Cross-file.**

When a link carries a `title`, it should match the actual title of the document it references
(`properties.title` for Items, `title` otherwise). Mismatches usually mean a referenced document was
renamed without updating the links that point to it.

The rule resolves each link's `href` against the document's base (its absolute `self` link, or its
source path) and loads the target. Targets that cannot be resolved are ignored by default — remote
targets are only fetched when `resolveRemote` is enabled.

## Options

- `rels` (array of strings, default `["child", "item", "parent", "root", "related", "collection"]`) —
  which link relation types to check.
- `reportUnresolved` (boolean, default `false`) — also report links whose target could not be
  resolved.

## Example

Given a link `{ "rel": "child", "href": "./child/collection.json", "title": "Old Title" }` where
`child/collection.json` has `"title": "New Title"`, the rule reports:

> Link title "Old Title" does not match the referenced document's title "New Title".
