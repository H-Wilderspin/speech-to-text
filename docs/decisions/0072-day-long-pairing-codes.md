# ADR 0072: Allow a full day to enter pairing codes
Date: 2026-11-24
Status: Accepted

## Context
Family members may miss a message containing their pairing code. The owner
requested 24 hours to enter it, avoiding repeated invitation creation.

## Decision
New single-use invitations expire 24 hours after creation, replacing ADR 0071's
15-minute duration. Existing invitations keep their stored expiry. Device
credentials still have no routine expiry, and invitation cleanup never removes
an approved device. Settings explains both timeframes.

## Consequences
An unused code can grant access for longer, so continue sharing it only with the
intended family member. Codes remain random, stored as hashes and single-use.
No database migration or change to existing device access is needed.

## Validation
Service regression tests exercise pairing immediately before the 24-hour limit,
rejection at the limit, and remembered access a year later after expired
invitation cleanup. Existing tests cover reuse and revocation.
