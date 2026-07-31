# ADR 0002: Retain Basic Auth / CLI Secret Connections

**Status:** Accepted, 2026-07-31

## Decision

The console retains its existing server-side Basic Auth / Harbor CLI Secret connection model and multi-instance behavior. Native Harbor OIDC login, self-registration, and a Harbor session-cookie proxy are not implemented.

## Context

Harbor Portal parity for native authentication would require either an independent OIDC client per configured IdP, including registered redirect URIs and secure token/session handling, or a single-upstream session proxy. The former cannot reuse Harbor's unexposed client secret; the latter conflicts with this console's multi-instance model.

## Security Considerations

Any later native login design must validate state, nonce and PKCE; use a strict redirect allowlist; prevent cookie-domain leakage, session fixation and CSRF; avoid static token or log exposure; and define instance-switch, logout and refresh behavior.

## Consequences

Connections remain compatible with multiple Harbor instances and browser storage never contains Harbor credentials or upstream cookies. Native Harbor login parity is explicitly **NOT IMPLEMENTED**. A future OIDC or session-proxy implementation requires its own ADR, IdP registration details, and real Harbor integration acceptance.
