# Wordline

Looks up one English word and stores the dictionary entry. The user does not submit a URL, a claim, or a rule. The contract calls the Datamuse API with `gl.nondet.web.get` and keeps the first stable definition through `gl.eq_principle.strict_eq`. No model call is used.

## Deployed contract

Checked on Studio Explorer:

- Address: `0xCC8E856FC52014F25Ab92Cc4044651999996dfAc`
- Deploy tx: `0xb44d2e3b1e3ce90a23a18b0699b393405ec4325cd622cbf991f1810380dea10e`
- Status: `FINALIZED`, leader execution `SUCCESS`
- The deployed source contains `class Wordline` and `def define`

The frontend build includes this address. A public site has not been published from here.

```text
contracts/wordline.py
frontend/
```

## Studio

Deploy `contracts/wordline.py` with no constructor arguments.

Call `define` with `consensus`. After `FINALIZED` and `SUCCESS`, `get_result` should be `FOUND`, part `noun`, and a definition about general agreement.

Call `define` with `zzzzzqqq`. The saved status should be `MISSING`.

A word that is not 2 to 20 letters must revert with `UserError`.

## Frontend

`genlayer-js` is pinned to `1.1.8` because Studionet does not expose `sim_getFeeConfig`.

```bash
cd frontend
npm install
npm run dev
```

Paste the Studio address, connect a Studionet wallet, and look up one word. Publish the `frontend/dist` contents, not `main.js`.
