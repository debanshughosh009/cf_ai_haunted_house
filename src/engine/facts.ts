// Facts for the LLM — facts.ts
// Builds NarrationFacts: the ONLY world info that crosses into a prompt
import type { Content } from "./content";
import type { World } from "./world";
import type { GameEvent, NarrationFacts, HumanFact } from "../shared/types";
import { moodToLabel } from "./mood";
import { isDark } from "./validate";
import { renderEventTemplate } from "./templates";

export function buildFacts(
  kind: "turn" | "tick" | "digest" | "talk",
  events: GameEvent[],
  world: World,
  content: Content,
  playerCommand?: string
): NarrationFacts {
  const roomDef = content.rooms[world.player.room];
  const dark = isDark(world, content);

  // Visible items (only if not dark)
  const visibleItems: string[] = [];
  const allowedNamesSet = new Set<string>();

  if (roomDef) {
    allowedNamesSet.add(roomDef.name.toLowerCase());
    for (const [dir, exit] of Object.entries(roomDef.exits)) {
      allowedNamesSet.add(dir.toLowerCase());
      const dest = content.rooms[exit.to];
      if (dest) allowedNamesSet.add(dest.name.toLowerCase());
    }
  }

  if (!dark && roomDef) {
    for (const [id, itemState] of Object.entries(world.items)) {
      if (itemState.loc.kind === "room" && itemState.loc.room === world.player.room) {
        const itemDef = content.items[id];
        if (itemDef) {
          visibleItems.push(itemDef.name);
          allowedNamesSet.add(itemDef.name.toLowerCase());
          for (const alias of itemDef.aliases) {
            allowedNamesSet.add(alias.toLowerCase());
          }
        }
      }
    }
    // Items in open containers
    for (const [fixtureId, fixture] of Object.entries(roomDef.fixtures)) {
      allowedNamesSet.add(fixture.name.toLowerCase());
      for (const alias of fixture.aliases) {
        allowedNamesSet.add(alias.toLowerCase());
      }
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
              visibleItems.push(itemDef.name);
              allowedNamesSet.add(itemDef.name.toLowerCase());
              for (const alias of itemDef.aliases) {
                allowedNamesSet.add(alias.toLowerCase());
              }
            }
          }
        }
      }
    }
  }

  // Inventory
  const inventory: string[] = [];
  for (const [id, itemState] of Object.entries(world.items)) {
    if (itemState.loc.kind === "inventory") {
      const itemDef = content.items[id];
      if (itemDef) {
        inventory.push(itemDef.name);
        allowedNamesSet.add(itemDef.name.toLowerCase());
        for (const alias of itemDef.aliases) {
          allowedNamesSet.add(alias.toLowerCase());
        }
      }
    }
  }

  // NPCs in room
  const npcsHere: Array<{ name: string; moodLabel: ReturnType<typeof moodToLabel>; personality: string }> =
    [];
  for (const [id, npcState] of Object.entries(world.npcs)) {
    if (npcState.room === world.player.room) {
      const npcDef = content.npcs[id];
      if (npcDef) {
        npcsHere.push({
          name: npcDef.name,
          moodLabel: moodToLabel(npcState.mood),
          personality: npcDef.personality,
        });
        allowedNamesSet.add(npcDef.name.toLowerCase());
        for (const alias of npcDef.aliases) {
          allowedNamesSet.add(alias.toLowerCase());
        }
      }
    }
  }

  // Allowed hint text
  let allowedHintText: string | undefined;
  for (const e of events) {
    if (e.type === "npc_spoke") {
      const npcDef = content.npcs[e.npc];
      const hint = npcDef?.hints.find((h) => h.id === e.hintId);
      if (hint) {
        allowedHintText = hint.text;
      }
    }
  }

  // Human facts
  const humanFacts: HumanFact[] = events.map((event) => {
    const text = renderEventTemplate(event, content);
    const ids: string[] = [];
    if ("item" in event && typeof event.item === "string") ids.push(event.item);
    if ("npc" in event && typeof event.npc === "string") ids.push(event.npc);
    if ("room" in event && typeof event.room === "string") ids.push(event.room);
    if ("to" in event && typeof event.to === "string") ids.push(event.to);
    if ("fixture" in event && typeof event.fixture === "string") ids.push(event.fixture);
    return { text, ids };
  });

  // Check for failed action
  let failed: { code: string; reason: string } | undefined;
  const failedEvent = events.find((e) => e.type === "action_failed");
  if (failedEvent && failedEvent.type === "action_failed") {
    failed = { code: failedEvent.code, reason: failedEvent.reason };
  }

  return {
    kind,
    playerCommand: playerCommand ? playerCommand.slice(0, 200) : undefined,
    room: {
      name: roomDef?.name ?? "Unknown Room",
      description: roomDef?.description ?? "",
      dark,
    },
    events: humanFacts,
    visibleItems,
    inventory,
    npcsHere,
    allowedHintText,
    allowedEntityNames: Array.from(allowedNamesSet),
    failed,
  };
}
