import { AIChatAgent } from "@cloudflare/ai-chat";
import { callable } from "agents";
import { createUIMessageStream, createUIMessageStreamResponse, convertToModelMessages, streamText } from "ai";
import { createWorkersAI } from "workers-ai-provider";
import house from "../../content/house.json";
import {
  apply,
  applyTickPlan,
  buildFacts,
  loadContent,
  parse,
  planTick,
  project,
  renderEventsParagraph,
  validate,
  createWorld,
  type Content,
  type World,
} from "../engine/index";
import type { Action, PublicView } from "../shared/types";
import { EMPTY_VIEW } from "../shared/types";

const CONTENT = loadContent(house) as Content;

function textOf(message: { parts?: Array<{ type: string; text?: string }> }): string {
  return (message.parts ?? [])
    .filter((part) => part.type === "text")
    .map((part) => part.text ?? "")
    .join("")
    .trim();
}

export class HauntedHouseAgent extends AIChatAgent<Env, PublicView> {
  initialState = EMPTY_VIEW;
  maxPersistedMessages = 200;
  private world?: World;

  async onStart() {
    this.sql`CREATE TABLE IF NOT EXISTS world_state (world TEXT NOT NULL)`;
    this.sql`CREATE TABLE IF NOT EXISTS event_log (seq INTEGER PRIMARY KEY AUTOINCREMENT, event TEXT NOT NULL)`;
    this.sql`CREATE TABLE IF NOT EXISTS tick_journal (tick_id TEXT PRIMARY KEY, status TEXT NOT NULL, plan TEXT, facts TEXT, text TEXT, at INTEGER NOT NULL)`;
    const row = this.sql<{ world: string }>`SELECT world FROM world_state LIMIT 1`[0];
    this.world = row ? JSON.parse(row.world) as World : createWorld(CONTENT, crypto.randomUUID());
    if (!row) this.sql`INSERT INTO world_state (world) VALUES (${JSON.stringify(this.world)})`;
    this.setState(project(this.world, CONTENT));
    await this.scheduleEvery(Number(this.env.TICK_SECONDS || 600), "onWorldTick");
  }

  validateStateChange(_nextState: PublicView, source: "server" | object) {
    if (source !== "server") throw new Error("read-only");
  }

  @callable()
  newGame(): PublicView {
    this.world = createWorld(CONTENT, crypto.randomUUID());
    this.sql`DELETE FROM world_state`;
    this.sql`INSERT INTO world_state (world) VALUES (${JSON.stringify(this.world)})`;
    const view = project(this.world, CONTENT);
    this.setState(view);
    return view;
  }

  @callable()
  getJournal() {
    return this.sql<{ event: string }>`SELECT event FROM event_log ORDER BY seq DESC LIMIT 50`
      .map((row) => JSON.parse(row.event));
  }

  @callable()
  ackDigest() {
    const view = this.state;
    this.setState({ ...view, awayDigest: [] });
  }

  async onWorldTick() {
    const world = this.world;
    if (!world || world.won) return;
    const now = Date.now();
    const awayMs = now - world.lastSeenAt;
    const away = Array.from(this.getConnections()).length === 0 && awayMs >= Number(this.env.AWAY_SECONDS || 300) * 1000;
    const tickId = `tick-${now}`;
    try {
      await this.runWorkflow("WORLD_TICK", { tickId, away, awayMs });
    } catch {
      const plan = this.planTick(tickId, away, awayMs);
      if (plan.events.length === 0) return;
      const { facts } = this.commitTick(tickId);
      this.attachTickNarration(tickId, facts.events.map((event: { text: string }) => event.text).join(" "));
    }
  }

  planTick(tickId: string, away: boolean, awayMs: number) {
    if (!this.world) throw new Error("Agent not initialized");
    const plan = planTick(this.world, CONTENT, {
      tickId,
      now: Date.now(),
      playerAway: away,
      awayMs,
      stealAwayMs: Number(this.env.STEAL_AWAY_SECONDS || 1800) * 1000,
    });
    this.sql`INSERT OR REPLACE INTO tick_journal (tick_id, status, plan, at) VALUES (${tickId}, ${"planned"}, ${JSON.stringify(plan)}, ${Date.now()})`;
    return plan;
  }

