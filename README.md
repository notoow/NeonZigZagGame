# Neon ZigZag

One-button, 100 BPM rhythm zigzag. Run locally with `python -m http.server 18802`, then open localhost:18802. Run deterministic engine tests with `npm test`.

## Input and timing

Pointer events avoid duplicate touch/mouse turns. Space/Z/X ignore keyboard auto-repeat. Each corner accepts one input; extra taps and premature inputs end the run, preventing Z/X spam. Movement and judgment use elapsed seconds rather than rendered frames. Shortest turns take 300 ms; early buffer 160 ms, late grace 120 ms, PERFECT within 45 ms. Ranked runs use the same seeded chart. Backgrounding pauses the run.

Synthesized original percussion and bass share the AudioContext clock with gameplay. No borrowed music or proprietary source code.

## References

- [A Dance of Fire and Ice, developer page](https://fizzd.itch.io/a-dance-of-fire-and-ice): one-button rhythmic timing.
- [Developer explanation of timing windows](https://steamcommunity.com/app/977950/discussions/0/2979655949477760861/): tempo-related timing tolerance. This game's fixed 100 BPM thresholds are our own tuning.
- [Infinite Stairs, official listing](https://play.google.com/store/apps/details?id=com.nflystudio.InfiniteStaircase): rapid repeated actions and direction changes. Its internal implementation is not public; this is an adaptation of interaction principles, not copied source.

## Ranking

Shared Firebase project `mini-sites-hub`, dedicated Neon web app, verified notoow Google accounts and App Check Enterprise. Season `v3` accepts only server-computed results; historical `v2` records remain read-only. Login persists across reloads. Account name hiding affects local rendering, not the public leaderboard.

`notoow/supabase/functions/neon-ranked` verifies Firebase ID-token and App Check signatures, project/audience/issuer and app identity. It issues randomized, expiring runs, receives ordered live input batches, checks server-clock drift and pause state, replays the identical engine, and atomically writes only computed best scores. The browser never submits an authoritative score or nickname. A separate server-only Firebase custom identity is restricted by Firestore rules to Neon records; no project-wide Firestore IAM privilege was added. Direct player writes to old/new run and score paths are denied.

Limits: 8 KiB requests, 64 inputs per batch, 4,096 total inputs, 20-minute gameplay, 30-minute session expiry, 10-second active checkpoint deadline and 600 starts per account/day. Network retries reuse sequence/payload and persist acknowledgements. Impossible/expired results fail closed. Replay and live timing block scalar-score edits and bulk fabricated past/future play; human-like automation cannot be conclusively distinguished in an untrusted browser. No client obfuscation or F12 blocking is treated as a security boundary.

Validation: `npm test` here; `node --test test/neon-ranked.test.mjs test/game-login.test.mjs` in adjacent `notoow`; `npm run test:rules` in `261022 kyungju/mini-sites-hub`. The integration tests expect these sibling checkouts to verify the actual shared production implementation. Server/browser engine copies are equality-tested. Existing other-site rules are preserved.
