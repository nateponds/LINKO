# Mapbox Setup for LINKO

This guide explains the Mapbox token path without assuming knowledge of Vite,
Docker, or GitHub Actions.

## The short version

LINKO does not need a Mapbox token to remain usable.

- With a token, Settings and branch management show an interactive map.
- Without a token, both pages show the permanent numeric latitude/longitude
  inputs instead.
- LINKO only accepts a Mapbox **public token** beginning with `pk.`.
- Never give the frontend a Mapbox secret token beginning with `sk.`.

No token is currently stored in this repository.

## Why a public token is stored as a GitHub Secret

The terminology is confusing because two different ideas use the word
"secret":

| Term | Meaning |
| --- | --- |
| Mapbox public token (`pk.*`) | A browser credential that users can ultimately inspect in the built JavaScript. It can display maps but must not have secret/write scopes. |
| GitHub Actions Secret | A private storage slot used to keep a value out of Git history and ordinary workflow logs before the frontend is built. |

The GitHub storage slot protects the token while it moves through the build
system. It does **not** make the final browser token confidential. Mapbox URL
restrictions are what limit where the public token may be used.

Vite explicitly documents that every `VITE_*` value is embedded into client
code at build time. Therefore, `VITE_MAPBOX_TOKEN` must only ever contain a
public `pk.*` token.

## How the value travels

```text
Mapbox public token (pk.*)
          |
          v
GitHub repository secret named VITE_MAPBOX_TOKEN
          |
          v
GitHub Actions starts the production deployment
          |
          v
Docker Compose passes the value as a frontend build argument
          |
          v
Docker runs `npm run build`
          |
          v
Vite replaces `import.meta.env.VITE_MAPBOX_TOKEN`
          |
          v
The browser receives the built JavaScript and loads Mapbox
```

This is build-time configuration. Changing the GitHub secret does nothing to
an already-built site; production must be rebuilt and redeployed.

## Where each part lives

| File | Responsibility |
| --- | --- |
| `.env.example` | Shows the optional local variable without containing a real token. |
| `src/components/ui/MapPicker.jsx` | Reads `import.meta.env.VITE_MAPBOX_TOKEN`; falls back to numeric inputs when absent or invalid. |
| `.github/workflows/deploy-production.yml` | Reads the GitHub repository secret during a production deployment. |
| `docker-compose.yml` | Passes the value into the production frontend image build. |
| `Dockerfile` | Makes the value available while Vite runs `npm run build`. |

The backend never receives or needs this token.

## Local setup

Use a separate development token so local testing and production usage can be
rotated or restricted independently.

1. Sign in to the Mapbox Developer Console and create a public token for LINKO
   development. It must begin with `pk.` and must not contain secret scopes.
2. Create `.env.local` in the repository root:

   ```dotenv
   VITE_MAPBOX_TOKEN=YOUR_PUBLIC_MAPBOX_TOKEN
   ```

   `.env.local` is ignored by Git. Never put the real value in `.env.example`.

3. Start or restart Vite:

   ```powershell
   npm.cmd run dev
   ```

4. Open Settings or Logistics Management. The map should appear above the
   numeric coordinate fields.

Mapbox notes that a URL-restricted token must explicitly allow `localhost` to
work locally. A separate development token with suitable local restrictions is
usually simpler than sharing the production token.

## Production setup

Production maps remain disabled until these manual account steps are completed.

### 1. Create the production Mapbox token

In the Mapbox Developer Console:

1. Open the Access Tokens page.
2. Create a new public token named for LINKO production.
3. Include only public scopes needed by the web map; never select secret/write
   scopes.
4. Add the allowed URL `https://linko.nateponds.com`.
5. Copy the resulting `pk.*` value.

Do not use the default public token if URL restrictions are required; Mapbox
does not allow restrictions on the default token.

### 2. Add the GitHub repository secret

In the LINKO repository on GitHub:

1. Open **Settings**.
2. Select **Secrets and variables** then **Actions**.
3. Open the **Secrets** tab.
4. Select **New repository secret**.
5. Enter the exact name `VITE_MAPBOX_TOKEN`.
6. Paste the production `pk.*` token as the value and save it.

The secret name must match exactly because the deployment workflow reads:

```yaml
VITE_MAPBOX_TOKEN: ${{ secrets.VITE_MAPBOX_TOKEN }}
```

### 3. Deploy normally

The production workflow runs when the completed work reaches `main`. Its Docker
build embeds the token into that deployment. No token should be pasted into a
tracked file.

## Safe fallback behavior

If the GitHub secret is missing or empty:

1. Docker still builds successfully.
2. Vite builds the frontend without a token.
3. `MapPicker` displays "Map unavailable (no Mapbox token configured)".
4. Users can still enter numeric latitude and longitude values.

This is intentional behavior, not a failed deployment.

## Troubleshooting

### The page says no token is configured

- Local: confirm `.env.local` exists in the repository root and restart Vite.
- Production: confirm the GitHub secret is named exactly
  `VITE_MAPBOX_TOKEN`, then rebuild/redeploy.

### The map loads locally but not in production

- Confirm the production token allows `https://linko.nateponds.com`.
- Check the browser network panel for Mapbox responses with status `401` or
  `403`.
- Confirm the token begins with `pk.`, not `sk.`.

### Production returns `403` from Mapbox

The token exists, but its URL restriction likely does not match the browser's
referrer. Check the exact production hostname and protocol in the Mapbox token
configuration.

### A token may have been misused

Create a replacement public token, update the GitHub secret, redeploy, and then
delete the old token in Mapbox. Because Vite embeds the value, updating the
GitHub secret without rebuilding does not replace the deployed token.

## Disable Mapbox again

1. Remove the `VITE_MAPBOX_TOKEN` repository secret.
2. Rebuild/redeploy the frontend.
3. Optionally delete or revoke the token in Mapbox.

The numeric-coordinate fallback will become active again.

## Pre-deployment checklist

- [ ] Token begins with `pk.`
- [ ] Token does not have secret/write scopes
- [ ] Production token is restricted to `https://linko.nateponds.com`
- [ ] Real token is absent from tracked files
- [ ] GitHub repository secret is named `VITE_MAPBOX_TOKEN`
- [ ] Frontend is rebuilt after adding or rotating the token
- [ ] Settings and branch management still work with the token absent

## Official references

- [Vite environment variables and build-time exposure](https://vite.dev/guide/env-and-mode)
- [GitHub: using secrets in Actions](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets)
- [Mapbox token management and URL restrictions](https://docs.mapbox.com/accounts/guides/tokens/)
