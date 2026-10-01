// World — runtime mutable state, pure TypeScript
import type { Content } from "./content";
import type {
  RoomId,
  ItemId,
  FixtureId,
  NpcId,
  FlagId,
  HintId,
  Location,
} from "../shared/types";

export interface World {
  schemaVersion: 1;
  seed: string;
  version: number;
  turn: number;
  player: { room: RoomId };
  items: Record<
    ItemId,
    { loc: Location; lit?: boolean; litTurnsLeft?: number }
  >;
  containers: Record<string, { open: boolean }>; // key = "roomId:fixtureId"
  npcs: Record<
    NpcId,
    {
      room: RoomId;
      mood: number;
      topicsUsed: string[];
      lastHintId?: HintId;
    }
  >;
  flags: Record<FlagId, boolean>;
  salted: RoomId[];
  stolenToday: { dayKey: string; count: number };
  lastSeenAt: number;
  won: boolean;
}

/** Container key helper */
export function containerKey(
  room: RoomId,
  fixture: FixtureId
): string {
  return `${room}:${fixture}`;
}

/** Create a fresh world from content */
export function createWorld(content: Content, seed: string): World {
  const items: World["items"] = {};
  const containers: World["containers"] = {};
  const npcs: World["npcs"] = {};

  // Place items at their starting locations
  for (const [id, item] of Object.entries(content.items)) {
    // Items start in rooms, containers, or with NPCs
    // Check rooms first
    let placed = false;
    for (const [roomId, room] of Object.entries(content.rooms)) {
      if (room.items.includes(id)) {
        items[id] = { loc: { kind: "room", room: roomId } };
        placed = true;
        break;
      }
      // Check fixtures/containers in this room
      for (const [fixtureId, fixture] of Object.entries(room.fixtures)) {
        if (fixture.container?.contents.includes(id)) {
          items[id] = {
            loc: { kind: "container", room: roomId, fixture: fixtureId },
          };
          placed = true;
          break;
        }
      }
      if (placed) break;
    }
    // Check NPC possession
    if (!placed) {
      for (const [npcId, npc] of Object.entries(content.npcs)) {
        // Convention: if not found in rooms/containers, NPC items are specified
        // by checking interactions with npcGives effects
        // For iron_key: starts with hale (location npc:hale)
      }
    }
    if (!placed) {
      // Default: void (shouldn't happen with valid content)
      items[id] = { loc: { kind: "void" } };
    }
  }

  // Special: iron_key starts with Hale
  if (items["iron_key"]) {
    items["iron_key"] = { loc: { kind: "npc", npc: "hale" } };
  }

  // Initialize containers
  for (const [roomId, room] of Object.entries(content.rooms)) {
    for (const [fixtureId, fixture] of Object.entries(room.fixtures)) {
      if (fixture.container) {
        containers[containerKey(roomId, fixtureId)] = {
          open: fixture.container.startsOpen,
        };
      }
    }
  }

  // Initialize NPCs
  for (const [id, npc] of Object.entries(content.npcs)) {
    npcs[id] = {
      room: npc.startRoom,
      mood: npc.startMood,
      topicsUsed: [],
    };
  }

  return {
    schemaVersion: 1,
    seed,
    version: 0,
    turn: 0,
    player: { room: content.startRoom },
    items,
    containers,
    npcs,
    flags: {},
    salted: [],
    stolenToday: { dayKey: "", count: 0 },
    lastSeenAt: Date.now(),
    won: false,
  };
}

/** Deep clone a world for mutation */
export function cloneWorld(w: World): World {
  const items: World["items"] = {};
  for (const [k, v] of Object.entries(w.items)) {
    items[k] = { ...v, loc: { ...v.loc } };
  }
  const containers: World["containers"] = {};
  for (const [k, v] of Object.entries(w.containers)) {
    containers[k] = { ...v };
  }
  const npcs: World["npcs"] = {};
  for (const [k, v] of Object.entries(w.npcs)) {
    npcs[k] = { ...v, topicsUsed: [...v.topicsUsed] };
  }
  return {
    ...w,
    player: { ...w.player },
    items,
    containers,
    npcs,
    flags: { ...w.flags },
    salted: [...w.salted],
    stolenToday: { ...w.stolenToday },
  };
}
