# Haunted House Dungeon Master

An AI-narrated text adventure on Cloudflare Workers. The engine owns world state and rules; the model only narrates facts.

## Run

```sh
npm install
copy .dev.vars.example .dev.vars
npm run dev
```

Open http://localhost:5173. `MOCK_LLM=1` keeps local development and tests offline. Use `npx wrangler login` and `npm run dev:ai` for remote Workers AI.

Local development uses `wrangler.local.jsonc`, which omits the Workers AI binding because Wrangler cannot emulate that binding. Production builds use `wrangler.jsonc`.

## What is here

- Pure deterministic engine: parser, rules, solver, seeded world ticks, projections, facts, and narration guard.
- `HauntedHouseAgent`: Durable Object backed chat, authoritative state, callable reset/journal operations, and scheduled ticks.
- React chat UI: command input, live narration, room, exits, inventory, and turn state.
- Workers Static Assets serve the SPA and Worker together; this is the current full-stack Workers path rather than Pages.

The model cannot mutate the world. Player text becomes a parsed action, then `validate` and `apply` decide the result. Narration receives facts produced from the result.

## Checks

```sh
npm run check
npm test
npm run build
npm run test:e2e
```

The local app has no authentication and gives each browser player an isolated instance ID. The real model path requires a Cloudflare account with Workers AI access.

## Deploy

Run `npx wrangler login`, set the production AI binding in `wrangler.jsonc`, then run `npm run deploy`. For GitHub Actions, add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` repository secrets and set the `DEPLOY_URL` repository variable for the smoke test.
