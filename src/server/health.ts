export function healthResponse(env: Pick<Env, "LLM_MODEL" | "MOCK_LLM">): Response {
  return Response.json({
    ok: true,
    model: env.LLM_MODEL,
    mock: env.MOCK_LLM === "1",
  });
}
