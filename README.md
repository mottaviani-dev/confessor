# Confessor: Duel of Wits

An on-device LLM game: **a duel of wits in one room, against one mind that's different every time.**

You're locked in a scene with a single character the model *is* — a warden, a fence, a suspect, an
oracle. It holds a secret and a goal. You have an objective: get the code, the name, the confession,
the prophecy — **through conversation alone.** The model improvises the personality; the code holds
the secret, tracks the exchange, and rules win/lose. Every run is a new opponent. A roguelike of
conversations.

Runs **fully on-device** (no server, no per-token cost, offline, private) on recent iPhones.

## The design thesis: non-deterministic but controlled

The LLM is **only the character's voice** and a rating of how the player's last line landed. It never
holds the secret, the score, the thresholds, or the win/lose logic — all of that is deterministic code
(`app/src/engine/`). Infinite variety in the *voice*; hard rules in the *engine*. That split is what
makes a tiny on-device model (3B) able to carry a coherent, fun game where a raw freeform LLM would
drift, forget, and break its own rules.

Each turn is TWO constrained calls: a freeform VOICE reply, and a tiny classification (tone +
approach) by a neutral referee. The engine clamps everything, owns memory (a short rolling summary —
not the full transcript), assembles the character's long-term facts from the player's own disclosures,
and releases the secret only when *its own* threshold is crossed. Malformed output → a neutral no-op
turn, never a crash.

## What shipped (2026-07)

- **Engine** — hybrid loop, categorical rating (a 3B can't do calibrated arithmetic; it CAN pick one
  label), engine-owned memory, per-persona voice contracts, the seam (minds half-remember what you
  told OTHER minds), audio as a dread mechanic, 200+ unit tests.
- **Four minds** — AUGUR (warden), SILAS (fence), MARA (suspect), THE PYTHIA (oracle), each with an
  authored trust currency, referee calibration few-shots, and an unlock chain.
- **Native shell** — Expo SDK 54 + llama.rn (Metal), model downloaded on first run, cloud stand-in
  for Expo Go development.
- **Gamification** — visible objectives, a bond ladder, per-turn feedback, the Ledger (persistent
  records + the sealed-door path).
- **Art** — etched scene masters + the fissure mark, generated to a strict doctrine
  (`ART_DIRECTION.md`: one light source, the horror never shown, recovered-artifact texture).
- **Store** — production build, screenshots, metadata (`store/`).

## Layout

```
app/                 the Expo app
  src/engine/        model-agnostic game brain (pure TS, tested): types, prompts, adjudication,
                     scenarios/, seam, grip
  src/llm/           backend selection (on-device llama.rn ↔ cloud stand-in), download state machine
  src/meta/          the Ledger, bond ladder, unlock chain (pure + tested)
  src/audio/         the AudioDirector (room tone, latency masks) — code-owned, like everything else
  assets/scenes/     the etched masters
ART_DIRECTION.md     the visual doctrine + reproducible generation pipeline
docs/                specs
store/               App Store metadata + screenshots
```

## Development

```
cd app
npm install
npx expo start          # Expo Go uses the cloud stand-in (needs EXPO_PUBLIC_LLM_KEY in app/.env.local)
npm run typecheck && npx vitest run src
```

The on-device model path needs a dev build (`llama.rn` does not run in Expo Go) — see `app/AGENTS.md`.

## License

[PolyForm Noncommercial 1.0.0](LICENSE.md) — read it, learn from it, fork it, play with it;
don't ship it commercially. Copyright 2026 Matteo Ottaviani.
