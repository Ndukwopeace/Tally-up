# Setup steps for the owner (Supabase and Vercel)

These are the steps only you can do, because they happen in your Supabase and Vercel dashboards. Nothing here needs code. Do them **on staging first**. Do production only after the A1 pull request is merged (DB-3).

Never paste a key into a chat, an issue or a file in the repository.

## 1. Check the Vercel environment variables (names only)

Vercel → your project → **Settings → Environment Variables**.

The app needs two values in each environment (Production, Preview, Development):

| What | Accepted names (any one) |
|---|---|
| Project URL | `VITE_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_URL` |
| Public key (anon / publishable) | `VITE_SUPABASE_ANON_KEY`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_ANON_KEY`, `SUPABASE_PUBLISHABLE_KEY` |

The Supabase integration normally creates these for you. Check two things:

1. Preview and Development point to **tallyup-staging**; Production points to **tallyup-production**.
2. If the names carry a prefix (for example `STAGING_SUPABASE_URL`), tell Claude the **names** (not the values). The build only reads the names above.

If the variables are missing, the app shows "Tally-Up is not connected" instead of the login page.

Safety net: if a **secret** key is ever placed under one of these names, the build stops with an error instead of publishing it.

## 2. Turn off public sign-up (both projects)

Supabase → **Authentication → Sign In / Providers** → turn off **Allow new users to sign up**.

Accounts are created only by an admin (AUTH-02). With sign-up off, nobody can create their own login, including through Google later (AUTH-04).

## 3. Set the site address and allowed redirect addresses

Supabase → **Authentication → URL Configuration**.

**Staging project (tallyup-staging):**

| Field | Value |
|---|---|
| Site URL | Your main preview address, for example `https://tallyup-git-main-ndukwopeaces-projects.vercel.app` |
| Redirect URLs | `https://*-ndukwopeaces-projects.vercel.app/**` and `http://localhost:5173/**` |

**Production project (tallyup-production), after merge:**

| Field | Value |
|---|---|
| Site URL | Your production address (Vercel → tallyup → Overview → Domains, for example `https://tallyup.vercel.app`) |
| Redirect URLs | `https://<your production address>/**` |

Why this matters: the "forgot password" email links back to `/reset-password` on the same address. If that address is not in the list, Supabase sends people to the Site URL instead, and they land in the app without being asked for a new password.

## 4. Create the database tables and security rules

Supabase → **SQL Editor** → **New query**.

Run each file in [`supabase/migrations/`](../supabase/migrations/) **once, in name order**, in each project. Each file is run after its pull request is merged:

| File | Milestone |
|---|---|
| `20261002120000_a1_profiles_and_audit.sql` | A1 (done) |
| `20261002130000_a2a_products.sql` | A2a Products, part 1 (tables) |
| `20261002130100_a2a_product_units_writer.sql` | A2a Products, part 2 |
| `20261002130200_a2a_save_product.sql` | A2a Products, part 3 (save function) |
| `20261002131000_a2a_description_optional.sql` | A2a: description optional |
| `20261002140000_a2b_depots.sql` | A2b Depots, part 1 (table, depot link on accounts) |
| `20261002140100_a2b_assign_manager.sql` | A2b Depots, part 2 |
| `20261002140200_a2b_save_depot.sql` | A2b Depots, part 3 (save function) |
| `20261002150000_a2c_user_phones.sql` | A2c Users, part 1 (phone numbers on accounts) |
| `20261002150100_a2c_assign_manager_as.sql` | A2c Users, part 2 |
| `20261002150200_a2c_user_checks.sql` | A2c Users, part 3 (the rules) |
| `20261002150300_a2c_save_user.sql` | A2c Users, part 4 (save function) |
| `20261002150400_a2c_active_depots_only.sql` | A2c: inactive depots are not given to managers (Q-58) |

For each file:

1. Open it on GitHub and click the **Copy raw file** button (two overlapping squares above the code). Selecting the text on the page can copy only part of a long file. Each file is kept under 100 lines for the same reason.
2. Click **Run**. It should say "Success. No rows returned".
3. Running a file twice fails with "already exists"; that is harmless.
4. If the editor warns that tables are created without Row Level Security, choose **Run without RLS**: every file switches RLS on itself. The other choice inserts extra lines into the query.

Try a new migration on **staging** first, with the pull request's preview link. Run it on **production** after the pull request is merged (DB-3).

### 4a. The server key for Users (A2c)

Creating a login and setting a password need Supabase's **secret** key. It lives only in Vercel and is never in the app or the repository (SEC-4).

Vercel → **tallyup** → **Settings → Environment Variables**. Check that these exist for **Preview** (staging database) and **Production** (production database). The Supabase integration normally creates them:

| Name | Value |
|---|---|
| `SUPABASE_URL` | The project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | The project's secret key (Supabase → Project Settings → API Keys, "service_role" or "secret") |

If the secret key is missing, add it by hand, for the right environment only. After adding it, **redeploy** (Deployments → the latest → Redeploy), because functions read it when they start. Users shows "Tally-Up could not be reached" until this is done.

## 5. Create the first admin (you)

The first admin is seeded at setup (REQUIREMENTS §4). Two parts:

**a. The login.** Supabase → **Authentication → Users → Add user → Create new user**. Enter your email and a password. Tick **Auto Confirm User**.

**b. The Tally-Up account.** Supabase → **SQL Editor** → new query. Replace the name and email, then **Run**:

```sql
insert into public.profiles (id, full_name, email, role)
select id, 'Your Full Name', email, 'admin'
from auth.users
where email = 'you@example.com';
```

It should say "1 row affected". "0 rows" means the email does not match the login from step a.

## 6. Test on your phone (staging)

Open the Vercel preview link from the pull request.

| Try | Expected |
|---|---|
| Open the link | The login page |
| Wrong password | "Wrong email or password." |
| Your email and password | The admin Home |
| Profile (account menu) | Your name, email, role "Admin" |
| Home and the tabs | No Back arrow |
| More → Depots → Back | Back to More (never another tab) |
| Sign Out (account menu) | "Signing out…", then the login page; Back does not reopen the admin screens |
| Forgot password with your email | An email arrives; its link opens "Choose a new password" |
| Type `/depot` in the address bar while signed in | You stay in the admin portal |

To check that non-admins are refused: create a second login (step 5a) and a profile with role `'distributor'` (step 5b with `'distributor'` instead of `'admin'`). Signing in with it shows "Sign-in for your role is not open yet."

## Known limits in A1

- **Reset emails reach only your team.** Supabase's built-in email sender only delivers to members of your Supabase team, a few emails per hour. Your own reset works. For distributors and managers, an email provider must be connected in Supabase (open item SMTP-1).
- **Google sign-in** shows "Not available yet" until you add the Google OAuth client in Supabase (AUTH-05).
- **Password rules** come from Supabase: **Authentication → Providers → Email → Minimum password length** (Supabase's default is 6). The app does not set its own rule. Choose the length you want.
