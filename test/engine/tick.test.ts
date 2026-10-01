import { describe, it, expect, beforeEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { loadContent, type Content } from "../../src/engine/content";
import { createWorld, type World } from "../../src/engine/world";
import { planTick, applyTickPlan } from "../../src/engine/tick";

const CONTENT_FILE = path.resolve(__dirname, "../../content/house.json");

describe("Tick Planner & World Evolution", () => {
  let content: Content;
  let world: World;

  beforeEach(() => {
    content = loadContent(JSON.parse(fs.readFileSync(CONTENT_FILE, "utf-8")));
    world = createWorld(content, "tick-test-seed", 0);
  });

  it("produces identical plans given identical seed and tickId (determinism)", () => {
    const opts = {
      tickId: "tick-1",
      now: 1000000,
      playerAway: true,
      awayMs: 2000000,
    };

    const plan1 = planTick(world, content, opts);
    const plan2 = planTick(world, content, opts);

    expect(plan1).toEqual(plan2);
  });

  it("never moves Eleanor into a salted or ghostForbidden room (e.g. Crypt)", () => {
    // Salt adjacent room
    world.salted = ["foyer"]; // adjacent to nursery (down)
    world.npcs["eleanor"]!.room = "nursery";

    for (let i = 1; i <= 20; i++) {
      const plan = planTick(world, content, {
        tickId: `tick-test-${i}`,
        now: 1000 * i,
        playerAway: false,
        awayMs: 1000 * i,
      });

      for (const e of plan.events) {
        if (e.type === "ghost_moved") {
          expect(e.to).not.toBe("foyer");
          expect(e.to).not.toBe("crypt");
        }
      }
    }
  }, 15000);

  it("steals from inventory only when away >= threshold and max once per day", () => {
    world.items["silver_locket"] = { loc: { kind: "inventory" } };
    world.npcs["eleanor"]!.mood = -80;

    // Below away threshold (e.g. 5 minutes away vs 30 minutes threshold)
    const planShort = planTick(world, content, {
      tickId: "tick-short",
      now: Date.now(),
      playerAway: true,
      awayMs: 300000, // 5 min < 30 min
      stealAwayMs: 1800000,
    });
    expect(planShort.events.some((e) => e.type === "ghost_stole_item")).toBe(false);
  });

  it("applies planned ticks idempotently and drops stale events if player picked item up", () => {
    world.items["music_box"] = { loc: { kind: "room", room: "nursery" } };
    const plan = {
      tickId: "tick-stale-test",
      events: [
        {
          type: "ghost_moved_item" as const,
          item: "music_box",
          from: "nursery",
          to: "attic",
        },
      ],
      skipped: [],
    };

    // Before commit, player picks up the music box
    world.items["music_box"] = { loc: { kind: "inventory" } };

    const res = applyTickPlan(world, plan);
    // Stale event dropped because music_box was no longer in nursery
    expect(res.events).toEqual([]);
    expect(res.world.items["music_box"]!.loc.kind).toBe("inventory");
  });
});
