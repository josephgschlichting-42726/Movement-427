# Setting up backup & sync (Supabase)

About 10 minutes, all doable on a phone (Safari works best, and **Request Desktop Website** helps if a menu is hidden).

## 1. Create the project
1. Go to **supabase.com** → **Start your project** → sign in with **GitHub**.
2. **New project**: name it `mov`, pick the region closest to you, and set a database password.
   Save the password somewhere safe. **Don't send it to anyone (including Claude).**
3. Wait ~2 minutes for the project to finish setting up.

## 2. Create the table (copy–paste one script)
1. Open this link, select all, copy:
   https://raw.githubusercontent.com/josephgschlichting-42726/Movement-427/claude/workout-tracking-pwa-253kse/supabase/schema.sql
2. In Supabase: **SQL Editor** → **New query** → paste → **Run**. You should see "Success. No rows returned".

## 3. Email sign-in with a 6-digit code
1. **Authentication → Sign In / Providers → Email**: make sure Email is **enabled**.
   Turn **"Allow new users to sign up" off** — only people you invite can get in.
   If you see **Email OTP length**, set it to **6**.
2. **Authentication → Emails → Templates → Magic Link** (sometimes "Magic link or OTP"):
   replace the body with:
   ```
   <h2>Your mōv code</h2>
   <p>Enter this code in the app: <strong>{{ .Token }}</strong></p>
   <p>It expires in an hour. If you didn't ask for it, ignore this email.</p>
   ```
   and set the subject to `Your mōv code`. Save.
   (The code matters: a sign-in *link* would open Safari, not the installed app.)

## 4. Invite yourself and your testers
**Authentication → Users → Add user → Send invitation** (or "Invite user"), one email at a time.
They don't need to click the invite email — they just open mōv → **Settings → Backup & sync** and request a code.

## 5. Send Claude two values
**Project Settings → API** (or **Data API** / **API Keys**):
- **Project URL** — looks like `https://abcdxyz.supabase.co`
- **anon / public** key (newer projects call it the **publishable** key, starting `sb_publishable_…`)

Both are designed to be public. **Never send the `service_role` / secret key or the database password.**

## Notes
- Supabase's built-in email sender allows only a few emails per hour — fine for 2–3 testers. If codes stop arriving, wait an hour (or set up custom SMTP later).
- Free projects pause after about a week with no activity; opening the app regularly keeps it awake, and you can un-pause from the dashboard.
