import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { loadContent } from "../../src/engine/content";
import { createWorld, type World } from "../../src/engine/world";
import { parse } from "../../src/engine/parser";
import { validate } from "../../src/engine/validate";
import { apply } from "../../src/engine/apply";
import { mulberry32, pickRandom } from "../../src/engine/rng";

const CONTENT_FILE = path.resolve(__dirname, "../../content/house.json");

describe("Engine Property Invariants (Random Walker)", () => {
  it("maintains core invariants across random valid action sequences", () => {
    const raw = JSON.parse(fs.readFileSync(CONTENT_FILE, "utf-8"));
    const content = loadContent(raw);
    const rng = mulberry32(123456);

    for (let run = 0; run < 10; run++) {
      let world = createWorld(content, `prop-seed-${run}`, 0);

      const candidateCommands = [
        "go north",
        "go south",
        "go east",
        "go west",
        "go up",
        "go down",
        "look",
        "inventory",
        "wait",
        "take matches",
        "take candle",
        "take salt",
        "drop salt",
        "light candle",
        "talk to hale",
        "talk to eleanor",
        "open bookshelf",
        "take journal page",
      ];

      for (let step = 0; step < 30; step++) {
        const cmd = pickRandom(candidateCommands, rng)!;
        const parsed = parse(cmd, world, content);
        if (parsed.kind === "action") {
          const val = validate(world, content, parsed.action);
          if (val.ok) {
            const res = apply(world, content, parsed.action, step * 1000);
            world = res.world;
          }
        }

        // Invariant 1: Player room must exist
        expect(content.rooms[world.player.room]).toBeDefined();

        // Invariant 2: Items exist in exactly one location
        for (const [id, item] of Object.entries(world.items)) {
          expect(item.loc).toBeDefined();
          if (item.loc.kind === "inventory") {
            expect(content.items[id]?.takeable).toBe(true);
          }
        }

        // Invariant 3: NPC moods remain in [-100, 100]
        for (const [id, npc] of Object.entries(world.npcs)) {
          expect(npc.mood).toBeGreaterThanOrEqual(-100);
          expect(npc.mood).toBeLessThanOrEqual(100);
          expect(content.rooms[npc.room]).toBeDefined();
        }

        // Invariant 4: World JSON round-trips without loss
        const jsonStr = JSON.stringify(world);
        const parsedWorld: World = JSON.parse(jsonStr);
        expect(parsedWorld.version).toBe(world.version);
        expect(parsedWorld.turn).toBe(world.turn);
      }
    }
  });
});
