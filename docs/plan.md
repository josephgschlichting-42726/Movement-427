# mōv — Product Spec & Build Plan

Status: **DRAFT v2, awaiting approval**

## 1. Product summary

**mōv** (pronounced "move") is a private, offline-capable workout tracker installed as a PWA on iPhone. Users:

- build a **library** of workouts organized by **type**
- assemble those workouts into a **plan** with a flexible cadence
- log any planned day or any single workout on any day
- rate their day, and their "joy to move" before and after each session
- see patterns between how they feel and what they did

## 2. Decisions locked in

| Topic | Decision |
|---|---|
| App name | **mōv** — "move", with a macron for the long vowel (home-screen label, manifest `name` and `short_name`). Wordmark: concrete "m" + "ō", signal-orange "v" (see style guide B7) |
| Launch | Animated splash: wordmark builds in (~0.8s), holds, fades; tap to skip; static under Reduce Motion |
| Platform | PWA, **iPhone only** (Safari / home-screen install) |
| Users | 2–3 testers, fully private data, no sharing |
| Units | Pounds and miles only |
| Offline | Must fully work with **no signal**. Sync when signal returns |
| Codebase | Fresh start (not a North fork) |
| Style | `docs/style-guide.md` (Part B overrides Part A) |
| Plan gate | **A plan is required before logging.** First launch walks the user through building one. After that, the user can log the suggested day, any other plan day, or any single workout from the library |
| Plan builder | Deterministic code. AI suggestions are a possible later add-on |
| Where planning lives | **Settings → Planning** (Workout Library + Plan), plus the first-run setup flow |
| Day mixing | A plan day can contain **multiple types** |
| Targets | **Optional** per workout in a plan, shown as guidance only. Logging is never constrained by them |
| Cadence | **One mode per plan:** weekdays **or** day numbers, never mixed |
| Day-number shifts | **Ask each time:** show the calendar-expected day and the next-in-sequence day, and the user picks |
| Priority | History and charts come **before** the interval timer. The timer is a nice-to-have |

## 3. Core concepts

```
Type      → Resistance, Cardio, Rest, Plyometrics, Flexibility, Blue Collar, + user-added
Workout   → belongs to one Type (e.g. "Incline dumbbell fly" → Resistance)
Plan      → a named sequence of Days, with one cadence mode
Day       → "Day 3" or "Wednesday", optional label ("Legs"), made of Segments
Segment   → one Type + an ordered list of Workouts from that type (+ optional targets)
```

### 3.1 Types and how they're logged

Every type has a **default log format**. Each workout inherits it but can override it. For example, "Walking" under Rest can log time and distance.

| Log format | Fields captured | Default for |
|---|---|---|
| **Sets** (weighted) | Dynamic sets: kind (warm-up / working / drop / negative), weight lb, reps, to failure | Resistance |
| **Sets** (bodyweight) | Dynamic sets: reps, optional added load or height | Plyometrics |
| **Time / distance / intervals** | Duration, distance mi, optional zone, optional intervals (work s, rest s, rounds) | Cardio |
| **Time + effort** | Duration, effort 1–5, note | Blue Collar, Flexibility, Rest |

- The six default types are seeded on first launch. Users can **rename, add, or archive** types. When adding a type, the user picks its default log format.
- New users get a small, optional **starter list** of common workouts per type that they can delete. Each type also has a prominent **+ Add workout** button, because the library is meant to grow constantly.

### 3.2 Building a plan (the repeating pattern)

The builder follows exactly the loop you described, without assuming any particular split:

1. Name the plan and choose a cadence mode: **Days of the week** or **Day numbers (Day 1…N, repeats)**.
2. **Add a day:** pick the weekday or take the next day number, and optionally label it ("Legs", "Rest", "Norwegian 4x4").
3. **Add a segment:** pick a **type**, and the picker shows that type's workouts. Select one or more, or add a new one inline without leaving the builder.
4. Optionally set **targets** per workout (e.g. "2 warm-up + 1 working to failure, 8–10 reps", "60 min, zone 2", "4×4 min / 3 min rest").
5. Optionally group resistance workouts into a **superset** or **pre-exhaustion** block. A one-tap template covers compound warm-up → isolation → same compound working.
6. Add another segment to the same day, or add the next day. **Repeat until the user taps Done.**

Days can be reordered, duplicated ("same as Day 2") and edited anytime. One plan is active at a time. Others can be saved as drafts.

*Example (illustrative only):* Day 1 Cardio: cycling, 60 min zone 2 · Day 2 Resistance: front squat, split squat, single-leg DL, calf raise, tib raise · Day 3 Rest: walking, Wim Hof breathing, yoga · Day 4 Cardio: 30 min zone 3–4 · … · Day 9 Rest.

### 3.3 "Next up" logic

