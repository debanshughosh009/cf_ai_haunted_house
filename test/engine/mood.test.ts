import { describe, it, expect, beforeEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { loadContent, type Content } from "../../src/engine/content";
import { createWorld, type World } from "../../src/engine/world";
import { moodToLabel, clampMood, applyMoodDelta } from "../../src/engine/mood";
import { selectHint } from "../../src/engine/hints";
import { apply } from "../../src/engine/apply";

const CONTENT_FILE = path.resolve(__dirname, "../../content/house.json");

describe("Mood & Hints", () => {
  let content: Content;
  let world: World;

  beforeEach(() => {
    content = loadContent(JSON.parse(fs.readFileSync(CONTENT_FILE, "utf-8")));
    world = createWorld(content, "mood-seed", 0);
  });

  it("maps mood numbers to exact labels per §5.5", () => {
    expect(moodToLabel(-100)).toBe("furious");
    expect(moodToLabel(-60)).toBe("furious");
    expect(moodToLabel(-59)).toBe("hostile");
    expect(moodToLabel(-20)).toBe("hostile");
    expect(moodToLabel(-19)).toBe("wary");
    expect(moodToLabel(0)).toBe("wary");
    expect(moodToLabel(19)).toBe("wary");
    expect(moodToLabel(20)).toBe("warm");
    expect(moodToLabel(59)).toBe("warm");
    expect(moodToLabel(60)).toBe("devoted");
    expect(moodToLabel(100)).toBe("devoted");
  });

  it("clamps mood accurately to [-100, 100]", () => {
    expect(clampMood(-150)).toBe(-100);
    expect(clampMood(150)).toBe(100);
    expect(applyMoodDelta(90, 20)).toBe(100);
    expect(applyMoodDelta(-90, -20)).toBe(-100);
  });

  it("applies topic mood deltas only once for once=true topics", () => {
    // Talk to Hale about crypt (moodDelta +5, once: true)
    const initialMood = world.npcs["hale"]!.mood;
    const res1 = apply(world, content, { type: "talk", npc: "hale", topic: "crypt" }, 1000);
    expect(res1.world.npcs["hale"]!.mood).toBe(initialMood + 5);
    expect(res1.world.npcs["hale"]!.topicsUsed).toContain("crypt");

    // Repeat conversation
    const res2 = apply(res1.world, content, { type: "talk", npc: "hale", topic: "crypt" }, 2000);
    expect(res2.world.npcs["hale"]!.mood).toBe(initialMood + 5);
  });

  it("selects correct hint according to mood and flags", () => {
    const haleDef = content.npcs["hale"]!;
    const npcState = { mood: 0, lastHintId: undefined };

    // At mood 0: h_hale_1
    const hint1 = selectHint(haleDef, npcState, {});
    expect(hint1?.id).toBe("h_hale_1");

    // At mood 25: h_hale_2
    npcState.mood = 25;
    const hint2 = selectHint(haleDef, npcState, {});
    expect(hint2?.id).toBe("h_hale_2");

    // At mood 35 without hale_trusts flag: still h_hale_2
    npcState.mood = 35;
    const hint3 = selectHint(haleDef, npcState, {});
    expect(hint3?.id).toBe("h_hale_2");

    // At mood 35 with hale_trusts flag: h_hale_3
    const hint4 = selectHint(haleDef, npcState, { hale_trusts: true });
    expect(hint4?.id).toBe("h_hale_3");
  });
});
