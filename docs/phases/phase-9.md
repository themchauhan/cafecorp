# Phase 9 — Kitchen timers

Closes the gap between the marketing page's "Kitchen display: Orders
appear on a kitchen screen with timers, so no slip gets lost." and
the Phase 3 kitchen board, which only showed a static "sent at"
timestamp — no live elapsed time, no visual urgency as a ticket ages.

## Scope

- Each kitchen ticket shows a live, ticking elapsed-time counter
  (minutes:seconds since `kotSentAt`), not a static clock time.
- Visual urgency escalation as a ticket ages, so a slip that's been
  sitting too long is obvious at a glance: normal → amber warning →
  red urgent, at configurable thresholds.
- Pure client-side UI — no new Firestore fields, no Server Action
  changes. `kotSentAt` already exists on every order.

## Tasks

- [ ] `KitchenBoard` computes and re-renders elapsed time every
      second via a client-side ticking interval.
- [ ] Threshold-based color escalation (e.g. 0-5 min normal, 5-10 min
      warning, 10+ min urgent) — thresholds as named constants, not
      magic numbers.
- [ ] Unit test for the elapsed-time/threshold formatting logic.
- [ ] Manual test: send an order to the kitchen, watch its timer
      count up and change color past each threshold.

## Acceptance criteria

- Kitchen board shows a live counting timer per ticket, not a static
  timestamp.
- A ticket visibly changes color as it crosses each age threshold.
