# ADR 0074: Six-digit family pairing codes
Date: 2026-11-24
Status: Accepted

Replace ADR 0071's 80-bit invitation format with six random decimal digits for
easier entry. Keep ADR 0072's 24-hour expiry, single-device claim, hash storage
and permanent random device credentials. Existing long codes remain valid until
their original expiry. The input stays text to preserve leading zeros, requests
a numeric keypad, and accepts pasted spaces/hyphens. Reject incomplete codes locally.

Short codes have less guessing resistance. A persistent singleton D1 guard admits
five pairing requests per 15-minute window and twenty per 24-hour window, across
all clients/IPs. Windows start on the first admitted request after expiration;
these are fixed windows, not a sliding-window guarantee. Malformed requests and
successful/retried claims count too. Atomic SQL prevents concurrent bypass;
missing limiter state fails closed. Code generation does not reset the budget.
At most five unclaimed, unexpired invitations can coexist. Generation uses
cryptographic randomness with rejection sampling; collisions never replace codes.

Exhaustion returns 429 with Retry-After and delays pairing only. Existing device
sessions/saves do not use this limiter; the separate service-wide daily guard
still applies. An attacker can delay new pairings by consuming the shared budget.
This usability/security tradeoff is for the small family deployment, not an
unlimited public sign-up service. Apply migration 0002 before deploying.

Regression coverage includes leading zeros, collisions, concurrent issuance and
guesses, both time boundaries, missing limiter state, old-code compatibility,
revocation/lost-response recovery, keypad hints and isolated client backoff.

Reference: [OWASP token/PIN guidance](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html)
supports cryptographic generation, single use, expiry and brute-force protection;
the exact limits above are this application's design choice.
