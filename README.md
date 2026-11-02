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

Shared Firebase project `mini-sites-hub`, dedicated Neon web app, App Check Enterprise and verified notoow Google accounts. Data lives under `sites/neon-zigzag`, season `v2`. Public top 20, one best score per notoow account. Run start and best-score submission are atomic and constrained by Firestore rules, elapsed time, ownership and single-use run IDs. This is a casual leaderboard, not authoritative anti-cheat: a static client cannot prove gameplay without server replay validation. The first ranked start opens notoow.com to verify its Google session, then exchanges a short-lived custom token for in-memory Firebase authentication. Retries keep that ranked session and create a fresh run; successful score submissions open the updated leaderboard. Anonymous score writes are rejected by server rules.

Backend rules and emulator tests: `E:/@E-programming/261022 kyungju/mini-sites-hub`. Existing site rules are preserved. No paid backend service added.
