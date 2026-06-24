# Conventional Commits

## Format

```
<type>(<scope>): <short description>
```

- **type** — required
- **scope** — optional (area of change)
- **description** — lowercase, imperative tense, no period

## Types

| Type       | Use for                                 |
| ---------- | --------------------------------------- |
| `feat`     | New feature                             |
| `fix`      | Bug fix                                 |
| `refactor` | Code change that isn't a feature or fix |
| `style`    | Formatting only                         |
| `docs`     | Documentation changes                   |
| `chore`    | Tooling, dependencies, config           |

## Scopes

`inventory` · `suppliers` · `matching` · `orders` · `logistics` · `dashboard` · `ui` · `nav` · `layout` · `api` · `config` · `docs`

## Examples

```
feat(inventory): add low-stock threshold filter
fix(nav): mobile sidebar not closing after navigation
refactor(ui): simplify Button disabled state logic
docs: add conventional commits guide
chore: upgrade vite to v8
```