- **Weekday plans:** next up is today's weekday entry. If that weekday is empty, Today says "Nothing planned" and offers any plan day or workout.
- **Day-number plans:** Today shows two candidates when they differ:
  - **Next in sequence:** the day after the last plan day logged.
  - **On schedule:** the calendar position from the plan's anchor date.

  The user taps one, or picks any other day. **Re-anchor** (set "today = Day N") is one tap.
- Off-plan logging of any single workout from the library is always available.

### 3.4 Skipping

Plans bend to real life (sore foot, travel, a bad night's sleep). Skipping is always one tap and never blocks anything.

- **Skip a workout within a day:** on any workout in a session, tap **Skip**. An optional reason chip appears (Sore / Injury · Equipment · Time · Energy · Other + note). The workout is greyed out and the rest of the day continues. Example: skip tib raises because of a sore foot.
- **Skip a whole day:** on the next-up card, tap **Skip day** (with the same optional reason). For day-number plans, "next in sequence" moves on to the following day. For weekday plans, it just marks that day as skipped.
- **Not a plan edit:** skipping only affects that one occurrence. The plan is unchanged. A separate **Remove from plan** (in Settings → Planning) is for permanent changes.
- **Skipped ≠ missing:** a skip is recorded deliberately, so History and adherence charts show *done*, *skipped (with reason)* and *missed (nothing logged)* differently. "Last time" ghost values ignore skipped entries and use the last time the workout was actually done.

### 3.5 Nothing is ever locked: go back, undo, edit

**Core principle: no action is final.** Skip, Done, Next, End session and Delete can all be reversed, at any time, with no time limit.

- **Instant undo:** every state-changing tap (Skip, Done, Skip day, End session, Delete set) shows an **Undo** bar for about 6 seconds. Undo restores the exact previous state.
- **Go back within a session:** **Next** only moves forward through the list; it never locks the previous workout. **Back** and a tappable workout list let the user jump to any workout in the session and change sets, values, status, or the skip reason.
- **Un-skip and un-done:** a skipped workout or day can be switched to *pending* or *done*. A done workout can be reopened to *pending* or *skipped*. A skipped day can be un-skipped and logged.
- **Reopen finished sessions:** a completed session (today or any past date) opens from Today or History in the same editor. Users can add, edit, or delete sets, add a forgotten workout, change joy ratings, times, or the date, and change which plan day it counts as.
- **Next up recalculates:** next up is always derived from the current log, never stored. Un-skipping a day or editing a past session immediately corrects "next in sequence" and the charts.
- **Deletes are soft:** a deleted set, workout entry, or session is hidden but recoverable (Undo bar, plus "Recently deleted" in Settings for 30 days). Sync respects this.
- **Autosave applies to edits too:** editing a past session saves the same way as live logging. There is no separate "edit mode" to forget to save.

## 4. Tech stack

| Layer | Choice | Why |
|---|---|---|
| UI | Vite + React + TypeScript | Fast, well-supported, easy to iterate |
| PWA | `vite-plugin-pwa` (Workbox) | Precaches the app shell and fonts. Works offline after first load |
| Local data | IndexedDB via **Dexie** | The phone's database is the source of truth. Every write lands locally first |
| Backend | **Supabase** (free tier): Postgres + Auth + row-level security | Per-user privacy enforced by the database, plus backup and sync |
| Auth | **Email one-time code (6 digits)**, signups disabled, testers invited | Magic links open in Safari, not the installed PWA, and iOS keeps their storage separate |
| Charts | Recharts (revisit if needed) | Good enough for daily-grain data |
| Hosting | GitHub Pages via Actions (default, pending confirmation) | Free, deploys on push |

### Offline and sync model

- Every record has a client-generated UUID plus `updated_at` and `deleted_at` (soft delete).
- Writes go to Dexie immediately, so autosave never waits on the network. A sync queue pushes changes to Supabase when online and pulls on app open.
- Conflicts: last write wins per row. This is fine because each account is one person, usually on one phone.
- On first launch, call `navigator.storage.persist()`. Onboarding insists on "Add to Home Screen". The server copy is the safety net.
- A sync status pip (amber = pending, teal = synced) is always visible.

## 5. Data model

```
profile            id, display_name, created_at

workout_type       id, user_id, name, default_log_format, order, archived, is_seeded
                   default_log_format ∈ sets_weighted | sets_bodyweight | time_distance | time_effort
workout            id, user_id, type_id, name, log_format_override?, notes, archived

plan               id, user_id, name, status ∈ active | draft | archived,
                   cadence_mode ∈ weekdays | day_number, anchor_date?   (day_number only)
plan_day           id, plan_id, order, day_number? | weekday? (0–6), label?
plan_segment       id, plan_day_id, type_id, order
plan_block         id, segment_id, order, block_type ∈ straight | superset | pre_exhaust
plan_item          id, block_id, workout_id, order, role ∈ warmup | pre_exhaust | working,
                   target_sets?, target_reps?, target_duration_s?, target_distance_mi?,
                   target_zone?, target_intervals? {work_s, rest_s, rounds}, target_note?

daily_checkin      id, user_id, date (unique per user), sleep 1–5, mood 1–5,
                   motivation 1–5, note                          (once per day, editable anytime)

session            id, user_id, date, started_at, ended_at, plan_day_id?,
                   status ∈ in_progress | done | skipped, skip_reason?, skip_note?,
                   joy_start 1–5, joy_end 1–5, note              (many per day; a skipped day = a session with status skipped)
session_block      id, session_id, order, block_type
session_entry      id, session_block_id, workout_id, order, role,
                   status ∈ pending | done | skipped, skip_reason?, skip_note?
set                id, entry_id, order, kind ∈ warmup | working | drop | negative,
                   weight_lb?, reps, to_failure, parent_set_id?
timed_detail       id, entry_id, duration_s?, distance_mi?, zone?, work_s?, rest_s?, rounds?
effort_detail      id, entry_id, duration_s?, effort 1–5, note?
```

Logging behaviors this supports:

- **Multiple sessions per day**, each with its own joy start and end.
- **Dynamic sets.** The plan target is shown as guidance. After each set the user picks **+ Warm-up · + Working · + Drop · + Negatives · Done**.
- **"Last time":** the most recent entry for the same workout prefills as ghost values.
- **Rest days** are simply plan days built from Rest-type workouts. They're logged like any session (e.g. a walk and yoga, each with joy start and end).

## 6. Screens (v1)

1. **First-run setup:** welcome (mōv wordmark) → install to Home Screen → review types and starter workouts → build plan → land on Today.
2. **Today:** daily check-in strip · next-up card(s) · today's sessions · **Start session** (planned day or single workout).
3. **Session logger:** joy start → segments and workouts (log format per workout) → end → joy end → mural-style summary.
4. **History:** sessions by date, per-workout progress, ratings vs. results charts.
5. **Settings:** **Planning** (Workout Library, Plan builder) · account · sync · export.

Bottom nav: **Today · Log · History · Settings**.

Autosave happens on blur and on every discrete tap. There are no Save buttons.

## 7. Build phases

Each phase ends with a deploy you can install and test on your phone.

| Phase | Scope | Exit test |
|---|---|---|
| **0. Foundation** | Scaffold, design tokens and fonts, app shell + bottom nav, PWA manifest ("mōv") and icons, service worker, Dexie schema, deploy | Install to Home Screen as "mōv". Opens in airplane mode |
| **1. Library + Plan builder** | Types (seeded + custom), workouts per type, plan builder loop, both cadence modes, targets, superset/pre-exhaust blocks, first-run setup with plan gate | Recreate the 9-day example and a weekday-based plan from scratch, offline |
| **2. Logging** | Today + next-up (incl. "ask each time"), daily check-in, sessions for every log format, dynamic sets, joy start/end, "last time" ghosts, off-plan logging, skip workout / skip day (with reasons), undo bar, back-navigation, reopen and edit any past session, un-skip / un-done, soft delete, autosave | Log a leg day with tib raises skipped then un-skipped, skip a day then undo it, reopen yesterday's session and fix a weight, a 4x4, a rest day (walk + yoga) and farm work with no signal |
| **3. Accounts + sync** | Supabase, RLS, email-code login, sync queue, upload local data, invite testers | Two phones, two accounts, no cross-visibility. Data survives reinstall |
| **4. History + charts** | Session history, per-workout progress (top set, volume, duration), ratings vs. results (e.g. volume on high- vs. low-sleep days), joy start→end trends, adherence to plan (done / skipped by reason / missed) | Spot a pattern from real tester data |
| **5. Interval timer** *(nice-to-have)* | Norwegian 4x4, EMOM, custom intervals. Timestamp-based, Wake Lock, audio cues, survives screen lock, auto-fills the entry | Run a 4x4 with the phone locked mid-interval. The time logged is correct |
| **6. Later** | AI plan suggestions · Apple Health / Wyze via Shortcuts · daylight theme · North import | n/a |

Testers start real daily use after Phase 3, so their data is backed up from day one. Phases 1–2 can be tried locally before then.

### Note on Apple Health and Wyze (future)

PWAs can't read HealthKit directly. There are two paths:

1. **iOS Shortcuts automation** that posts Health samples (including Wyze weight via Health) to a Supabase Edge Function. Recommended first.
2. **Native wrapper** (Capacitor + HealthKit) via TestFlight.

The schema will leave room for a `body_metric` table and an `external_source` field.

## 8. Open items

1. **Hosting:** GitHub Pages (default) or Netlify?
2. **Phase 3 prep:** create a free Supabase account when we get there (guided on mobile).
