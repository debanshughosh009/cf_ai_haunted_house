import { describe, it, expect, beforeEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { loadContent, type Content } from "../../src/engine/content";
import { createWorld, type World } from "../../src/engine/world";
import { project } from "../../src/engine/projection";

const CONTENT_FILE = path.resolve(__dirname, "../../content/house.json");

describe("Projection", () => {
  let content: Content;
  let world: World;

  beforeEach(() => {
    content = loadContent(JSON.parse(fs.readFileSync(CONTENT_FILE, "utf-8")));
    world = createWorld(content, "projection-seed", 0);
  });

  it("never contains hidden item locations or uncollected items in distant rooms", () => {
    // Player is in foyer
    const view = project(world, content);
    const serialized = JSON.stringify(view);

    // Items not in foyer: candle, matches, salt, journal_page, iron_key, music_box, winding_key, silver_locket
    // None of their IDs or descriptions of their locations should be present in PublicView
    expect(serialized).not.toContain("kitchen");
    expect(serialized).not.toContain("cellar");
    expect(serialized).not.toContain("attic");
    expect(serialized).not.toContain("conservatory");
    expect(serialized).not.toContain("silver_locket");
    expect(serialized).not.toContain("journal_page");
    expect(serialized).not.toContain("music_box");
  });

  it("never leaks raw mood numbers or flags into PublicView", () => {
    world.flags["candle_lit"] = true;
    world.flags["crypt_unlocked"] = true;
    world.npcs["hale"]!.mood = 45;

    const view = project(world, content);
    const serialized = JSON.stringify(view);

    expect(serialized).not.toContain("candle_lit");
    expect(serialized).not.toContain("crypt_unlocked");
    // Raw number 45 should not appear for mood
    expect((view.npcsHere[0] as any)?.mood).toBeUndefined();
    expect(view.npcsHere[0]?.moodLabel).toBe("warm");
  });
});
