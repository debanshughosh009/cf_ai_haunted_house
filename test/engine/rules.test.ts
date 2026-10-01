import { describe, it, expect, beforeEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { loadContent, type Content } from "../../src/engine/content";
import { createWorld, type World } from "../../src/engine/world";
import { validate } from "../../src/engine/validate";
import { apply } from "../../src/engine/apply";

const CONTENT_FILE = path.resolve(__dirname, "../../content/house.json");

describe("Engine Rules & Validation", () => {
  let content: Content;
  let world: World;

  beforeEach(() => {
    content = loadContent(JSON.parse(fs.readFileSync(CONTENT_FILE, "utf-8")));
    world = createWorld(content, "rules-seed", 0);
  });

  it("handles NO_EXIT when walking into a wall", () => {
    const val = validate(world, content, { type: "go", dir: "south" });
    expect(val.ok).toBe(false);
    if (!val.ok) {
      expect(val.code).toBe("NO_EXIT");
    }
  });

  it("handles LOCKED when entering cellar without lit candle", () => {
    world.player.room = "kitchen";
    const val = validate(world, content, { type: "go", dir: "down" });
    expect(val.ok).toBe(false);
    if (!val.ok) {
      expect(val.code).toBe("LOCKED");
      expect(val.reason).toContain("cellar stairs");
    }
  });

  it("handles LOCKED when entering crypt without iron key", () => {
    world.player.room = "cellar";
    world.items["candle"] = { loc: { kind: "inventory" }, lit: true, litTurnsLeft: 20 };
    const val = validate(world, content, { type: "go", dir: "north" });
    expect(val.ok).toBe(false);
    if (!val.ok) {
      expect(val.code).toBe("LOCKED");
      expect(val.reason).toContain("answers only to iron");
    }
  });

  it("handles NOT_HERE when taking an item not in room", () => {
    const val = validate(world, content, { type: "take", item: "candle" });
    expect(val.ok).toBe(false);
    if (!val.ok) {
      expect(val.code).toBe("NOT_HERE");
    }
  });

  it("handles ALREADY_DONE when taking an item already in inventory", () => {
    world.items["matches"] = { loc: { kind: "inventory" } };
    const val = validate(world, content, { type: "take", item: "matches" });
    expect(val.ok).toBe(false);
    if (!val.ok) {
      expect(val.code).toBe("ALREADY_DONE");
    }
  });

  it("handles NOT_HELD when dropping an item not in inventory", () => {
    const val = validate(world, content, { type: "drop", item: "matches" });
    expect(val.ok).toBe(false);
    if (!val.ok) {
      expect(val.code).toBe("NOT_HELD");
    }
  });

  it("handles TOO_DARK in unlit cellar", () => {
    world.player.room = "cellar";
    const val = validate(world, content, { type: "examine", target: "gate" });
    expect(val.ok).toBe(false);
    if (!val.ok) {
      expect(val.code).toBe("TOO_DARK");
    }
  });

  it("handles GAME_OVER when game is already won", () => {
    world.won = true;
    const val = validate(world, content, { type: "look" });
    expect(val.ok).toBe(false);
    if (!val.ok) {
      expect(val.code).toBe("GAME_OVER");
    }
  });

  it("handles ALREADY_DONE when salting an already salted room", () => {
    world.items["salt"] = { loc: { kind: "inventory" } };
    const res1 = apply(world, content, { type: "use", item: "salt" }, 1000);
    expect(res1.events.some((e) => e.type === "room_salted")).toBe(true);

    const res2 = apply(res1.world, content, { type: "use", item: "salt" }, 2000);
    expect(res2.events.some((e) => e.type === "action_failed" && e.code === "ALREADY_DONE")).toBe(true);
  });

  it("reduces Eleanor mood by 5 if player takes a ghostMovable item while Eleanor is present", () => {
    world.player.room = "nursery";
    world.npcs["eleanor"]!.room = "nursery";
    world.npcs["eleanor"]!.mood = -40;
    world.items["music_box"] = { loc: { kind: "room", room: "nursery" } };

    const res = apply(world, content, { type: "take", item: "music_box" }, 1000);
    expect(res.world.npcs["eleanor"]!.mood).toBe(-45);
    expect(res.events.some((e) => e.type === "npc_mood_changed")).toBe(true);
  });
});
