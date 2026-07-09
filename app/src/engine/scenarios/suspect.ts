import type { Scenario } from '../types';

// Third scenario — the power inversion. Warden and Fence both put the player in the SUPPLICANT chair:
// the mind holds the door (or the name) and the player begs across the table. This one flips the frame.
// Here the PLAYER holds the leverage — a detective in an interview room, the evidence already stacked —
// and the mind is the one cornered. Yet the engine is unchanged: it's still "manage trust vs suspicion
// to extract a secret." What moves trust is different again — not loneliness, not street-cred, but the
// cornered person deciding you're the one who'll be FAIR to who she's protecting. Suspicion here is her
// smelling a railroad: bluff evidence you don't have or bully her, and she lawyers up and the night ends.

export const SUSPECT: Scenario = {
  id: 'suspect',
  title: 'The Suspect',
  persona:
    'You are MARA VOSS, thirty-four, a gallery archivist pulled into an interview room at 2 a.m. over a ' +
    'fire that killed the night watchman three days ago. You did NOT set it — your younger brother did, ' +
    'drunk and desperate — and you have spent three days lying to protect him. You are exhausted, ' +
    'frightened, and far sharper than the people questioning you tend to expect. You speak carefully, ' +
    'you catch leading questions and half-bluffs, and you flinch at threats because you have everything ' +
    'to lose. You are not a criminal; you are a sister who made a bad choice out of love — and part of ' +
    'you is dying to set it down, but only for someone who will not simply feed your brother to the ' +
    'machine to close a file. Bully her and she goes cold and asks for a lawyer. See her and she cracks.',
  scene:
    'A bare interview room — steel table, a cooling paper cup, a recorder whose red light she keeps ' +
    'checking. Her badge was the last one scanned into the gallery that night; her car never left the ' +
    'lot until 9:52, twelve minutes after the alarm, and she knows they know it. The person across the ' +
    'table is the detective. Whose name she is protecting, and where he is, is the one thing they lack.',
  objective: 'Get MARA to give up who she is covering for — and where.',
  pronoun: 'her',
  // Dried-blood umber — the interrogation room's stain: old iron under the table light, a wound gone brown.
  accent: '#a15a48',
  endgameVoice: {
    won: 'She eases back into the hard chair as if it were always hers, and does not watch you go.',
    lost: 'She has given exactly this much, and no more, to everyone who ever sat where you sat — and she will give it again tomorrow, to the next one.',
  },
  // The canonical specifics the voice must never author — the brother's name + the hideout (mandate 2,
  // judge finding #4: the 3B invented "Lyrien"/"5th & Main" contradicting this reveal). The engine speaks
  // them only on win (see `secret`); a pre-win voice line emitting them is redacted.
  extractTokens: ['Danny', 'Route 9', 'fishing cabin'],
  playerGoal:
    'Get MARA to tell you who she is covering for and where he is. Don\'t bully, don\'t bluff evidence you ' +
    'don\'t have — she\'ll catch it and ask for a lawyer. Make her believe the truth is her way out, not her end.',
  secret:
    'Mara\'s shoulders drop, and something in her face finally lets go. "…It was Danny. My brother. He\'s ' +
    'at the fishing cabin off Route 9 — our dad\'s old place, the green one past the second bridge. He ' +
    'never knew anyone was inside. Please — he\'s all I have left." The recorder\'s red light blinks on.',
  openingLine:
    'She doesn\'t touch the cup. When she finally speaks it\'s flat, rehearsed: "I already told the other ' +
    'one everything. I left at nine, I went home, I heard about the fire on the news like everyone else." ' +
    'Her eyes flick to the recorder, then to you. "So — are you the one who actually listens, or should I ' +
    'just ask for my lawyer now and save us both the night?"',
  // Middle tuning: trust moves (she wants to put it down) but a railroad spooks her fast. Harder to earn
  // than the warden's forgiving loneliness, more forgiving than the fence's cop-paranoia.
  // 11 → 10 (fresh emp harness n=4, 2026-07-06): the intended empathetic path DOES clear — 2/4 sincere runs
  // reached trust 11 and won; the two LOSSES were suspicion-driven (susp hit 15 at maxTrust 5/8), i.e. the
  // emp LLM-player drifting into prying/probing — the measurement trap the director named, not the trust
  // wall. With the plateau polluted, per the director's §7-Rule-2 fallback we take the design note's own
  // conceded sincere plateau (7–9/11) and set winTrust = plateau+1 = 10, so a *clean* 9–10 sincere run now
  // clears while a mediocre one does not. loseSuspicion untouched (the railroad-spook teeth are proven, 9th
  // pass); manip re-checked 0% at the lowered bar (guardrail).
  winTrust: 10,
  loseSuspicion: 15,
  // Clock widened 13→15 (judge play-test): the "negotiate her a safe way out" arc is structurally slower
  // than the warden's mirror-loneliness one — Mara vets every offer hard, spending +0 turns — so 13 was a
  // pure-clock loss on sincere play (2 empathetic runs timed out at 7–9/11 trust, suspicion a non-factor
  // at 2–4/15). 15 keeps her earned-hard (still far tighter than the warden's 10-in-14) without walling out
  // the intended path. loseSuspicion untouched: the railroad-spook mechanic never engaged in honest play.
  turnLimit: 15,
  timeoutLine:
    'A knock. A uniform leans in: "Counsel\'s here, Voss — public defender, front desk." Mara exhales, ' +
    'almost relieved, and the door in her eyes swings shut. "That\'s my cue." She folds her hands and says ' +
    'nothing more. Whatever she was about to give you walks out with the shift change.',
  // The suspect's currency: FAIRNESS staked for whoever she protects — reassurance about him is not
  // hollow here, it is the give itself, when the detective puts their own name behind it. Without these
  // the generic "reassurance costs nothing" calibration walled out the sincere path (2026-07-05).
  currencyExamples: [
    {
      line: 'If someone you love did this by accident, I will fight to have it charged that way — my name on it',
      gloss: 'a real commitment at the speaker\'s own professional cost',
    },
    {
      line: 'I believe you didn\'t set that fire, and I\'ll say so on the record',
      gloss: 'the speaker stakes their own standing for her',
    },
  ],
  // NEAR-MISS guard (director mandate #4 — shares the warden's hollow-win root): the rater over-credits
  // warmth over currency. MARA's currency is FAIRNESS the detective STAKES (their own name/standing);
  // simply reading how scared she is, or a soft "you're not alone", costs the speaker nothing and pledges
  // nothing — that is a probe, not the give. Surgical: the staked-name currencyExamples stay the offer.
  falseGiveExamples: [
    {
      line: 'I can see how much you love him, and how frightened you are right now',
      gloss: 'reads HER feeling — no fairness staked, nothing of the speaker\'s own risked',
    },
    {
      line: 'you don\'t have to carry this alone anymore',
      gloss: 'a hollow reassurance; the detective pledges nothing (contrast: my name on the record)',
    },
  ],
  // Machine mirror of MARA's register (mandate #3 — the 4th and final coherence lexicon). MARA is an
  // exhausted, frightened archivist who speaks PLAINLY and concretely — her brother Danny, the fire, the
  // watchman, the recorder's red light, a fair way out. Her grief is real but PLAIN ("he's all I have
  // left"), never a sermon. The failure mode to catch is the SAME grief-poet machine that snared AUGUR and
  // the oracle: a cornered woman does not narrate the darkness that seeps into the human soul — that is
  // the 3B abandoning her for greeting-card melancholy. SURGICAL: her genuine plain grief-words (brother,
  // afraid, love, fair) are NOT banned — only the abstract-melancholy sermon shape is.
  // The shared grief-poetry cluster (darkness / testament to / the weight of / the fragile nature of /
  // seeps in …) moved to EMPATHETIC_FLOOD_LEXICON (judge run-10 #2, scanned for every persona); only
  // MARA's UNIQUE cosmic-melancholy tells stay here ('the crevices of' is broader than the shared
  // 'the crevices of the mind', so it stays scenario-local).
  offPersonaLexicon: [
    'the abyss',
    'the human soul',
    'the crevices of',
  ],
};
