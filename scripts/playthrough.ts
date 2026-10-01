// Canonical playthrough runner — scripts/playthrough.ts
import * as fs from "node:fs";
import * as path from "node:path";
import { loadContent } from "../src/engine/content";
import { createWorld } from "../src/engine/world";
import { parse } from "../src/engine/parser";
import { validate } from "../src/engine/validate";
import { apply } from "../src/engine/apply";
import { renderEventsParagraph } from "../src/engine/templates";

const CONTENT_FILE = path.resolve(import.meta.dirname, "../content/house.json");

export const WALKTHROUGH_COMMANDS = [
  "go north",
  "take matches",
  "open bookshelf",
  "take journal page",
  "go west",
  "take winding key",
  "go east",
  "go south",
  "give journal page to hale",
  "go east",
  "take candle",
  "light candle",
  "go west",
  "go up",
  "take music box",
  "wind music box",
  "go up",
  "open trunk",
  "take locket",
  "go down",
  "go down",
  "go east",
  "go down",
  "go north",
  "use music box",
  "place locket on coffin",
];

export function runWalkthrough(verbose = true) {
  const raw = JSON.parse(fs.readFileSync(CONTENT_FILE, "utf-8"));
  const content = loadContent(raw);
  let world = createWorld(content, "playthrough-seed", 0);

  if (verbose) console.log("🏰 Starting Canonical Walkthrough (26 steps)...\n");

  for (let i = 0; i < WALKTHROUGH_COMMANDS.length; i++) {
    const cmd = WALKTHROUGH_COMMANDS[i]!;
    const parseRes = parse(cmd, world, content);

    if (parseRes.kind !== "action") {
      console.error(`❌ Turn ${i + 1} ("${cmd}") failed to parse:`, parseRes);
      process.exit(1);
    }

    const val = validate(world, content, parseRes.action);
    if (!val.ok) {
      console.error(`❌ Turn ${i + 1} ("${cmd}") validation failed:`, val);
      process.exit(1);
    }

    const res = apply(world, content, parseRes.action, i * 1000);
    world = res.world;

    if (verbose) {
      const nar = renderEventsParagraph(res.events, content);
      console.log(`[Turn ${i + 1}] > ${cmd}`);
      console.log(`         ${nar}`);
    }
  }

  if (!world.won) {
    console.error("❌ Walkthrough completed but game was NOT won!");
    process.exit(1);
  }

  if (verbose) {
    console.log("\n🏆 VICTORY! Canonical playthrough completed successfully.");
  }

  return world;
}

if (process.argv[1]?.endsWith("playthrough.ts")) {
  runWalkthrough(true);
}