  commitTick(tickId: string) {
    if (!this.world) throw new Error("Agent not initialized");
    const row = this.sql<{ plan: string; status: string; facts: string | null }>`SELECT plan, status, facts FROM tick_journal WHERE tick_id = ${tickId}`[0];
    if (!row?.plan) return { committed: [], facts: buildFacts("tick", [], this.world, CONTENT) };
    if (row.status === "committed" && row.facts) return { committed: [], facts: JSON.parse(row.facts) };
    const applied = applyTickPlan(this.world, JSON.parse(row.plan));
    applied.world.version += 1;
    const facts = buildFacts("tick", applied.events, applied.world, CONTENT);
    this.saveWorld(applied.world, applied.events);
    this.sql`UPDATE tick_journal SET status = ${"committed"}, facts = ${JSON.stringify(facts)} WHERE tick_id = ${tickId}`;
    return { committed: applied.events, facts };
  }

  attachTickNarration(tickId: string, text: string) {
    const row = this.sql<{ at: number }>`SELECT at FROM tick_journal WHERE tick_id = ${tickId}`[0];
    if (!row) return;
    const digest = [...this.state.awayDigest, { tickId, text, at: row.at }].slice(-20);
    this.sql`UPDATE tick_journal SET status = ${"narrated"}, text = ${text} WHERE tick_id = ${tickId}`;
    this.setState({ ...project(this.world!, CONTENT), awayDigest: digest });
  }

  private saveWorld(world: World, events: unknown[]) {
    this.world = world;
    this.sql`DELETE FROM world_state`;
    this.sql`INSERT INTO world_state (world) VALUES (${JSON.stringify(world)})`;
    for (const event of events) this.sql`INSERT INTO event_log (event) VALUES (${JSON.stringify(event)})`;
    this.setState(project(world, CONTENT));
  }

  async onChatMessage() {
    const world = this.world ?? createWorld(CONTENT, crypto.randomUUID());
    const input = textOf(this.messages.at(-1) ?? {}).slice(0, 300);
    const result = parse(input, world, CONTENT);
    let action: Action | undefined = result.kind === "action" ? result.action : undefined;
    let events = [] as ReturnType<typeof apply>["events"];
    let nextWorld = world;

    if (action) {
      const checked = validate(world, CONTENT, action);
      if (checked.ok) ({ world: nextWorld, events } = apply(world, CONTENT, action, Date.now()));
      else events = [{ type: "action_failed", code: checked.code, reason: checked.reason }];
    } else {
      events = [{ type: "action_failed", code: "UNKNOWN", reason: "The house does not understand. Try 'help'." }];
    }

    if (action && events.length > 0 && !events.every((event) => event.type === "action_failed")) {
      this.saveWorld(nextWorld, events);
    }
    const facts = buildFacts("turn", events, nextWorld, CONTENT, input);
    const fallback = renderEventsParagraph(events, CONTENT);
    if (this.env.MOCK_LLM === "1") return mockResponse(fallback);

    const workersai = createWorkersAI({ binding: this.env.AI });
    const resultText = streamText({
      model: workersai(this.env.LLM_MODEL),
      system: "You are a truthful haunted-house narrator. Use only the supplied FACTS.",
      messages: [...(await convertToModelMessages(this.messages)), { role: "user", content: `FACTS: ${JSON.stringify(facts)}` }],
      maxOutputTokens: 220,
    });
    return resultText.toUIMessageStreamResponse();
  }
}

function mockResponse(text: string): Response {
  const stream = createUIMessageStream({
    execute: ({ writer }) => {
      const id = crypto.randomUUID();
      writer.write({ type: "text-start", id });
      writer.write({ type: "text-delta", id, delta: text });
      writer.write({ type: "text-end", id });
    },
  });
  return createUIMessageStreamResponse({ stream });
}
