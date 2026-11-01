# Movement 427 — Product Spec & Build Plan

Status: **DRAFT, awaiting approval**

## 1. Product summary

A private, offline-capable workout tracker installed as a PWA on iPhone. Users:

- build a library of activities and combine them into a plan with a flexible cadence
- log any activity on any day
- rate their day, and their "joy to move" before and after each session
- see patterns between how they feel and what they did

## 2. Decisions locked in

| Topic | Decision |
|---|---|
| Platform | PWA, **iPhone only** (Safari / home-screen install) |
| Users | 2–3 testers, fully private data, no sharing |
| Units | Pounds and miles only |
| Offline | Must fully work with **no signal**. Sync when signal returns |
| Codebase | Fresh start (not a North fork) |
| Style | `docs/style-guide.md` (Part B overrides Part A) |
| Plan builder | Deterministic code. AI suggestions are a possible later add-on |
| Timer | Data model supports intervals from day one. Timer UI ships right after core logging (Phase 4) |

## 3. Tech stack

| Layer | Choice | Why |
|---|---|---|
| UI | Vite + React + TypeScript | Fast, well-supported, easy to iterate |
| PWA | `vite-plugin-pwa` (Workbox) | Precaches the app shell and fonts. Works offline after first load |
| Local data | IndexedDB via **Dexie** | The phone's database is the source of truth. Every write lands locally first |
| Backend | **Supabase** (free tier): Postgres + Auth + row-level security | Per-user privacy enforced by the database, plus backup and sync |
| Auth | **Email one-time code (6 digits)**, signups disabled, testers invited | Magic *links* open in Safari, not the installed PWA, and iOS keeps their storage separate. Typing a code inside the app avoids that trap |
| Charts | Recharts (revisit if performance suffers) | Good enough for daily-grain data |
| Hosting | GitHub Pages via GitHub Actions (or Netlify) | Free, deploys on push |

### Offline and sync model

- Every record has a client-generated UUID plus `updated_at` and `deleted_at` (soft delete).
- Writes go to Dexie immediately, so autosave never waits on the network. A small sync queue pushes changes to Supabase when online and pulls remote changes on app open.
- Conflicts: last write wins per row. This is acceptable because each account is one person, usually on one phone.
- On first launch, call `navigator.storage.persist()`. iOS can evict data from non-installed sites, so onboarding insists on "Add to Home Screen". The server copy is the safety net.
- A sync status pip (amber = pending, teal = synced) is always visible.

## 4. Data model

```
profile            id, display_name, created_at

activity           id, user_id, name, kind, cardio_modality?, notes, archived
                   kind ∈ resistance | cardio | plyometrics | blue_collar | mobility (yoga) | other

daily_checkin      id, user_id, date (unique per user), sleep 1–5, mood 1–5,
                   motivation 1–5, rest_day bool, note

plan               id, user_id, name, active
plan_group         id, plan_id, name ("Push A", "Long walk"), order,
                   cadence_type ∈ every_n_days | weekdays | rotation,
                   cadence_value (e.g. 3, or [mon,thu]), anchor_date
plan_block         id, group_id, order, block_type ∈ straight | superset | pre_exhaust
plan_block_item    id, block_id, activity_id, order,
                   role ∈ warmup | pre_exhaust | working,
                   target (guidance only: e.g. "2 warm-up, 1 to failure")

session            id, user_id, date, started_at, ended_at, plan_group_id?,
                   joy_start 1–5, joy_end 1–5, note
session_block      id, session_id, order, block_type          (copied from plan or ad hoc)
session_entry      id, session_block_id, activity_id, order, role

set                id, entry_id, order, kind ∈ warmup | working | drop | negative,
                   weight_lb, reps, to_failure bool, parent_set_id?   (drop/neg chain to a set)
cardio_detail      id, entry_id, modality (cycling|running|sprints|norwegian_4x4|walking|…),
                   duration_s?, distance_mi?, work_s?, rest_s?, rounds?, rpe?
work_detail        id, entry_id, work_type (free text + suggestions), duration_s, effort 1–5
generic_detail     id, entry_id, duration_s?, reps?, effort 1–5?   (plyo, yoga, other)
```

