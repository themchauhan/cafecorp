# Firestore backup & recovery runbook (Phase 8)

**Status: documented but not yet tested against a real project** — no
real Firebase project exists yet (`.firebaserc`'s `projects.default` is
still the emulator-only placeholder `cafeteria-management-dev`; see
README.md's "Using a real Firebase project" section). CLAUDE.md rule 6
and Phase 8's own acceptance criteria require dummy data only until a
real project exists, so there's nothing to back up yet. **This runbook
must be run through once — export, then an actual restore into a
scratch project — before any real pilot cafeteria's data goes into this
app.** Written now so the procedure exists and is reviewed before it's
urgently needed, not invented under pressure after data loss.

## What this covers

Firestore (all tenant data, `platformAdmins`, `subscriptionPayments`).
Does **not** cover Firebase Auth users — see "Auth users" below, a
separate, smaller procedure.

## One-time setup (per real Firebase project)

1. The project must be on the **Blaze (pay-as-you-go) plan** to use
   managed export/import — this is the one place in the whole app that
   needs Blaze, since it's a GCP/Cloud Storage feature, not a Cloud
   Function (CLAUDE.md hard rule #4 is about avoiding Cloud Functions
   specifically, not Blaze itself for unrelated features). Exports
   /imports themselves have no ongoing cost beyond Cloud Storage
   storage + the one-time export/import operation.
2. Create a Cloud Storage bucket for backups, in the same region as
   the Firestore database (`asia-south1` per CLAUDE.md's tech-stack
   note), e.g. `gs://cafeteria-management-prod-backups`.
3. Grant the project's default App Engine / Cloud Firestore service
   account (`<project-id>@appspot.gserviceaccount.com`) the
   **Cloud Datastore Import Export Admin** IAM role, and grant it
   **Storage Admin** (or a narrower read/write role) on that specific
   bucket.
4. Install/authenticate the `gcloud` CLI locally or in CI:
   `gcloud auth login && gcloud config set project <project-id>`.

## Manual export (run this first, before automating it)

```bash
gcloud firestore export gs://cafeteria-management-prod-backups/manual-$(date +%Y%m%d-%H%M%S) \
  --project=<project-id>
```

This is an **online** export — it does not lock or degrade the live
database, safe to run any time. It exports the entire database by
default (all collections, including every tenant's subcollections).

## Scheduled export

No Cloud Functions in this app (CLAUDE.md hard rule #4), so the
scheduled export itself should **not** be a Cloud Function trigger —
use one of:

- **Cloud Scheduler → Cloud Run job** (preferred): a small scheduled
  Cloud Run job that just shells out to the same `gcloud firestore
export` command above, on a cron schedule (e.g. daily at 02:00 IST).
  This is infrastructure config, not application code — doesn't touch
  the Next.js app or its Vercel deployment at all.
- **A scheduled GitHub Actions workflow** (simpler to set up, no new
  GCP service to manage): a workflow on a `schedule:` cron trigger that
  authenticates with a service account key (stored as a GitHub secret)
  and runs the same `gcloud firestore export` command.

Either way: keep the last **30 days** of daily exports (lifecycle rule
on the bucket to auto-delete older ones), so storage cost stays small
and bounded.

## Restore (the part that must actually be tested before a real pilot)

**Never import into the live project to "test" a restore** — always
restore into a **separate scratch project** first:

```bash
# 1. Create (or reuse) a throwaway Firebase project for the restore test.
# 2. Import the most recent export into it:
gcloud firestore import gs://cafeteria-management-prod-backups/manual-20261003-140000 \
  --project=<scratch-project-id>

# 3. Point a local .env.local at the scratch project (real
#    NEXT_PUBLIC_FIREBASE_* + FIREBASE_ADMIN_* values, NOT the
#    emulator) and run `npm run dev` against it.
# 4. Manually verify: tenants list loads in /super-admin, a known
#    tenant's menu/orders/dailySummaries read back correctly, and spot
#    check the specific dailySummaries doc math against the known
#    seed/test data used when the backup was taken.
```

A restore **into the live project** (the actual disaster-recovery
scenario, not a drill) follows the same `gcloud firestore import`
command, but first-import semantics matter: an import does **not**
delete documents that only exist in the live database and not in the
export — it overwrites/adds documents from the export. Deleted-since-
backup documents would NOT be removed. For an MVP pilot's scale, this
is an acceptable trade-off (prefer surviving duplicates/undeletes over
losing data by building a destructive "wipe-then-import" step with no
drill for it), but it's a judgment call worth revisiting once this is
backing a real multi-tenant production system.

## Auth users

`gcloud firestore export`/`import` only covers Firestore, not Firebase
Authentication users (email/password credentials, custom claims). Use
the separate Admin SDK export:

```bash
firebase auth:export auth-backup-$(date +%Y%m%d).json --project=<project-id>
```

Run it on the same schedule as the Firestore export, into the same
bucket (via a follow-up `gsutil cp` — `auth:export` writes locally
first). Restoring: `firebase auth:import <file> --project=<project-id>`
— same "never test against the live project" rule applies. Custom
claims (`role`, `tenantId` — CLAUDE.md hard rule #2) are included in
this export, so a restored user keeps their tenant/role assignment.

## Open items before a real pilot

- [ ] Actually create a real (Blaze) Firebase project and run the
      one-time setup above.
- [ ] Run one manual export against that project (even with only dummy
      data in it) and confirm it lands in the bucket.
- [ ] Run one restore into a scratch project and manually verify the
      data, per "Restore" above — this is the step that's
      **untested**, not just unscheduled.
- [ ] Wire up the scheduled export (Cloud Run job or GitHub Actions —
      pick one; GitHub Actions is less new infrastructure to maintain
      for a small MVP).
- [ ] Set the bucket's lifecycle rule (30-day retention).
