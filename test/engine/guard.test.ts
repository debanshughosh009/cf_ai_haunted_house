import { describe, it, expect, beforeEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { loadContent, type Content } from "../../src/engine/content";
import { createWorld, type World } from "../../src/engine/world";
import { buildFacts } from "../../src/engine/facts";
import { guardNarration } from "../../src/engine/guard";

const CONTENT_FILE = path.resolve(__dirname, "../../content/house.json");

describe("Narration Guard", () => {
  let content: Content;
  let world: World;

  beforeEach(() => {
    content = loadContent(JSON.parse(fs.readFileSync(CONTENT_FILE, "utf-8")));
    world = createWorld(content, "guard-seed", 0);
  });

  it("passes truthful gothic narration that mentions only visible entities", () => {
    const facts = buildFacts("turn", [{ type: "looked", room: "foyer", description: "", items: [], npcs: ["Hale"], exits: ["north", "east", "up"] }], world, content);
    const narration = "You stand in the decaying foyer. Cobwebs drape from high overhead as Hale watches in silent stillness.";

    const res = guardNarration(narration, facts, content);
    expect(res.ok).toBe(true);
    expect(res.violations).toEqual([]);
  });

  it("catches invented / unseen item names (e.g. silver locket while in foyer)", () => {
    const facts = buildFacts("turn", [], world, content);
    const narration = "A silver locket gleams on the floor before you.";

    const res = guardNarration(narration, facts, content);
    expect(res.ok).toBe(false);
    expect(res.violations.some((v) => v.includes("silver locket"))).toBe(true);
  });

  it("catches fake exit directions (e.g. door to the south in the foyer)", () => {
    const facts = buildFacts("turn", [], world, content);
    const narration = "You notice a dark passage leading south into the gloom.";

    const res = guardNarration(narration, facts, content);
    expect(res.ok).toBe(false);
    expect(res.violations.some((v) => v.includes("south"))).toBe(true);
  });

  it("catches internal mechanics leaks: JSON, ID, FACTS", () => {
    const facts = buildFacts("turn", [], world, content);
    const narration = "According to the JSON FACTS with id item_1, the room is cold.";

    const res = guardNarration(narration, facts, content);
    expect(res.ok).toBe(false);
    expect(res.violations.some((v) => v.includes("mechanics"))).toBe(true);
  });

  it("catches numeric digits (mechanics leak)", () => {
    const facts = buildFacts("turn", [], world, content);
    const narration = "You have 30 turns left before darkness closes in.";

    const res = guardNarration(narration, facts, content);
    expect(res.ok).toBe(false);
    expect(res.violations.some((v) => v.includes("numeric digits"))).toBe(true);
  });

  it("catches false claims of success when an action failed", () => {
    const facts = buildFacts("turn", [{ type: "action_failed", reason: "You don't see that here.", code: "NOT_HERE" }], world, content);
    const narration = "You pick up the candle and place it safely in your bag.";

    const res = guardNarration(narration, facts, content);
    expect(res.ok).toBe(false);
    expect(res.violations.some((v) => v.includes("Claims action succeeded"))).toBe(true);
  });
});
