# ADR 0066: Durable local planner edits with background sync

Date: 2026-11-24
Status: Accepted; supersedes ADR 0057 and the save-before-navigation/update rules in ADRs 0062 and 0065

## Context

The user prioritises uninterrupted editing for an elderly family member. Network
saves must not disable the planner, replace newer local changes, or require closing
the app. Multiple family members can edit the same public GitHub data repository.
The user approved durable local state, background batching and explicit per-item
conflict choices, without a new backend or dependency.

## Decision

An app-session PlannerSync owns shopping, dated-week and weekly-default documents.
Completed actions update the local view immediately and append uniquely identified
operations to IndexedDB. The database and tab channel are scoped to the app's base
path. Cached documents and acknowledged operation removals share one transaction.
No credentials, captions or audio are stored in this database.

Start a background save after two seconds of inactivity, with a ten-second maximum
batch window while editing continuously. Serialize document writes in each tab.
Each write reads the latest GitHub file and SHA, merges operations, then writes only
when the document differs. Retry SHA races up to three times, reading again between
attempts. Network failures retain the queue and back off from two to sixty seconds.
Focus/online return and footer Refresh permit an earlier retry. Pending documents
continue saving while hidden; hidden documents do not poll. Visible documents poll
every minute; the optional shopping catalogue reloads every five minutes.

Acknowledge only captured operations. Later edits remain overlaid on the response.
Recognise an already-committed operation sequence after a lost response. Other tabs
share the journal and receive BroadcastChannel invalidations; conditional GitHub
writes still arbitrate races. This is eventual sync, not real-time collaboration.

Merge changes to distinct meal keys/items and independent shopping fields. Preserve
concurrent additions during moves. Keep conflicting local values visible, show
Yours and Family beside that cell/item, and offer Keep mine or Use family change.
Unrelated operations can still save. Delete-versus-edit and incompatible order
changes require a choice; a move does not resurrect a deleted item. Keeping a rename
that collides with another item's name explicitly allows both stable IDs to remain.

Navigation waits for local persistence, starts a save, and does not wait for the
network. If local storage fails, view navigation still works because the client
retains its queue in memory; warn before page exit. Update app can reload once all
completed actions are durable locally or saved remotely. Unapplied editor text is
retained across view/week switches within the session, but not across reload.
Drag gestures defer publication and new requests until drop/cancel.

## Consequences

The UI remains usable offline after a document has been loaded. Pending operations
survive normal reload/app updates and retry after connection/token recovery.
Browser storage is best effort: clearing site data, eviction or private-session
closure can remove cached/pending data. Explain storage failure and never advertise
memory-only changes as saved on the device. Existing public Git history remains.
Disconnect removes access, not cached documents or pending operations; reconnecting
resumes saves. Old clients still use their older sync rules until updated.

## Validation

Unit tests cover field merges, captured acknowledgements, lost responses, SHA retry,
failed storage/network and held drag publication. Chromium/WebKit tests in
local-sync.spec.ts cover offline reload, two tabs, active drafts, conflicts,
continued editing/navigation and blocked storage. Existing app, planner, drag and
service-worker update suites remain regression coverage. Physical-device checks
remain necessary; see manual-testing.md and feasibility.md.
