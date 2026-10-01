import { describe, it, expect, beforeEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { loadContent, type Content } from "../../src/engine/content";
import { createWorld, type World } from "../../src/engine/world";
import { parse } from "../../src/engine/parser";

const CONTENT_FILE = path.resolve(__dirname, "../../content/house.json");

describe("Parser (>= 60 cases)", () => {
  let content: Content;
  let world: World;

  beforeEach(() => {
    content = loadContent(JSON.parse(fs.readFileSync(CONTENT_FILE, "utf-8")));
    world = createWorld(content, "parser-seed", 0);
  });

  const testCases: Array<{ input: string; kind: "action" | "ambiguous" | "unknown"; expectedType?: string }> = [
    // 1-12: Movement and bare directions
    { input: "n", kind: "action", expectedType: "go" },
    { input: "north", kind: "action", expectedType: "go" },
    { input: "go north", kind: "action", expectedType: "go" },
    { input: "walk north", kind: "action", expectedType: "go" },
    { input: "head north", kind: "action", expectedType: "go" },
    { input: "move north", kind: "action", expectedType: "go" },
    { input: "s", kind: "action", expectedType: "go" },
    { input: "south", kind: "action", expectedType: "go" },
    { input: "east", kind: "action", expectedType: "go" },
    { input: "west", kind: "action", expectedType: "go" },
    { input: "up", kind: "action", expectedType: "go" },
    { input: "down", kind: "action", expectedType: "go" },

    // 13-20: Basic non-arg verbs
    { input: "look", kind: "action", expectedType: "look" },
    { input: "l", kind: "action", expectedType: "look" },
    { input: "inventory", kind: "action", expectedType: "inventory" },
    { input: "inv", kind: "action", expectedType: "inventory" },
    { input: "i", kind: "action", expectedType: "inventory" },
    { input: "wait", kind: "action", expectedType: "wait" },
    { input: "z", kind: "action", expectedType: "wait" },
    { input: "help", kind: "action", expectedType: "help" },

    // 21-28: Articles stripping & casing
    { input: "GO NORTH", kind: "action", expectedType: "go" },
    { input: "  go   north  ", kind: "action", expectedType: "go" },
    { input: "go to the north", kind: "action", expectedType: "go" },
    { input: "look around", kind: "action", expectedType: "look" },
    { input: "?", kind: "action", expectedType: "help" },
    { input: "", kind: "action", expectedType: "help" },
    { input: "   ", kind: "action", expectedType: "help" },
    { input: "new game", kind: "action", expectedType: "help" },

    // 29-38: Examine / Look at
    { input: "examine hale", kind: "action", expectedType: "examine" },
    { input: "x hale", kind: "action", expectedType: "examine" },
    { input: "inspect hale", kind: "action", expectedType: "examine" },
    { input: "look at hale", kind: "action", expectedType: "examine" },
    { input: "x the butler", kind: "action", expectedType: "examine" },
    { input: "examine chandelier", kind: "action", expectedType: "examine" },
    { input: "inspect the marble floor", kind: "action", expectedType: "examine" },
    { input: "x", kind: "unknown" },
    { input: "examine", kind: "unknown" },
    { input: "look at", kind: "unknown" },

    // 39-48: Take & Drop
    { input: "take matches", kind: "action", expectedType: "take" },
    { input: "pick up matches", kind: "action", expectedType: "take" },
    { input: "get matches", kind: "action", expectedType: "take" },
    { input: "grab matches", kind: "action", expectedType: "take" },
    { input: "take the matches", kind: "action", expectedType: "take" },
    { input: "take some matches", kind: "action", expectedType: "take" },
    { input: "take", kind: "unknown" },
    { input: "pick up", kind: "unknown" },
    { input: "drop matches", kind: "action", expectedType: "drop" },
    { input: "drop", kind: "unknown" },

    // 49-56: Open & Light
    { input: "open bookshelf", kind: "action", expectedType: "open" },
    { input: "open the bookshelf", kind: "action", expectedType: "open" },
    { input: "open the bookcase", kind: "action", expectedType: "open" },
    { input: "open trunk", kind: "action", expectedType: "open" },
    { input: "open", kind: "unknown" },
    { input: "light candle", kind: "action", expectedType: "light" },
    { input: "light the candle", kind: "action", expectedType: "light" },
    { input: "light", kind: "unknown" },

    // 57-66: Use, Give, Place, Talk
    { input: "wind music box", kind: "action", expectedType: "use" },
    { input: "use matches on candle", kind: "action", expectedType: "use" },
    { input: "use winding key with music box", kind: "action", expectedType: "use" },
    { input: "use salt", kind: "action", expectedType: "use" },
    { input: "give journal page to hale", kind: "action", expectedType: "give" },
    { input: "offer journal page to hale", kind: "action", expectedType: "give" },
    { input: "place silver locket on coffin", kind: "action", expectedType: "place" },
    { input: "put locket in coffin", kind: "action", expectedType: "place" },
    { input: "talk to hale", kind: "action", expectedType: "talk" },
    { input: "speak to hale about crypt", kind: "action", expectedType: "talk" },
    { input: "ask hale about eleanor", kind: "action", expectedType: "talk" },
    { input: "gibberish foobar123 baz", kind: "unknown" },
  ];

  testCases.forEach(({ input, kind, expectedType }, idx) => {
    it(`Case ${idx + 1}: parses "${input}" as ${kind}${expectedType ? ` (${expectedType})` : ""}`, () => {
      // Put matches, candle in inventory for test resolution where relevant
      world.items["matches"] = { loc: { kind: "inventory" } };
      world.items["candle"] = { loc: { kind: "inventory" } };
      world.items["journal_page"] = { loc: { kind: "inventory" } };
      world.items["winding_key"] = { loc: { kind: "inventory" } };
      world.items["silver_locket"] = { loc: { kind: "inventory" } };

      const res = parse(input, world, content);
      expect(res.kind).toBe(kind);
      if (res.kind === "action" && expectedType) {
        expect(res.action.type).toBe(expectedType);
      }
    });
  });

  it("handles entity ambiguity when multiple items match a word", () => {
    // Both iron_key and winding_key in room
    world.items["iron_key"] = { loc: { kind: "room", room: "foyer" } };
    world.items["winding_key"] = { loc: { kind: "room", room: "foyer" } };

    const res = parse("take key", world, content);
    expect(res.kind).toBe("ambiguous");
    if (res.kind === "ambiguous") {
      expect(res.options.length).toBeGreaterThan(1);
    }
  });
});
