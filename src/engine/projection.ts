// Projection — World → PublicView
// Projects authoritative server state into client-safe view.
// Hidden data (seed, flags, raw mood, unseen item locations) NEVER leaks.
import type { Content } from "./content";
import type { World } from "./world";
import type { PublicView, Direction } from "../shared/types";
import { moodToLabel } from "./mood";
import { isDark, hasLight } from "./validate";

export function project(
  world: World,
  content: Content,
  options?: {
    gameId?: string;
    previousRoom?: string;
    awayDigest?: Array<{ tickId: string; text: string; at: number }>;
    pendingTick?: boolean;
    knownNpcIds?: string[];
  }
): PublicView {
  const roomDef = content.rooms[world.player.room];
  const dark = isDark(world, content);

  // Visible items
  const visibleItems: Array<{ id: string; name: string }> = [];
  if (!dark && roomDef) {
    // Loose items
    for (const [id, itemState] of Object.entries(world.items)) {
      if (itemState.loc.kind === "room" && itemState.loc.room === world.player.room) {
        const itemDef = content.items[id];
        if (itemDef) {
          visibleItems.push({ id, name: itemDef.name });
        }
      }
    }
    // Items in open containers
    for (const [fixtureId, fixture] of Object.entries(roomDef.fixtures)) {
      const key = `${world.player.room}:${fixtureId}`;
      if (world.containers[key]?.open && fixture.container) {
        for (const [id, itemState] of Object.entries(world.items)) {
          if (
            itemState.loc.kind === "container" &&
            itemState.loc.room === world.player.room &&
            itemState.loc.fixture === fixtureId
          ) {
            const itemDef = content.items[id];
            if (itemDef) {
              visibleItems.push({ id, name: itemDef.name });
            }
          }
        }
      }
    }
  }

  // Inventory
  const inventory: Array<{ id: string; name: string; lit?: boolean }> = [];
  let litLight: { lit: boolean; turnsLeft?: number } = { lit: false };

  for (const [id, itemState] of Object.entries(world.items)) {
    if (itemState.loc.kind === "inventory") {
      const itemDef = content.items[id];
      if (itemDef) {
        inventory.push({
          id,
          name: itemDef.name,
          lit: itemState.lit,
        });
      }
      if (itemState.lit) {
        litLight = {
          lit: true,
          turnsLeft: itemState.litTurnsLeft,
        };
      }
    }
  }

  // Exits
  const exits: Array<{ dir: Direction; label: string; locked: boolean }> = [];
  if (roomDef) {
    for (const [dirStr, exit] of Object.entries(roomDef.exits)) {
      const dir = dirStr as Direction;

      // In the dark without light, only show the exit that leads back (e.g. up from cellar)
      if (dark) {
        const leadsBack =
          dir === "up" || (options?.previousRoom && exit.to === options.previousRoom);
        if (!leadsBack) continue;
      }

      let locked = false;
      if (exit.lockedBy) {
        const hasKey = world.items[exit.lockedBy]?.loc.kind === "inventory";
        const unlockedFlag = `${exit.to}_unlocked`;
        if (!hasKey && !world.flags[unlockedFlag]) {
          locked = true;
        }
      }
      if (exit.requiresFlag && !world.flags[exit.requiresFlag]) {
        locked = true;
      }

      const destRoom = content.rooms[exit.to];
      const label = destRoom ? `${dir} (${destRoom.name})` : dir;
      exits.push({ dir, label, locked });
    }
  }

  // NPCs here
  const npcsHere: Array<{ id: string; name: string; moodLabel: ReturnType<typeof moodToLabel> }> =
    [];
  for (const [id, npcState] of Object.entries(world.npcs)) {
    if (npcState.room === world.player.room) {
      const npcDef = content.npcs[id];
      if (npcDef) {
        npcsHere.push({
          id,
          name: npcDef.name,
          moodLabel: moodToLabel(npcState.mood),
        });
      }
    }
  }

  // Known NPCs (met in this session / tracked)
  const knownNpcs: Array<{ id: string; name: string; moodLabel: ReturnType<typeof moodToLabel> }> =
    [];
  for (const [id, npcState] of Object.entries(world.npcs)) {
    const isMet =
      (options?.knownNpcIds && options.knownNpcIds.includes(id)) ||
      npcState.room === world.player.room;
    if (isMet) {
      const npcDef = content.npcs[id];
      if (npcDef) {
        knownNpcs.push({
          id,
          name: npcDef.name,
          moodLabel: moodToLabel(npcState.mood),
        });
      }
    }
  }

  return {
    gameId: options?.gameId ?? world.seed,
    turn: world.turn,
    won: world.won,
    room: {
      id: world.player.room,
      name: roomDef?.name ?? "Unknown Room",
      dark,
    },
    exits,
    visibleItems,
    inventory,
    npcsHere,
    knownNpcs,
    light: litLight,
    awayDigest: options?.awayDigest ?? [],
    pendingTick: options?.pendingTick ?? false,
  };
}
