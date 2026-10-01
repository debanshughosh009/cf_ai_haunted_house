// Tick planner — planTick & applyTickPlan
// Pure TypeScript — no Cloudflare imports
import type { Content } from "./content";
import type { World } from "./world";
import type { GameEvent, ItemId, RoomId } from "../shared/types";
import { hashString, mulberry32, pickRandom, chance } from "./rng";
import { cloneWorld } from "./world";
import { isWinnable } from "./solver";

export interface TickOptions {
  tickId: string;
  tickIndex?: number;
  now: number;
  playerAway: boolean;
  awayMs: number;
  stealAwayMs?: number; // default 30 min = 1800000 ms, or dev 60000 ms
}

export interface TickPlan {
  tickId: string;
  events: GameEvent[];
  skipped: string[];
}

/** Get all adjacent rooms for a room */
function getAdjacentRooms(room: RoomId, content: Content): RoomId[] {
  const roomDef = content.rooms[room];
  if (!roomDef) return [];
  return Object.values(roomDef.exits).map((e) => e.to);
}

/** Check if room is available for ghost entry */
function canGhostEnter(room: RoomId, world: World, content: Content): boolean {
  if (world.salted.includes(room)) return false;
  const roomDef = content.rooms[room];
  if (roomDef?.ghostForbidden) return false;
  return true;
}

/**
 * Plan a world evolution tick deterministically.
 * Evaluates candidate events against a scratch world using isWinnable.
 * Does NOT mutate input world.
 */
export function planTick(
  world: World,
  content: Content,
  options: TickOptions
): TickPlan {
  const rng = mulberry32(hashString(`${world.seed}:${options.tickId}`));
  const events: GameEvent[] = [];
  const skipped: string[] = [];
  const scratch = cloneWorld(world);

  const STEAL_THRESHOLD_MS = options.stealAwayMs ?? 1800000; // 30 mins
  const eleanor = scratch.npcs["eleanor"];

  // 1. Ghost Wanders (always, unless at rest)
  if (eleanor && !scratch.flags["eleanor_at_rest"]) {
    const adjRooms = getAdjacentRooms(eleanor.room, content).filter((r) =>
      canGhostEnter(r, scratch, content)
    );
    if (adjRooms.length > 0) {
      const targetRoom = pickRandom(adjRooms, rng);
      if (targetRoom) {
        events.push({
          type: "ghost_moved",
          npc: "eleanor",
          from: eleanor.room,
          to: targetRoom,
        });
        eleanor.room = targetRoom;
      }
    }
  }

  // 2. Ghost Moves an Item (only if playerAway and mood < 0, p=0.5)
  if (
    options.playerAway &&
    eleanor &&
    eleanor.mood < 0 &&
    chance(0.5, rng)
  ) {
    // Find ghostMovable items loose in a non-salted room ≠ player room
    const candidateItemIds: ItemId[] = [];
    for (const [id, item] of Object.entries(scratch.items)) {
      const def = content.items[id];
      if (!def?.ghostMovable) continue;

      if (
        item.loc.kind === "room" &&
        item.loc.room !== scratch.player.room &&
        !scratch.salted.includes(item.loc.room)
      ) {
        candidateItemIds.push(id);
      }
    }

    if (candidateItemIds.length > 0) {
      const itemId = pickRandom(candidateItemIds, rng);
      if (itemId) {
        const currentLoc = scratch.items[itemId]!.loc;
        if (currentLoc.kind === "room") {
          const adj = getAdjacentRooms(currentLoc.room, content).filter((r) =>
            canGhostEnter(r, scratch, content)
          );
          if (adj.length > 0) {
            const destRoom = pickRandom(adj, rng);
            if (destRoom) {
              const testWorld = cloneWorld(scratch);
              testWorld.items[itemId]!.loc = { kind: "room", room: destRoom };
              if (isWinnable(testWorld, content)) {
                events.push({
                  type: "ghost_moved_item",
                  item: itemId,
                  from: currentLoc.room,
                  to: destRoom,
                });
                scratch.items[itemId]!.loc = { kind: "room", room: destRoom };
              } else {
                skipped.push(`ghost_move_item_${itemId}_unwinnable`);
              }
            }
          }
        }
      }
    }
  }

  // 3. Ghost Steals (playerAway, awayMs >= threshold, mood <= -50, stolenToday.count === 0, p=0.3)
  const todayKey = new Date(options.now).toISOString().split("T")[0]!;
  if (scratch.stolenToday.dayKey !== todayKey) {
    scratch.stolenToday = { dayKey: todayKey, count: 0 };
  }

  if (
    options.playerAway &&
    options.awayMs >= STEAL_THRESHOLD_MS &&
    eleanor &&
    eleanor.mood <= -50 &&
    scratch.stolenToday.count === 0 &&
    chance(0.3, rng)
  ) {
    // Steal one ghostStealable item from player's inventory
    const stealableIds: ItemId[] = [];
    for (const [id, item] of Object.entries(scratch.items)) {
      const def = content.items[id];
      if (def?.ghostStealable && item.loc.kind === "inventory") {
        stealableIds.push(id);
      }
    }

    if (stealableIds.length > 0) {
      const stealId = pickRandom(stealableIds, rng);
      if (stealId) {
        // Drop in random non-salted, non-forbidden room
        const validRooms = Object.keys(content.rooms).filter((r) =>
          canGhostEnter(r, scratch, content)
        );
        if (validRooms.length > 0) {
          const dropRoom = pickRandom(validRooms, rng);
          if (dropRoom) {
            const testWorld = cloneWorld(scratch);
            testWorld.items[stealId]!.loc = { kind: "room", room: dropRoom };
            testWorld.stolenToday.count += 1;
            if (isWinnable(testWorld, content)) {
              events.push({
                type: "ghost_stole_item",
                item: stealId,
                droppedIn: dropRoom,
              });
              scratch.items[stealId]!.loc = { kind: "room", room: dropRoom };
              scratch.stolenToday.count += 1;
            } else {
              skipped.push(`ghost_steal_${stealId}_unwinnable`);
            }
          }
        }
      }
    }
  }

  // 4. Mood drift (if away, Eleanor mood drifts 5 toward -40)
  if (options.playerAway && eleanor && !scratch.flags["eleanor_at_rest"]) {
    const targetMood = -40;
    if (eleanor.mood !== targetMood) {
      const oldMood = eleanor.mood;
      if (eleanor.mood < targetMood) {
        eleanor.mood = Math.min(targetMood, eleanor.mood + 5);
      } else {
        eleanor.mood = Math.max(targetMood, eleanor.mood - 5);
      }
      events.push({
        type: "npc_mood_changed",
        npc: "eleanor",
        from: oldMood,
        to: eleanor.mood,
      });
    }
  }

  // 5. Candle burns down (if lit and away)
  if (options.playerAway) {
    for (const [id, item] of Object.entries(scratch.items)) {
      if (item.lit && item.litTurnsLeft !== undefined) {
        item.litTurnsLeft -= 2;
        if (item.litTurnsLeft <= 0) {
          item.lit = false;
          item.litTurnsLeft = undefined;
          if (id === "candle") {
            scratch.flags["candle_lit"] = false;
          }
          events.push({ type: "light_out", item: id });
        }
      }
    }
  }

  return {
    tickId: options.tickId,
    events,
    skipped,
  };
}

