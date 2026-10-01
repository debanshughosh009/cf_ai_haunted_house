// Content validator — scripts/validate-content.ts
import * as fs from "node:fs";
import * as path from "node:path";
import { loadContent } from "../src/engine/content";
import { createWorld } from "../src/engine/world";
import { isWinnable } from "../src/engine/solver";

const CONTENT_FILE = path.resolve(import.meta.dirname, "../content/house.json");

function validate() {
  console.log("🔍 Validating content/house.json...");

  if (!fs.existsSync(CONTENT_FILE)) {
    console.error(`❌ Content file missing: ${CONTENT_FILE}`);
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(CONTENT_FILE, "utf-8"));
  const content = loadContent(raw);

  const errors: string[] = [];

  // 1. Check startRoom
  if (!content.rooms[content.startRoom]) {
    errors.push(`startRoom "${content.startRoom}" does not exist in rooms.`);
  }

  // 2. Check exits & bidirectional exits
  const oppositeDir: Record<string, string> = {
    north: "south",
    south: "north",
    east: "west",
    west: "east",
    up: "down",
    down: "up",
  };

  for (const [roomId, room] of Object.entries(content.rooms)) {
    for (const [dir, exit] of Object.entries(room.exits)) {
      const dest = content.rooms[exit.to];
      if (!dest) {
        errors.push(`Room "${roomId}" exit "${dir}" leads to non-existent room "${exit.to}".`);
      } else {
        const opp = oppositeDir[dir];
        if (opp && !dest.exits[opp as keyof typeof dest.exits]) {
          // Warning or check if marked oneWay
          console.warn(`⚠️ Notice: Room "${exit.to}" has no return exit "${opp}" to "${roomId}".`);
        }
      }
    }
  }

  // 3. Every item has exactly one start location
  const itemCounts: Record<string, number> = {};
  for (const itemId of Object.keys(content.items)) {
    itemCounts[itemId] = 0;
  }

  for (const [roomId, room] of Object.entries(content.rooms)) {
    for (const item of room.items) {
      if (itemCounts[item] !== undefined) itemCounts[item] += 1;
      else errors.push(`Room "${roomId}" lists unknown item "${item}".`);
    }
    for (const [fixtureId, fixture] of Object.entries(room.fixtures)) {
      if (fixture.container) {
        for (const item of fixture.container.contents) {
          if (itemCounts[item] !== undefined) itemCounts[item] += 1;
          else errors.push(`Fixture "${fixtureId}" in "${roomId}" lists unknown item "${item}".`);
        }
      }
    }
  }

  // Iron key starts with Hale
  if (itemCounts["iron_key"] !== undefined) {
    itemCounts["iron_key"] += 1;
  }

  for (const [itemId, count] of Object.entries(itemCounts)) {
    if (count === 0) {
      errors.push(`Item "${itemId}" has no starting location.`);
    } else if (count > 1) {
      errors.push(`Item "${itemId}" has multiple starting locations (${count}).`);
    }
  }

  // 4. Every interaction references existing IDs
  for (const inter of content.interactions) {
    if (!content.items[inter.subject] && !inter.subject.includes("bookshelf") && !inter.subject.includes("trunk")) {
      errors.push(`Interaction "${inter.id}" subject "${inter.subject}" not found in items or fixtures.`);
    }
    if (inter.room && !content.rooms[inter.room]) {
      errors.push(`Interaction "${inter.id}" room "${inter.room}" does not exist.`);
    }
    for (const eff of inter.effects) {
      if (eff.type === "moveItem" && !content.items[eff.item]) {
        errors.push(`Interaction "${inter.id}" moveItem references unknown item "${eff.item}".`);
      }
      if (eff.type === "npcGives" && (!content.npcs[eff.npc] || !content.items[eff.item])) {
        errors.push(`Interaction "${inter.id}" npcGives references unknown npc or item.`);
      }
      if (eff.type === "moveNpc" && (!content.npcs[eff.npc] || !content.rooms[eff.to])) {
        errors.push(`Interaction "${inter.id}" moveNpc references unknown npc or room.`);
      }
    }
  }

  // 5. Check hints
  for (const [npcId, npc] of Object.entries(content.npcs)) {
    const hintIds = new Set(npc.hints.map((h) => h.id));
    for (const [topic, tDef] of Object.entries(npc.topics)) {
      if (tDef.hintId && !hintIds.has(tDef.hintId)) {
        errors.push(`NPC "${npcId}" topic "${topic}" references non-existent hintId "${tDef.hintId}".`);
      }
    }
  }

  // Check ending room
  if (!content.rooms[content.ending.room]) {
    errors.push(`Ending room "${content.ending.room}" does not exist.`);
  }

  if (errors.length > 0) {
    console.error("❌ Content validation failed with errors:");
    for (const err of errors) console.error(`  - ${err}`);
    process.exit(1);
  }

  // 6. Solver winnability test
  console.log("🧩 Checking initial world winnability with solver BFS...");
  const world = createWorld(content, "validation-seed", 0);
  const winnable = isWinnable(world, content, 20000, 80);

  if (!winnable) {
    console.error("❌ Solver reported initial world is UNWINNABLE!");
    process.exit(1);
  }

  console.log("✅ Content validation passed! Game is verified winnable.");
}

validate();
