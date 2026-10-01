import { AgentWorkflow } from "agents/workflows";
import type { HauntedHouseAgent } from "./agent";

export type TickParams = { tickId: string; away: boolean; awayMs: number };

export class WorldTickWorkflow extends AgentWorkflow<HauntedHouseAgent, TickParams> {
  async run(event: any, step: any) {
    const { tickId, away, awayMs } = event.payload;
    const plan = await step.do("plan", () => this.agent.planTick(tickId, away, awayMs));
    if (!plan.events.length) return { tickId, skipped: true };
    const committed = await step.do("commit", () => this.agent.commitTick(tickId));
    await step.do("publish", () => this.agent.attachTickNarration(tickId, JSON.stringify(committed.facts.events)));
    return { tickId, events: plan.events.length };
  }
}
