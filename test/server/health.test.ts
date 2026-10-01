import { describe, expect, it } from "vitest";
import { healthResponse } from "../../src/server/health";

describe("health response", () => {
  it("reports the configured model and mock mode", async () => {
    const response = healthResponse({
      LLM_MODEL: "test-model",
      MOCK_LLM: "1",
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      model: "test-model",
      mock: true,
    });
  });
});
