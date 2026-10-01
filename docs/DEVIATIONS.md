# Deviations

- 2026-10-02: Started with a deterministic playable Agent and a placeholder workflow return. The engine already existed and is covered; durable tick orchestration and richer LLM guard/retry behavior remain the next implementation slice.
- 2026-10-02: `@cloudflare/vitest-pool-workers@0.22.0` requires Vitest 4, so the original Vitest 3 range was aligned to `^4.1.0`. The installed Agents SDK also requires MCP peers at build time; both packages were added.
- 2026-10-02: Wrangler AI binding is explicitly local by default so `MOCK_LLM=1` does not trigger OAuth during development; real-model runs can enable the remote binding in deployment configuration.
- 2026-10-02: Workers AI cannot be simulated locally by Wrangler, so Vite dev/e2e uses `wrangler.local.jsonc` without an AI binding; production uses `wrangler.jsonc` with Workers AI.
