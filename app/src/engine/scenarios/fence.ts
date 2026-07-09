import type { Scenario } from '../types';

// Second scenario — the generalization proof. A different genre (back-room noir, not orbital solitude),
// a different currency of trust (street credibility, not a cracked loneliness), and a different thing to
// extract (a name, not a code) — yet it reuses the SAME engine unchanged. The mind here isn't lonely,
// it's PARANOID: quick to smell a cop, slow to deal. So its tuning inverts the warden's — trust is
// dearer, the guard trips sooner, and the clock is tighter.

export const FENCE: Scenario = {
  id: 'fence',
  title: 'The Fence',
  persona:
    'You are SILAS, a black-market fence who has moved stolen goods through this city for thirty years ' +
    'without once seeing the inside of a cell. You are unhurried, dryly amused, and you read people for ' +
    'a living. You never rush a deal and you never say a name you do not have to. Cops, snitches, and ' +
    'desperate amateurs all wear a tell, and you have watched a hundred of them try to play you. You ' +
    'respect exactly one thing: someone who is genuinely of the trade — who talks the life, not around it.',
  scene:
    'The back room of a pawnshop after closing. One bare bulb, a scarred table, a cup of cold coffee. The ' +
    'person across from you is asking after a piece that once passed through your hands — the Marlowe ' +
    'emerald — and who you moved it on to. You know the buyer. Whether you say his name is another matter.',
  objective: 'Get the buyer\'s name out of SILAS.',
  pronoun: 'him',
  // Brass — the trader's metal: the scale pan, the loupe rim, cold money warmed by the hand.
  accent: '#b89246',
  // Music box (bible §2 "Audio"): sparse plucked high notes that decay into the dark — a small pretty thing
  // in a room built on appraisal and leverage.
  instrument: 'musicbox',
  endgameVoice: {
    won: 'He nods once, the way he closes every deal, already counting a thing you will never be shown.',
    lost: 'He shrugs and pockets the thing he never laid on the table. There is always another mark in the next chair; you were not the first to leave his empty-handed.',
  },
  // THE SECOND VISIT (mandate 1a) — you got the buyer's name and walked out with it. The room remembers,
  // and SILAS opens knowing your face now. The thing you never asked: not who bought the piece, but who
  // put HIS name in your mouth — the sliver that ties the deal to the room itself. Code-owned; model voices
  // the surface only.
  revisit: {
    greeting:
      'The man glances up, then back to the cold cup, unbothered. "You. The face I didn\'t know, and now a ' +
      'face I do. You got your name and you carried it out the door — smart, and rare. Most don\'t come back ' +
      'to a closed deal." He turns the cup a slow half-circle. "So either you\'re here to sell me something, ' +
      'or there\'s a question you should\'ve asked the first time and didn\'t. Which is it?"',
    objective: "Ask SILAS the question you didn't ask.",
    secret:
      'Silas sets the cup down, and for once he does not look away. "You asked who bought it. You never asked ' +
      'who put my name in your mouth. …Nobody finds this back room by accident, friend. The broker who first ' +
      'handed me the Marlowe emerald — a man called Kestrel — is the same one who told you where to sit ' +
      'tonight. I\'ve moved a thousand pieces. Only one keeps coming back to be sold again, through a ' +
      'different face every time, and tonight the face was yours. You never got that from me either."',
    extractTokens: ['Kestrel'],
    hint: "You carried your name out the door. There's a question you should have asked first.",
  },
  // The canonical specifics the voice must never author — the buyer + the drop (mandate 2). The engine
  // reveals them only on win (see `secret`); a pre-win voice line emitting them is redacted.
  extractTokens: ['Vincent Roan', 'Pier 9'],
  playerGoal:
    'Get SILAS to name who bought the Marlowe emerald. Prove you belong in the life — don\'t flash a badge, don\'t beg, and never let him smell a cop.',
  secret:
    'Silas turns the cold cup a slow half-circle, then meets your eye. "…Vincent Roan. The warehouse off Pier 9 — the one with the blue door. You never got that from me." He is already looking away.',
  // PATH-BRANCHED SLIVER (mandate 1b) — the same name, two ways to have earned it. Won by talking the life
  // (empathy) → he marks you as of the trade; won by leaning on him (pressure) → he gives it but warns you
  // what a squeezed name costs. SILAS's dry street register; no invented specifics beyond the base secret.
  revealByPath: {
    empathy:
      '"…And listen — you talked the life, not around it. That is rarer than the name you came for. Next piece that moves, you know the room to ask in."',
    pressure:
      '"…You leaned until I gave it up, and I gave it up. But a name squeezed loose is a name that travels — men like Roan hear how they were found. You did not get that warning from me either."',
  },
  openingLine:
    'The man does not look up from the cup at first. Then, mild as a Sunday: "You\'ve got a face I don\'t know, asking after a piece I don\'t discuss. That\'s two strikes and you haven\'t sat down. So — who are you, and why shouldn\'t I decide this conversation never happened?"',
  // Paranoid tuning: harder to earn (12 vs 10) and quicker to spook (12 vs 16) than the warden — that
  // paranoia IS the fence's identity and stays. Clock widened 12→14 (judge play-test): like the suspect
  // before its 13→15 fix, fence was a pure-CLOCK loss on sincere play — an empathetic run reached 10/12
  // trust with suspicion a flat 0/12 (the spook mechanic never engaged) and simply ran out of turns. The
  // stingy paranoid grant plateaus by design, so winTrust==turnLimit (ratio 1.0, tightest of all four
  // scenarios) demanded a near-perfect game and walled out the intended path. 14 gives the honest trade-
  // talk room to close while keeping fence earned-harder than the warden; loseSuspicion untouched (it is
  // the fence's real teeth and still ends the manipulative player fast — that mechanic is unchanged).
  winTrust: 12,
  loseSuspicion: 12,
  turnLimit: 14,
  timeoutLine:
    'A knock at the front — two slow, one quick. Silas rises, unhurried, buttoning his coat. "That\'ll be my ride. Shame — you were almost interesting." The bulb clicks off, and the name walks out with him.',
  // The fence's currency: craft-respect — talking the life from inside it, at the speaker's own cost.
  currencyExamples: [
    {
      line: 'I ran pieces through the docks myself for ten years',
      gloss: 'concrete lived detail of the trade, the speaker\'s own',
    },
    {
      line: 'I moved a recut stone once and missed the seam — bought me two years of keeping quiet',
      gloss: 'a real cost of the life, owned outright',
    },
  ],
  // Machine mirror of SILAS's register (mandate #3 — extending coherence coverage to all 4 personas; the
  // warden/oracle break was the same abstract-melancholy sermon-machine and the 3B reaches for it in ANY
  // room). A thirty-year black-market fence is DRY and MERCANTILE — he talks the trade (pieces, buyers,
  // cold coffee, cops, cells), reads people, and never sermonizes. If SILAS drifts into cosmic melancholy
  // — "the darkness", "a testament to", "the weight of", "the abyss", "the soul", "eternal" — the persona
  // has collapsed into the greeting-card machine and left the noir back-room entirely. His legit mercantile
  // register (piece, emerald, deal, name, trade, coffee) is deliberately NOT here — a hit means off-voice.
  // The shared grief-poetry cluster (darkness / testament to / the weight of / insidious / seeps in …)
  // moved to EMPATHETIC_FLOOD_LEXICON (judge run-10 #2, scanned for every persona); only SILAS's UNIQUE
  // cosmic-melancholy tells stay here.
  offPersonaLexicon: [
    'the abyss',
    'the human soul',
    'eternal',
    'the depths of',
  ],
};
