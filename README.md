# Wordline

A caller proposes one English word. The contract does not accept a private definition. It reads the word from two public dictionaries, Datamuse and dictionaryapi.dev, and compares only the primary part of speech with `gl.eq_principle.strict_eq`.

The result is a new case. Nothing replaces an older case.

- `LOCKED` — both sources returned the same class. That case becomes the standing lock for the word.
- `REFUSED` — both sources returned a class, but not the same one. The word is not locked.
- `UNCONFIRMED` — only one source returned a class.
- `UNKNOWN` — neither source has the word.
- `UNAVAILABLE` — a source could not be read. Nothing is locked.
- `ALREADY_LOCKED` — a standing lock already exists, so this call records a pointer to it and does not replace it.

## Deployed contract

Checked on Studio Explorer:

- Address: `0xB7aD46d539b9b66D0bad03081704aA3f24a5fB23`
- Deploy tx: `0x33c46a34cc72f494b091e1454ce215d4881a1bc554fb2d2c87a532ea9faf9306`
- Status: `FINALIZED`, leader execution `SUCCESS`
- The deployed source contains `propose` and does not contain `define`

No `propose` call has been checked yet. The frontend includes this address.

## Studio

Deploy `contracts/wordline.py` with no constructor arguments.

Call `propose` with `consensus`. After `FINALIZED` and `SUCCESS`, `get_case` `1` should be `LOCKED` with agreed part `noun`, and `get_standing` `consensus` should return that same case.

Call `propose` with `consensus` again. The new case should be `ALREADY_LOCKED`, and case `1` should still be the standing lock.

Call `propose` with `zzzzzqqq`. The new case should be `UNKNOWN` or `UNCONFIRMED`, not `LOCKED`.

A word that is not 2 to 20 letters must revert with `UserError`.

## Frontend

`genlayer-js` is pinned to `1.1.8` because Studionet does not expose `sim_getFeeConfig`.

```bash
cd frontend
npm ci
npm run build
```

Paste is unnecessary: the page already uses `0xB7aD46d539b9b66D0bad03081704aA3f24a5fB23`. Do not switch it back to the rejected address.
