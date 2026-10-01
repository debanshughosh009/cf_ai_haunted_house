import { describe, it, expect, beforeEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { loadContent, type Content } from "../../src/engine/content";
import { createWorld, type World } from "../../src/engine/world";
import { isWinnable } from "../../src/engine/solver";

const CONTENT_FILE = path.resolve(__dirname, "../../content/house.json");

describe("Solver (BFS Winnability)", () => {
  let content: Content;
  let world: World;

  beforeEach(() => {
    content = loadContent(JSON.parse(fs.readFileSync(CONTENT_FILE, "utf-8")));
    world = createWorld(content, "solver-test-seed", 0);
  });

  it("determines that the initial world is winnable", () => {
    expect(isWinnable(world, content)).toBe(true);
  });

  it("detects when a constructed world is unwinnable (e.g. essential item deleted)", () => {
    // Destroy the winding key (move to void before winding music box)
    world.items["winding_key"] = { loc: { kind: "void" } };
    expect(isWinnable(world, content, 5000, 40)).toBe(false);
  });
});
