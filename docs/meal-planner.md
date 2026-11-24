# Shared meal planner

The optional [family connection service](hosted-editing.md) lets devices pair once
instead of entering GitHub tokens. Its Worker and database are deployed and live
reads/saves are verified. Existing token instructions below apply until
the service URL is enabled. Completed local edits survive switching connections.

Open the cutlery button next to Clear. The planner shows one Monday–Sunday week
with Breakfast, Lunch and Dinner. Today has a green border and a Today marker.
Use the arrows to change weeks. Readers need no login. The plan refreshes every
minute while visible; the global footer's Refresh icon checks both meals and
shopping for family updates, including the hidden app. Only changed data is
replaced, preserving drafts. Week arrows sit beside the Meal planner title, with
the date stacked beneath the title inside the same header. A GitHub cache may
briefly delay another device seeing a recent edit. Internet access is required to share changes; previously loaded plans are cached locally.
Returning to the tab refreshes the plan. This week returns to the current week,
including if the planner was left open across Monday.

On phones and tablets, swipe left across the header or meal cards to go forward
one week, or right to go back. This works in full and split views, including when
scrolled down. Each week's unfinished editor text is retained for the page session.
Short or vertical gestures, pinch gestures and swipes within editor controls do
not change weeks. The arrow buttons remain available for keyboard/pointer access.

On touch screens, pull down from the header while scrolled to the top. Release
when prompted to sync completed edits and refresh both planners, just like the
footer Refresh button. This keeps editor text and captions in place without a
page reload. Short pulls cancel; gestures on controls do not trigger refresh.
The footer Refresh icon appears only at 1024px and wider with a mouse/trackpad
primary pointer. Phones and touch tablets use the pull gesture.

Breakfast, Lunch and Dinner headings stay visible beneath the title/date while
scrolling. On narrow screens with stacked meals, each label stays with its card.
Meal text starts at the top; Weekly default appears as a tag at the bottom.

Use the **Split view** toggle in the footer, just left of Settings, to keep captions visible on the
left and meals on the right. It is available at 768px and wider, including laptops
and desktops. Turn it off to use the full planner. No top/bottom layout is offered.
Each pane scrolls independently. The global footer remains visible in full and
split views. Use the speech-bubble Speech to text icon to return directly to full
captions. Tapping the active cutlery icon again also returns to captions; the cart switches to shopping with the
same split preference. Settings uses that full/split layout too; tap Settings
again to return to captions, or select Meals to return to the retained draft. No Back/Close buttons or Escape/outside
dismissal are used. Reopening keeps the split preference.
Below 768px the toggle is hidden and the planner is full screen. Widening restores
the preferred split without losing the selected week or editor draft. Editor drafts survive screen/week switches for this page session but clear on reload.
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
3. Generate the token and paste it into **GitHub token** in Settings, then tap
   **Connect GitHub**. Successful connections are saved automatically on this device.
   Do not send the token in chat or commit it to Git.
4. Tap a meal slot, type its description, and Save. Tap an existing meal to change
   it or use Remove meal. Cancel leaves the saved plan unchanged.

Connection, Change token and Disconnect controls are all in **Settings → Planner editing**.
The planner contains the calendar and meal editor. After a successful connection,
reopening the app restores editing access without
entering the token again. Set this up separately in the browser or installed app
they use on each phone/tablet. Use a normal browsing session: private browsing,
clearing site data, or token expiry/revocation can require setup again. The owner
token creation link currently suggests a 90-day expiry, so choose an appropriate
expiry during setup and plan for renewal.

**Disconnect GitHub** opens a confirmation with **Keep connected** selected by default.
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

Save applies the meal immediately and keeps the completed action on this device.
It saves to GitHub in the background after about two seconds of inactivity, with
a ten-second maximum batching window. Keep editing or switch screens while it
saves. Failed/offline saves remain queued across normal reloads. Refresh overlays
pending local changes on the latest family data; it never replaces your newer edit
with an older save response. Different meal cells merge automatically. Competing
changes to the same dated cell or weekly default show Yours/Family and the choices
Keep mine / Use family change beside that cell. Other cells keep saving.

If access expires, open Settings and enter a replacement token, then tap
**Save new token**. The app verifies it before replacing the old connection;
no disconnect step is needed. Pending changes resume after access is restored.
To replace a token early, use **Change token**. Disconnect removes access but
retains cached/pending planner data. Clearing browser site data can remove it.
If device storage fails, keep the app open until GitHub saves succeed.
See [ADR 0066](decisions/0066-local-first-planner-sync.md).

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
error; a new visit restores previously cached plans and completed pending edits. Caption Clear is independent.
