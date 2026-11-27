## Summary

<!-- Briefly describe what changed and why. Link the related issue if applicable. -->

## Verification

- [ ] `npm run check` passes (lint, unit tests, production build)
- [ ] `npm run test:backend` passes (if `backend/` or `api/` changed)
- [ ] New/updated tests cover changed behavior and edge cases

## Anti-Scope-Creep & Hygiene Checklist

- [ ] Changes stay strictly within the task's allowed write scope (no unrelated refactors or formatting churn)
- [ ] No new dependencies added without explicit approval
- [ ] No DDL or migration edits on non-DB feature branches; applied migrations (`001..031`) untouched and `backend/schema.sql` kept in sync if DB changed
- [ ] All protected backend routes enforce `requireAuth`, role middleware, and `X-Active-Business` ownership with zero implicit `platform_admin` bypass
- [ ] Frontend uses `src/lib/api.js` (`error.status`), `DESIGN.md` tokens/primitives, `lucide-react` icons only, and zero static inline `style={{}}`
- [ ] No scratch artifacts (`tmp/`, `output/`, `Claude outputs/`) or copied legacy `designs/` files committed
- [ ] `docs/API_CONTRACTS.md` updated if request/response shapes changed
