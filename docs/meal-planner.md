# Shared meal planner

Open the cutlery button next to Clear. The planner shows one Monday–Sunday week
with Breakfast, Lunch and Dinner. Today has a green border and a Today marker.
Use the arrows to change weeks. Readers need no login. The plan refreshes every
minute while open; the refresh icon next to Back on the left of the title bar
also checks for family updates. A GitHub cache may
briefly delay another device seeing a recent edit. Internet access is required.
Returning to the tab refreshes the plan. This week returns to the current week,
including if the planner was left open across Monday.

Use the two split icons at the top right to keep the plan visible during a
conversation. **Vertical split** puts captions and meals side by side;
**Horizontal split** puts captions above meals. The selected icon is highlighted.
Scroll either pane separately; Listen/Stop, Clear and Settings remain available.
Close (×) hides the planner in either split mode; full planner mode uses a Back
arrow. Press the active split again to use the full planner.
In split view, tapping the cutlery again also closes meals; the task icon switches
to tasks. Reopening keeps the split direction. Closing discards unsaved drafts.
Vertical split is disabled below 768px. An existing vertical split displays
stacked panes while narrow, and returns to side by side when widened unless you
choose another layout. Horizontal split and full planner remain available.
Switching layouts preserves the selected week and unsaved meal; the choice is kept
for this page session only. Opening the planner never starts the microphone.

## Editing in the app

The plan is stored in the public
[meal repository](https://github.com/H-Wilderspin/speech-to-text-meals), separately
from app code. Every meal and its commit history is public.

For the repository owner:

1. Open **Settings → Planner editing → Create an owner token**.
2. Sign in to GitHub as `H-Wilderspin`. Choose **Only select repositories** and
   select **speech-to-text-meals**. Give Contents **Read and write** permission
   and an expiry. Do not select the app repository or all repositories.
3. Generate the token and paste it into **GitHub token** in Settings. On a
   personal phone/tablet, tick **Remember on this device**, then **Connect GitHub**.
   Do not send the token in chat or commit it to Git.
4. Tap a meal slot, type its description, and Save. Tap an existing meal to change
   it or use Remove meal. Cancel leaves the saved plan unchanged.

Connection, Remember and Disconnect controls are all in **Settings → Planner editing**.
The planner contains the calendar and meal editor. With Remember selected,
reopening the app restores editing access without
entering the token again. Set this up separately in the browser or installed app
they use on each phone/tablet. Use a normal browsing session: private browsing,
clearing site data, or token expiry/revocation can require setup again. The owner
token creation link currently suggests a 90-day expiry, so choose an appropriate
expiry during setup and plan for renewal.

Without Remember, the token stays only in memory until reload. **Disconnect
GitHub** opens a confirmation with **Keep connected** selected by default.
Keep connected or Escape cancels without changing access. Confirm **Disconnect**
to remove access from memory and this app's saved token in that browser,
and disconnect its other open tabs. It does not revoke the token in GitHub or
disconnect other devices. If the browser blocks saving/removal, the app explains
what failed; do not assume access was remembered or forgotten.

Anyone using a remembered browser can edit. The token is stored in browser
localStorage, readable by scripts on the same website origin; it is not an
encrypted password vault. Prefer a token restricted to the meal repository.
Reading the plan always needs no token, so devices used only to view meals need
no editor setup.

A failed save retains the typed text; it is not queued for later upload.
Conflicting edits to the same meal need review before retrying. If access
expires, open **Settings → Planner editing**, disconnect, then connect a replacement token.

## Weekly defaults and one-off changes

Open any meal slot while connected. Enter the meal, then choose **Apply to →
Every Monday breakfast** (or the selected slot's weekday/meal) and Save. The meal
appears as **Weekly default** in every week that has no dated entry for that slot.
Defaults apply across all weeks, including past weeks without their own entries.

Leave **Apply to → This date only** to make a one-off change. Dated entries take
priority over defaults. **Skip this meal** leaves this date empty without changing
the recurring default. **Use weekly default** removes the dated entry or skip.
To stop a recurring meal, select its Every weekday/meal option and choose
**Remove weekly default**. Dated meals and skips are preserved.

Creating a default from a date with its own meal does not replace that dated
meal. Use weekly default separately if that date should inherit it too. Changes
to defaults are shared and refreshed like dated meals; conflicts retain the draft.

## Other family editors

First add each family member's GitHub username as a collaborator in the **data
repository**, and have them accept the invitation. An account alone does not
provide write access. No invitations are sent by the app.

GitHub currently does not support fine-grained tokens for outside/repository
collaborators. They can use **Settings → Planner editing → edit on GitHub**, sign in and edit
the week's JSON file directly, without putting a token in the app.

For in-app editing they may instead supply a personal classic token with
`public_repo` scope. That scope covers **all public repositories they can write
to**, not just meals, so the repository owner's restricted token is preferable.
Never share somebody else's token. A conventional sign-in via a GitHub App would
require additional infrastructure; this version deliberately avoids that setup.
See [GitHub's current token guidance](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens).

## JSON format and recovery

Files are `weeks/YYYY-MM-DD.json`, using the Monday's date. Example:

```json
{
  "version": 2,
  "meals": {
    "2026-10-19/breakfast": "Porridge",
    "2026-10-19/lunch": "Soup",
    "2026-10-19/dinner": null
  }
}
```

Each key must be in that week and end with `/breakfast`, `/lunch` or `/dinner`.
Values are plain text up to 300 characters, or `null` to skip that dated slot.
Remove a key to inherit its weekly default. An absent weekly file has no dated
overrides, so its defaults still appear. Existing version 1 text-only files remain
readable; new weekly saves use version 2. Invalid files display an error and
are not overwritten. Use repository file history to recover an earlier meal.
Removing it from the planner does not erase public Git history.

Recurring defaults live in `defaults.json` at the repository root:

```json
{
  "version": 1,
  "meals": {
    "monday/breakfast": "Porridge",
    "friday/dinner": "Fish and chips"
  }
}
```

Default keys use lowercase weekdays and breakfast/lunch/dinner. Their values must
be text, not null. A missing defaults file means none are set; the first saved
default creates it. Publish the updated app before using the version 2 weekly
format with live data; older clients cannot read that format.

No Pages deployment is needed for data edits. The app reads GitHub directly.
If GitHub is unavailable, an already displayed plan remains visible with an
error; a new visit cannot load an offline copy. Caption Clear is independent.
