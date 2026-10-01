import { routeAgentRequest } from "agents";
import { healthResponse } from "./health";

export { HauntedHouseAgent } from "./agent";
export { WorldTickWorkflow } from "./workflow";

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/health") return healthResponse(env);
    return (await routeAgentRequest(request, env)) ?? new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
