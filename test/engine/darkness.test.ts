import { describe, it, expect, beforeEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { loadContent, type Content } from "../../src/engine/content";
import { createWorld, type World } from "../../src/engine/world";
import { isDark, hasLight, validate } from "../../src/engine/validate";
import { apply } from "../../src/engine/apply";
import { project } from "../../src/engine/projection";

const CONTENT_FILE = path.resolve(__dirname, "../../content/house.json");

describe("Darkness & Light", () => {
  let content: Content;
  let world: World;

  beforeEach(() => {
    content = loadContent(JSON.parse(fs.readFileSync(CONTENT_FILE, "utf-8")));
    world = createWorld(content, "light-seed", 0);
  });

  it("detects darkness in cellar without lit light source", () => {
    world.player.room = "cellar";
    expect(isDark(world, content)).toBe(true);
    expect(hasLight(world)).toBe(false);

    const view = project(world, content);
    expect(view.visibleItems).toEqual([]);
    // Only "up" exit is visible in the dark
    expect(view.exits.map((e) => e.dir)).toEqual(["up"]);
  });

  it("reveals room items and all exits when candle is lit", () => {
    world.player.room = "cellar";
    world.items["candle"] = {
      loc: { kind: "inventory" },
      lit: true,
      litTurnsLeft: 30,
    };

    expect(isDark(world, content)).toBe(false);
    expect(hasLight(world)).toBe(true);

    const view = project(world, content);
    expect(view.exits.length).toBe(2);
  });

  it("candle burns down by 1 each turn and extinguishes at 0", () => {
    world.items["candle"] = {
      loc: { kind: "inventory" },
      lit: true,
      litTurnsLeft: 2,
    };
    world.flags["candle_lit"] = true;

    const res1 = apply(world, content, { type: "wait" }, 1000);
    expect(res1.world.items["candle"]!.litTurnsLeft).toBe(1);
    expect(res1.world.items["candle"]!.lit).toBe(true);

    const res2 = apply(res1.world, content, { type: "wait" }, 2000);
    expect(res2.world.items["candle"]!.lit).toBe(false);
    expect(res2.world.flags["candle_lit"]).toBe(false);
    expect(res2.events.some((e) => e.type === "light_out")).toBe(true);
  });
});
