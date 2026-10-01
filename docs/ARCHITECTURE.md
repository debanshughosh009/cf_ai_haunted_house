# Architecture

The browser connects to one `HauntedHouseAgent` instance per player ID. The Agent owns the Durable Object SQLite world row and publishes a `PublicView` projection. Commands flow through the pure engine as parse, validate, apply, facts, and narration. Workers AI is optional; `MOCK_LLM=1` uses deterministic templates.

Scheduled Agent ticks call the pure seeded tick planner and commit only events that preserve solver winnability. The Workflow entrypoint is present for durable orchestration and currently publishes deterministic tick facts.
