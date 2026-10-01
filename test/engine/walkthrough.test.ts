import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { loadContent } from "../../src/engine/content";
import { createWorld } from "../../src/engine/world";
import { parse } from "../../src/engine/parser";
import { validate } from "../../src/engine/validate";
import { apply } from "../../src/engine/apply";
import { WALKTHROUGH_COMMANDS } from "../../scripts/playthrough";

const CONTENT_FILE = path.resolve(__dirname, "../../content/house.json");

describe("Canonical Walkthrough", () => {
  it("plays all 26 turns and wins the game", () => {
    const raw = JSON.parse(fs.readFileSync(CONTENT_FILE, "utf-8"));
    const content = loadContent(raw);
    let world = createWorld(content, "test-walkthrough-seed", 0);

    const eventTypes: string[] = [];

    for (let i = 0; i < WALKTHROUGH_COMMANDS.length; i++) {
      const cmd = WALKTHROUGH_COMMANDS[i]!;
      const parseRes = parse(cmd, world, content);
      expect(parseRes.kind).toBe("action");
      if (parseRes.kind !== "action") return;

      const val = validate(world, content, parseRes.action);
      expect(val.ok).toBe(true);
      if (!val.ok) return;

      const res = apply(world, content, parseRes.action, i * 1000);
      world = res.world;
      eventTypes.push(...res.events.map((e) => e.type));
    }

    expect(world.won).toBe(true);
    expect(world.flags["eleanor_at_rest"]).toBe(true);
    expect(eventTypes).toContain("game_won");
  });
});
