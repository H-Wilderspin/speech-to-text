# Local planner drafts and shopping Undo

Accepted, 2026-11-24. Supersedes the session-only draft behaviour in 0066.

Keep unfinished meal/shopping drafts in path-scoped localStorage, separate from
the IndexedDB journal of submitted edits. Preserve the original edit base so a
restored draft cannot silently overwrite a newer family change. Save submits;
Cancel removes. Captions, audio and connection-field drafts are never included.

Tab-specific slots preserve independent editors. A new tab can recover the latest
valid draft; completing it only removes the exact recovered revision. Storage
failure keeps memory state, displays a warning and blocks app update. Browser-data
deletion or eviction can still lose drafts. Meals reopen at a recovered draft week.

Undo cancels the local deletion when possible and queues a restoration if the
write may already have started or finished. Restoration retains the row ID and
bought state, uses surviving neighbours for placement, and never replaces a newer
row or duplicates a matching name. The most recent removal is undoable while the
shopping panel remains mounted; Undo itself is not persisted across reloads.

The footer distinguishes drafts, pending durable edits, sharing, conflicts and
confirmed saves. Cached data and an empty queue alone do not imply a successful
family check. This status is not a guarantee that another device has no newer edits.