Key behaviors this model supports:

- **Multiple sessions per day**, each with its own joy start/end (e.g. a morning work log plus three walks). There's one daily check-in per date, editable anytime.
- **Dynamic sets.** The plan's target is shown as guidance only. While logging, after each set the user picks **+ Warm-up · + Working · + Drop · + Negatives · Done**. Any number of each, any order.
- **Pre-exhaustion** is a user-defined block. The common pattern (compound warm-up → isolation → same compound working) is offered as a one-tap template.
- **"Last time"** comes from the most recent `session_entry` with the same `activity_id`. Its sets prefill as ghost values.
- **Cadence is advisory.** "Next up" is computed from the last time each group was logged plus its cadence. Logging off-plan is always allowed. **Re-anchor from today** is one tap.
- **Rest day** is a flag on the daily check-in. It counts toward cadence math but doesn't need a session.

## 5. Screens (v1)

1. **Today:** daily check-in strip, "next up" from the plan, sessions logged today, a big **Start session** button.
2. **Session logger:** pick a group or go ad hoc → joy-start prompt → blocks and entries (set rows / cardio / work forms) → end → joy-end → mural-style summary.
3. **Library:** activities by kind. Add, edit, archive.
4. **Plan:** groups → blocks → items. Cadence editor. Re-anchor.
5. **History:** calendar or list of sessions; per-activity progress; ratings vs. results charts (Phase 5).
6. **Settings:** account, sync status, export JSON/CSV.

Autosave happens on blur and on every discrete tap (stepper, selector). There are no Save buttons, only a "saved" pip.

## 6. Build phases

Each phase ends with a deploy you can install and test on your phone.

| Phase | Scope | Exit test |
|---|---|---|
| **0. Foundation** | Scaffold, design tokens and fonts from the style guide, app shell + bottom nav, PWA manifest and icons, service worker, Dexie schema, GitHub Pages deploy | Install to home screen. Opens in airplane mode |
| **1. Core logging (local)** | Activity library, daily check-in, sessions with all entry types, dynamic sets, joy start/end, autosave, "last time" ghosts | Log a full lift, a 4x4, and a farm session with no signal |
| **2. Accounts + sync** | Supabase project, RLS policies, email-code login, sync queue, invite 2–3 testers, upload existing local data | Two phones, two accounts, no cross-visibility. Data survives reinstall |
| **3. Plans + cadence** | Plan builder (straight, superset, pre-exhaust), cadence types, next-up, re-anchor, start session from plan | Build a 3-group plan. Skip a day. Re-anchor |
| **4. Interval timer** | Norwegian 4x4, EMOM, custom work/rest/rounds. Timestamp-based (no drift), Wake Lock, audio cues, recovers after screen lock, auto-fills the cardio entry | Run a 4x4 with the phone locked mid-interval. The time logged is correct |
| **5. History + insights** | Session history, per-activity progress (top set, volume), ratings vs. results (e.g. volume on high- vs. low-sleep days), joy trends | Spot a pattern from real tester data |
| **6. Later** | AI plan suggestions · Apple Health / smart-scale import · daylight theme · CSV import from North | n/a |

### Note on Apple Health and Wyze (future)

PWAs can't read HealthKit directly. There are two realistic paths:

1. **iOS Shortcuts automation:** a daily Shortcut reads Health samples (weight from Wyze via Health, steps, workouts) and POSTs them to a Supabase Edge Function. No app store needed. This is the recommended first step.
2. **Native wrapper (Capacitor + HealthKit plugin):** full access, but requires App Store / TestFlight distribution.

The schema will leave room for a `body_metric` table and an `external_source` field so either path drops in cleanly.

## 7. What I need from you

1. **Approve or edit this plan**, especially the phase order. Sync sits in Phase 2 so testers aren't logging weeks of unbacked-up data.
2. **Hosting:** GitHub Pages (default) or Netlify?
3. **Phase 2 prep:** create a free Supabase account when we get there. I'll walk you through it step by step on mobile.
4. **App name** on the home-screen icon: "Movement 427", or something else?
