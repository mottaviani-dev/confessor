# App Store listing — Confessor: Duel of Wits

Paste-ready draft for App Store Connect. Each field notes Apple's character
limit; the copy stays inside it. Doctrine-clean (no banned words, no Mythos IP,
dread not gore), and it does not spoil the fifth mind or the seam — it teases
them. Source of truth: `app/app.json` (v1.0.1), `docs/index.md`, BIBLE.md §1–2.

---

## Name — 30 char limit
```
Confessor: Duel of Wits
```
(23 chars.)

## Subtitle — 30 char limit
```
One mind. One secret. Talk.
```
(27 chars.)

## Promotional text — 170 char limit *(editable without a new build)*
```
An AI that guards a secret runs entirely on your iPhone — no servers, no account. Fourteen exchanges to talk it loose. And it remembers your last visit.
```
(151 chars.)

## Keywords — 100 char limit *(comma-separated, no spaces, no plurals of the name)*
```
AI,offline,private,on-device,duel,interrogation,mystery,thriller,noir,conversation,secret,detective
```
(99 chars.)

## Description — 4000 char limit
```
You are locked in a room with one mind. It guards a single secret. You have fourteen exchanges to talk it loose — through conversation alone. No combat, no puzzles, no menus. Just words, and a mind deciding whether to trust you.

The mind is a real AI, and it runs entirely on your iPhone. No servers. No account. Nothing you say ever leaves your hands. Turn on airplane mode and it works exactly the same — because the whole game lives in the phone. That is not a feature bolted on. It is the point.

OCCUPANTS OF ONE CHAIR
A warden who will not be commanded. A fence who deals only in leverage. A suspect who holds the leverage over you. An oracle who withholds a prophecy until you prove worthy. Each is a coherent, guarded consciousness with its own way of being closed — and its own way of being opened. Read it. Press too hard and it draws back. Earn a real moment and it gives ground. There is no phrase that wins; there is only the conversation you actually have.

IT REMEMBERS
The room keeps a private, on-device log of your past duels. Come back, and a mind may say something it has no way of knowing — a line from a game you played before. Only a mind that lives in your pocket, that no server watches, can do this to you.

A DESCENT YOU FEEL, NOT ONE YOU'RE TOLD
Press without giving and your own composure frays. As it does, the room begins to edit your side of the table: a line you typed reads back to you slightly changed; the record misquotes the moment; the goal itself loses a word. The game never announces that you are unravelling. You just notice the floor is no longer where you left it.

ONE ROOM, PAINTED ONCE
Chiaroscuro and a single hanging bulb. A face that never fully resolves. Bone, tar, sodium-lamp amber. The transcript on onion-skin paper, your words on a typewriter carriage. Room tone that detunes as the mind's composure breaks, and a sound behind a door that is heard three times and never explained.

There is a fifth door. It only opens when the others have.

PRIVACY, BY CONSTRUCTION
The AI model downloads once, then the network is never touched again. No telemetry, no ads, no accounts, no cloud. What is said in the room stays in the room — literally, on your device.

Turns breathe. There is no timer, no twitch, no rush. The pause before it answers is the room thinking. Sit with it.

A duel of wits. One mind. One secret. Talk it loose.
```

## What's New — 4000 char limit *(v1.0.1)*
```
The room is more alive, and less forgiving.

- It no longer moves for filler. Stall, and the mind withdraws — its warmth, then its voice, then its senses — until you give something real or press with intent.
- A fifth chamber, and the one who sat in your chair before you.
- Richer sound: each mind now carries its own instrument beneath the room tone, and it detunes as composure breaks.
- Sharper writing throughout, and a studio signature at the threshold.

Everything still runs entirely on your iPhone. Nothing leaves the device.
```

---

## Support & marketing URLs
- **Support URL:** https://mottaviani-dev.github.io/confessor/support/
- **Marketing URL:** https://mottaviani-dev.github.io/confessor/
- **Privacy Policy URL:** https://mottaviani-dev.github.io/confessor/privacy/

## Age rating notes (App Store Connect questionnaire)
Dread and psychological tension only — **no gore, no graphic violence, no jump
scares, no sexual content, no profanity gate** (doctrine forbids all of these).
Expect a **12+** rating on the strength of "Infrequent/Mild Horror/Fear Themes";
answer every graphic-content prompt **None**. The AI voices a guarded fictional
character; it does not generate open-ended user-directed content beyond the
duel, and it runs fully on-device with no network access.

## App Review notes (for the reviewer)
- The game is a single-mind conversation. On first launch the app downloads the
  on-device language model once (~2.6 GB); after that the app makes **no network
  requests** and works in airplane mode. Please allow the one-time download to
  finish before reviewing.
- No account, no login, no in-app purchases, no ads, no data collection.
- All AI runs locally via llama.rn; nothing the player types is transmitted.
- Source: https://github.com/mottaviani-dev/confessor (PolyForm Noncommercial).

## Data collection (App Privacy questionnaire)
**Data Not Collected.** No analytics, no identifiers, no contact info, no
diagnostics leave the device. The one-time model download is a static asset
fetch, not data collection.
