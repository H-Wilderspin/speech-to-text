# ADR 0014: Persistent listening and spoken stop

Date: 2026-10-10
Status: Accepted; supersedes ADR 0001's natural-end, retention-limit and cumulative-result policies

## Context

The user reports captions repeating the whole growing phrase with each new word. The native result payload was not collected, so the phone-specific cause remains unconfirmed. The user explicitly requests listening until button Stop or the spoken phrase “command stop”. ADR 0001's natural-end behaviour does not meet that requirement.

The [Web Speech specification](https://webaudio.github.io/web-speech-api/) defines native session results, interim replacement and an end event. Single-utterance mode should produce at most one final result. A regression fixture with cumulative phrases in successive final slots reproduces the reported visual symptom with the previous adapter.

## Decision

Keep explicit application listening intent across native recognizer instances. Use single-utterance recognition with interim results, starting the first instance in the Listen gesture. After normal end or no-speech, detach the old instance, retain confirmed text and schedule the next. Use 200 ms initial delay, increasing to at most two seconds for consecutive empty cycles; new text resets it. A no-speech error missing its end event gets a two-second cleanup fallback. Own only one instance and one lifecycle timer. Stop, voice stop, interruption, disposal and terminal errors cancel intent and pending restart. Permission/start still times out after 30 seconds.

Within one native utterance, accept strict word-prefix extensions of prematurely finalized slots and collapse adjacent cumulative extensions for display. Keep raw current slots until the cycle ends, so a disappearing interim extension cannot erase its confirmed prefix. Never deduplicate against prior utterances; repeated utterances and repeated words remain. Exact identical independent result slots are preserved. This narrow heuristic can conflate unusual independent prefix-extending results within a malformed single-utterance response; physical validation remains necessary.

Recognize case-insensitive whole words “command stop” with whitespace/punctuation between them in confirmed results, including across automatic restarts. Interim guesses do not stop capture. Keep preceding confirmed speech, omit the command and trailing text, detach callbacks and abort capture immediately. Manual Stop followed by Listen starts a new command boundary. Button Stop still allows up to two seconds for a final result before aborting.

Retain the latest 100,000 characters in memory rather than stopping a full session. Explain rolling retention and the voice command beside the controls. No audio/transcript persistence, network service or speaker identity is introduced.

## Consequences

Pauses no longer intentionally end the application session. Native restarts can have capture gaps, and some browsers may require another gesture or permission prompt; check on phones. Backgrounding/locking the app and terminal microphone/provider errors can still interrupt capture. The user must keep the app open. Spoken stop depends on provider recognition and finalization, and applies when anyone's confirmed speech contains the phrase. Older captions expire in long sessions.

## Validation

Unit and browser regression tests cover growing cumulative phrases, repeated utterances, restart/silence recovery, cancellation during a restart, late callbacks, command boundaries, interim command guesses and rolling retention. Physical Pixel 8 retesting is required before claiming the reported repetition bug resolved on that device. iPhone remains unavailable. Executed checks are recorded in feasibility notes.
