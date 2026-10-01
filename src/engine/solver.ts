// Solver — winnability check (BFS over abstract game states)
// Pure TypeScript — no Cloudflare imports
import type { Content } from "./content";
import type { World } from "./world";
import type { Action, Direction } from "../shared/types";
import { validate } from "./validate";
import { apply } from "./apply";
import { cloneWorld, containerKey } from "./world";

/** Generate a compact hash key for an abstract world state */
function hashWorld(w: World): string {
  const itemParts: string[] = [];
  for (const [id, item] of Object.entries(w.items)) {
    const loc = item.loc;
    let locStr = loc.kind;
    if (loc.kind === "room") locStr += `:${loc.room}`;
    else if (loc.kind === "container") locStr += `:${loc.room}:${loc.fixture}`;
    else if (loc.kind === "npc") locStr += `:${loc.npc}`;
    itemParts.push(`${id}=${locStr}${item.lit ? ":lit" : ""}`);
  }
  itemParts.sort();

  const containerParts = Object.entries(w.containers)
    .filter(([_, c]) => c.open)
    .map(([k]) => k)
    .sort()
    .join(",");

  const flagParts = Object.entries(w.flags)
    .filter(([_, v]) => v)
    .map(([k]) => k)
    .sort()
    .join(",");

  const npcParts = Object.entries(w.npcs)
    .map(([id, n]) => `${id}@${n.room}:${Math.floor(n.mood / 10)}`)
    .sort()
    .join(";");

  return `${w.player.room}|${itemParts.join(";")}|${containerParts}|${flagParts}|${npcParts}`;
}

/** Generate candidate meaningful actions from content and current state */
function getCandidateActions(w: World, content: Content): Action[] {
  const actions: Action[] = [];
  const room = content.rooms[w.player.room];
  if (!room) return actions;

  // 1. Use / Place / Give interactions (highest priority)
  for (const interaction of content.interactions) {
    if (interaction.room && interaction.room !== w.player.room) continue;

    if (interaction.verb === "use") {
      const subjectHeld = w.items[interaction.subject]?.loc.kind === "inventory";
      if (subjectHeld) {
        actions.push({
          type: "use",
          item: interaction.subject,
          target: interaction.target,
        });
      }
    } else if (interaction.verb === "give" && interaction.target) {
      const subjectHeld = w.items[interaction.subject]?.loc.kind === "inventory";
      const npcInRoom = w.npcs[interaction.target]?.room === w.player.room;
      if (subjectHeld && npcInRoom) {
        actions.push({
          type: "give",
          item: interaction.subject,
          npc: interaction.target,
        });
      }
    } else if (interaction.verb === "place" && interaction.target) {
      const subjectHeld = w.items[interaction.subject]?.loc.kind === "inventory";
      if (subjectHeld) {
        actions.push({
          type: "place",
          item: interaction.subject,
          target: interaction.target,
        });
      }
    }
  }

  // 2. Light candle if held and matches held
  if (
    w.items["candle"]?.loc.kind === "inventory" &&
    !w.items["candle"]?.lit &&
    w.items["matches"]?.loc.kind === "inventory"
  ) {
    actions.push({ type: "light", item: "candle" });
  }

  // 3. Open fixtures
  for (const [fixtureId, fixture] of Object.entries(room.fixtures)) {
    if (fixture.container?.openable) {
      const key = containerKey(w.player.room, fixtureId);
      if (!w.containers[key]?.open) {
        actions.push({ type: "open", fixture: fixtureId, room: w.player.room });
      }
    }
  }

  // 4. Take visible items
  for (const [id, itemState] of Object.entries(w.items)) {
    if (
      (itemState.loc.kind === "room" && itemState.loc.room === w.player.room) ||
      (itemState.loc.kind === "container" &&
        itemState.loc.room === w.player.room &&
        w.containers[containerKey(w.player.room, itemState.loc.fixture)]?.open)
    ) {
      const itemDef = content.items[id];
      if (itemDef?.takeable) {
        actions.push({ type: "take", item: id });
      }
    }
  }

  // 5. Movement
  for (const dir of Object.keys(room.exits) as Direction[]) {
    actions.push({ type: "go", dir });
  }

  return actions;
}

/** Check if the world is currently winnable via BFS */
export function isWinnable(
  initialWorld: World,
  content: Content,
  maxStates = 20000,
  maxDepth = 80
): boolean {
  if (initialWorld.won) return true;

  const queue: Array<{ world: World; depth: number }> = [
    { world: cloneWorld(initialWorld), depth: 0 },
  ];
  const visited = new Set<string>();
  visited.add(hashWorld(initialWorld));

  let explored = 0;

  while (queue.length > 0) {
    const current = queue.shift()!;
    explored += 1;

    if (current.world.won) return true;
    if (current.depth >= maxDepth) continue;
    if (explored >= maxStates) break;

    const candidates = getCandidateActions(current.world, content);

    for (const action of candidates) {
      const val = validate(current.world, content, action);
      if (!val.ok) continue;

      const next = apply(current.world, content, action, 0);
      if (next.world.won) return true;

      const hash = hashWorld(next.world);
      if (!visited.has(hash)) {
        visited.add(hash);
        queue.push({ world: next.world, depth: current.depth + 1 });
      }
    }
  }

  return false;
}
