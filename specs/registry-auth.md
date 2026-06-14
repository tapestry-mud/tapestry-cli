# registry-auth

Capability spec for user identity, session management, and OIDC trusted publishing.

## Overview

registry-auth covers everything the CLI does on behalf of a user's identity: password-based
login that exchanges credentials for an access/refresh token pair; silent proactive token
refresh before expiry; logout with best-effort server-side revocation; account registration
and password change; and the OIDC trusted-publishing path that lets a GitHub Actions workflow
publish a pack without stored credentials.

Trust binding management (`tapestry trust add/list/rm`) is in this boundary because it
configures the OIDC flow on the registry side.

## Behavior

### Session storage

- The session file lives at `~/.tapestryrc` (resolved via `os.homedir()`).
  (src/lib/auth.js:9)
- Written with mode `0o600` (user-read/write only). (src/lib/auth.js:28)
- Contains four YAML keys: `registry` (the registry URL), `access` (the access JWT),
  `access_exp` (the JWT `exp` claim decoded as a Unix timestamp), and `refresh` (the refresh
  token string). (src/lib/auth.js:24-29)
- `decodeExp` extracts `exp` from the JWT payload by base64url-decoding the second segment.
  Returns null on any parse error. (src/lib/auth.js:38-45)
- `readSession` returns null if the file is absent or unparseable.
  (src/lib/auth.js:13-20)
- `clearSession` deletes the file if it exists; does nothing otherwise.
  (src/lib/auth.js:32-36)

### Token refresh

- `loadAccess` returns the stored access token if `access_exp` is present and the token will
  not expire within the next 60 seconds (`REFRESH_SKEW_SECONDS`). (src/lib/auth.js:52-54)
- If the access token is expired or near expiry, `loadAccess` silently POSTs the refresh
  token to `<registry>/v1/auth/refresh` and saves the new access and refresh tokens.
  (src/lib/auth.js:58-68)
- If the refresh request fails, the session is cleared and `loadAccess` returns null (treated
  as "not logged in" by callers). (src/lib/auth.js:63-65)
- `requireAccess` wraps `loadAccess` and throws "Not logged in. Run: tapestry login" if the
  result is null. (src/lib/auth.js:72-77)
- Sessions that have an `access` token but no `refresh` token (legacy format) are treated as
  absent by `loadAccess`. (src/lib/auth.js:48-50)

### login

- Prompts for email and password interactively unless both are passed programmatically.
  (src/commands/login.js:8-16) (src/commands/login.js:19-21)
- POSTs `{ email, password }` to `<registry>/v1/auth/login`. (src/commands/login.js:23-28)
- On success, saves the returned `access_token`, its decoded `exp`, and `refresh_token` to
  `~/.tapestryrc`. Prints "Logged in." (src/commands/login.js:33-34)
- The registry URL defaults to `TAPESTRY_REGISTRY` env var or
  `https://registry.tapestryengine.com`. (src/lib/registry-client.js:5)

### logout

- Reads the current session. If a refresh token is present, attempts a server-side revocation
  by POSTing the refresh token to `<registry>/v1/auth/logout`. Server errors are swallowed;
  the local session is always cleared regardless. (src/commands/logout.js:6-17)
- Deletes `~/.tapestryrc`. Prints "Logged out." (src/commands/logout.js:14-16)

### register

- Prompts for handle, email, and password unless all three are passed programmatically.
  (src/commands/register.js:8-18)
- POSTs `{ handle, email, password }` to `<registry>/v1/auth/register`. On success, saves
  the returned token pair and prints "Registered as <handle>. Logged in."
  (src/commands/register.js:24-36)

### change-password

- Requires an active session (`requireAccess`); throws if not logged in.
  (src/commands/change-password.js:9)
- Prompts for current password, new password, and confirmation; throws if the two new-password
  entries do not match. (src/commands/change-password.js:10-17)
- POSTs `{ currentPassword, newPassword }` to `<registry>/v1/auth/change-password` with a
  Bearer token. Prints "Password changed." on success. (src/commands/change-password.js:18-24)

### OIDC trusted publishing

- CI mode is detected when both `ACTIONS_ID_TOKEN_REQUEST_URL` and
  `ACTIONS_ID_TOKEN_REQUEST_TOKEN` environment variables are set. (src/lib/oidc.js:7-9)
- `fetchGitHubIdToken` fetches the GitHub OIDC id-token by GETting
  `$ACTIONS_ID_TOKEN_REQUEST_URL&audience=<audience>` with the request token in the
  Authorization header. The audience constant is `https://registry.tapestryengine.com`.
  (src/lib/oidc.js:5) (src/lib/oidc.js:11-24)
- `exchangeOIDCForAccess` POSTs the id-token (as a Bearer token) and the target scope to
  `<registry>/v1/token`, returning the `access_token` from the response.
  (src/lib/registry-client.js:169-178)
- `publish` uses OIDC in CI mode and also appends `tag: stable` to the publish form;
  in interactive mode it uses the standard session access token.
  (src/commands/publish.js:22-30)

### Trust binding management

Trust bindings authorize a GitHub repository to publish packs to a scope via OIDC without
stored credentials. All three sub-commands require an active session.

- `trust add <scope> <repo>` POSTs `{ scope, repo }` (plus optional `ref` and `environment`)
  to `<registry>/v1/trusted-publishers`. Prints the assigned id on success.
  (src/lib/registry-client.js:141-149) (src/commands/trust.js:13-19)
- `trust list` GETs `/v1/trusted-publishers` (optionally filtered with `?scope=`).
  Prints each binding as `#<id>  @<scope> <- <repo>  (ref=... env=...)`.
  (src/lib/registry-client.js:151-158) (src/commands/trust.js:22-33)
- `trust rm <id>` DELETEs `/v1/trusted-publishers/<id>`.
  (src/lib/registry-client.js:160-167) (src/commands/trust.js:36-40)

### Rate limiting

- HTTP 429 responses are detected before any other error handling. If the response includes a
  `retry-after` header (in seconds), the error message includes a "Try again in N min." hint.
  (src/lib/registry-client.js:20-24)

## Rejected and Reverted

- None on record.

## Change Log

- None on record.