/**
 * Apply a planned tick to a world, verifying freshness of events.
 * Drops stale events (e.g. player picked up item after plan).
 * Returns { world, committedEvents }.
 */
export function applyTickPlan(
  world: World,
  plan: TickPlan
): { world: World; events: GameEvent[] } {
  const w = cloneWorld(world);
  const committed: GameEvent[] = [];

  for (const event of plan.events) {
    switch (event.type) {
      case "ghost_moved": {
        const npc = w.npcs[event.npc];
        if (npc) {
          npc.room = event.to;
          committed.push(event);
        }
        break;
      }
      case "ghost_moved_item": {
        const item = w.items[event.item];
        // Only valid if item is still in expected `from` room
        if (item && item.loc.kind === "room" && item.loc.room === event.from) {
          item.loc = { kind: "room", room: event.to };
          committed.push(event);
        }
        break;
      }
      case "ghost_stole_item": {
        const item = w.items[event.item];
        // Only valid if item is still in inventory
        if (item && item.loc.kind === "inventory") {
          item.loc = { kind: "room", room: event.droppedIn };
          w.stolenToday.count += 1;
          committed.push(event);
        }
        break;
      }
      case "npc_mood_changed": {
        const npc = w.npcs[event.npc];
        if (npc) {
          npc.mood = event.to;
          committed.push(event);
        }
        break;
      }
      case "light_out": {
        const item = w.items[event.item];
        if (item && item.lit) {
          item.lit = false;
          item.litTurnsLeft = undefined;
          if (event.item === "candle") {
            w.flags["candle_lit"] = false;
          }
          committed.push(event);
        }
        break;
      }
    }
  }

  return { world: w, events: committed };
}
