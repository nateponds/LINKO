# Conventional Commits

## Format

```
<type>(<scope>): <short description>
```

- **type** — required
- **scope** — optional, but use it
- **description** — lowercase, imperative tense, no period

## Types

| Type | Use for |
|------|---------|
| `feat` | New feature |
| `fix` | Bug fix |
| `refactor` | Code change that isn't a feature or fix |
| `style` | Formatting only, no logic change |
| `docs` | Documentation changes |
| `chore` | Tooling, dependencies, config |
| `revert` | Reverts a previous commit |

## Scopes

Use the feature or area the change belongs to.

`inventory` · `suppliers` · `matching` · `orders` · `logistics` · `dashboard` · `ui` · `nav` · `layout` · `api` · `config` · `docs`

## Examples

```
feat(inventory): add low-stock threshold filter
fix(nav): mobile sidebar not closing after navigation
refactor(ui): simplify Button disabled state logic
docs: add conventional commits guide
chore: upgrade vite to v8
```

## Breaking Changes

Append `!` after the type or scope:

```
feat(api)!: rename /vendor endpoint to /supplier
```

## Don'ts

```
# Too vague
update stuff
fix bug

# Wrong tense
Added filter dropdown
Fixed the sidebar

# Multiple unrelated things — split into separate commits
feat(inventory): add filter + fix(nav): close sidebar
```

---

Reference: [conventionalcommits.org](https://www.conventionalcommits.org/)
