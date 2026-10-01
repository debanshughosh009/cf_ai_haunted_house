// Apply — (World, Action, now) → { world, events }
// Pure TypeScript — mutates a clone, never the input
import type { Content, Interaction } from "./content";
import { cloneWorld, type World, containerKey } from "./world";
import type { Action, GameEvent, Direction } from "../shared/types";
import { selectHint } from "./hints";
import { isDark } from "./validate";

export interface ApplyResult {
  world: World;
  events: GameEvent[];
}

/** Apply a validated action to the world, returning a new world and events */
export function apply(
  world: World,
  content: Content,
  action: Action,
  now: number
): ApplyResult {
  const w = cloneWorld(world);
  w.turn += 1;
  w.lastSeenAt = now;

  // Tick down candle
  const candleEvents = tickCandle(w, content);

  const events: GameEvent[] = [];

  switch (action.type) {
    case "go":
      events.push(...applyGo(w, content, action.dir));
      break;
    case "look":
      events.push(...applyLook(w, content));
      break;
    case "inventory":
      events.push(...applyInventory(w, content));
      break;
    case "help":
      events.push({ type: "help_shown" });
      break;
    case "wait":
      events.push({ type: "waited" });
      break;
    case "examine":
      events.push(...applyExamine(w, content, action.target));
      break;
    case "take":
      events.push(...applyTake(w, content, action.item));
      break;
    case "drop":
      events.push(...applyDrop(w, content, action.item));
      break;
    case "open":
      events.push(...applyOpen(w, content, action.fixture, action.room));
      break;
    case "light":
      events.push(...applyLight(w, content, action.item));
      break;
    case "use":
      events.push(...applyUse(w, content, action.item, action.target));
      break;
    case "give":
      events.push(...applyGive(w, content, action.item, action.npc));
      break;
    case "place":
      events.push(...applyPlace(w, content, action.item, action.target));
      break;
    case "talk":
      events.push(...applyTalk(w, content, action.npc, action.topic));
      break;
  }

  events.push(...candleEvents);

  return { world: w, events };
}

function tickCandle(w: World, content: Content): GameEvent[] {
  const events: GameEvent[] = [];
  for (const [id, itemState] of Object.entries(w.items)) {
    if (itemState.lit && itemState.litTurnsLeft !== undefined) {
      itemState.litTurnsLeft -= 1;
      if (itemState.litTurnsLeft <= 0) {
        itemState.lit = false;
        itemState.litTurnsLeft = undefined;
        const itemDef = content.items[id];
        // Clear candle_lit flag
        if (id === "candle") {
          w.flags["candle_lit"] = false;
        }
        events.push({ type: "light_out", item: id });
      }
    }
  }
  return events;
}

function applyGo(w: World, content: Content, dir: Direction): GameEvent[] {
  const room = content.rooms[w.player.room];
  const exit = room?.exits[dir];
  if (!exit) {
    return [{ type: "move_blocked", dir, reason: "No exit in that direction." }];
  }

  // Auto-unlock if player has the key
  if (exit.lockedBy) {
    const hasKey = w.items[exit.lockedBy]?.loc.kind === "inventory";
    const flagId = `${exit.to}_unlocked`;
    if (hasKey) {
      w.flags[flagId] = true;
    }
  }

  const from = w.player.room;
  w.player.room = exit.to;
  return [{ type: "player_moved", from, to: exit.to, dir }];
}

function applyLook(w: World, content: Content): GameEvent[] {
  const room = content.rooms[w.player.room];
  if (!room) return [];

  const dark = isDark(w, content);
  const items: string[] = [];
  const npcs: string[] = [];
  const exits: string[] = [];

  if (!dark) {
    // Visible items in room
    for (const [id, itemState] of Object.entries(w.items)) {
      if (itemState.loc.kind === "room" && itemState.loc.room === w.player.room) {
        const def = content.items[id];
        if (def) items.push(def.name);
      }
    }
    // Items in open containers
    for (const [fixtureId, fixture] of Object.entries(room.fixtures)) {
      const key = containerKey(w.player.room, fixtureId);
      if (w.containers[key]?.open && fixture.container) {
        for (const [id, itemState] of Object.entries(w.items)) {
          if (
            itemState.loc.kind === "container" &&
            itemState.loc.room === w.player.room &&
            itemState.loc.fixture === fixtureId
          ) {
            const def = content.items[id];
            if (def) items.push(def.name);
          }
        }
      }
    }
    // Exits
    for (const [dir] of Object.entries(room.exits)) {
      exits.push(dir);
    }
  }

  // NPCs
  for (const [id, npcState] of Object.entries(w.npcs)) {
    if (npcState.room === w.player.room) {
      const def = content.npcs[id];
      if (def) npcs.push(def.name);
    }
  }

  return [
    {
      type: "looked",
      room: w.player.room,
      description: room.description,
      items,
      npcs,
      exits,
    },
  ];
}

function applyInventory(w: World, content: Content): GameEvent[] {
  const items: string[] = [];
  for (const [id, itemState] of Object.entries(w.items)) {
    if (itemState.loc.kind === "inventory") {
      const def = content.items[id];
      if (def) items.push(def.name);
    }
  }
  return [{ type: "inventory_listed", items }];
}

function applyExamine(w: World, content: Content, target: string): GameEvent[] {
  return [{ type: "examined", target }];
}

function applyTake(w: World, content: Content, itemId: string): GameEvent[] {
  const itemState = w.items[itemId];
  if (!itemState) return [{ type: "action_failed", reason: "You don't see that here.", code: "NOT_HERE" }];

  const events: GameEvent[] = [];

  // If Eleanor is in the room and item is ghostMovable, she gets angry
  const itemDef = content.items[itemId];
  if (itemDef?.ghostMovable) {
    const eleanorState = w.npcs["eleanor"];
    if (eleanorState && eleanorState.room === w.player.room) {
      const oldMood = eleanorState.mood;
      eleanorState.mood = Math.max(-100, eleanorState.mood - 5);
      events.push({
        type: "npc_mood_changed",
        npc: "eleanor",
        from: oldMood,
        to: eleanorState.mood,
      });
    }
  }

  itemState.loc = { kind: "inventory" };
  events.push({ type: "item_taken", item: itemId });
  return events;
}

function applyDrop(w: World, content: Content, itemId: string): GameEvent[] {
  const itemState = w.items[itemId];
  if (!itemState) return [];

  itemState.loc = { kind: "room", room: w.player.room };
  return [{ type: "item_dropped", item: itemId, room: w.player.room }];
}

function applyOpen(w: World, content: Content, fixtureId: string, room?: string): GameEvent[] {
  const roomId = room ?? w.player.room;

  // Check if there's an interaction for this open action
  const interaction = content.interactions.find(
    (i) =>
      i.verb === "open" &&
      (i.subject === fixtureId || i.target === fixtureId) &&
      (!i.room || i.room === roomId)
  );

  if (interaction) {
    return applyInteraction(w, content, interaction);
  }

  // Default open behavior
  const key = containerKey(roomId, fixtureId);
  const container = w.containers[key];
  if (!container) return [{ type: "action_failed", reason: "Nothing happens.", code: "NOTHING_HAPPENS" }];

  container.open = true;

  // Reveal contents
  const revealed: string[] = [];
  for (const [id, itemState] of Object.entries(w.items)) {
    if (
      itemState.loc.kind === "container" &&
      itemState.loc.room === roomId &&
      itemState.loc.fixture === fixtureId
    ) {
      revealed.push(id);
    }
  }

  return [{ type: "container_opened", fixture: fixtureId, revealed }];
}

function applyLight(w: World, content: Content, itemId: string): GameEvent[] {
  // Check for light interaction first
  const interaction = content.interactions.find(
    (i) => i.verb === "light" && (i.subject === itemId || i.target === itemId)
  );

  if (interaction) {
    return applyInteraction(w, content, interaction);
  }

  // Default: light the item
  const itemState = w.items[itemId];
  const itemDef = content.items[itemId];
  if (!itemState || !itemDef?.lightSource) return [];

  itemState.lit = true;
  itemState.litTurnsLeft = itemDef.lightSource.turnsWhenLit;

  const events: GameEvent[] = [{ type: "item_lit", item: itemId }];
  if (itemId === "candle") {
    w.flags["candle_lit"] = true;
    events.push({ type: "flag_set", flag: "candle_lit" });
  }
  return events;
}

function applyUse(w: World, content: Content, itemId: string, target?: string): GameEvent[] {
  // Find matching interaction
  const interaction = content.interactions.find((i) => {
    if (i.verb !== "use" && i.verb !== "light" && i.verb !== "wind") return false;
    if (i.subject !== itemId) return false;
    if (i.target && target && i.target !== target) return false;
    if (!i.target && target) return false;
    if (i.room && i.room !== w.player.room) return false;
    return true;
  });

  if (interaction) {
    return applyInteraction(w, content, interaction);
  }

  // "use salt" to salt the room
  if (itemId === "salt") {
    return applySalt(w);
  }

  return [{ type: "action_failed", reason: "Nothing happens.", code: "NOTHING_HAPPENS" }];
}

function applyGive(w: World, content: Content, itemId: string, npcId: string): GameEvent[] {
  // Find matching interaction
  const interaction = content.interactions.find(
    (i) =>
      i.verb === "give" &&
      i.subject === itemId &&
      (i.target === npcId || !i.target)
  );

  if (interaction) {
    return applyInteraction(w, content, interaction);
  }

  return [{ type: "action_failed", reason: "They don't want that.", code: "NOTHING_HAPPENS" }];
}

function applyPlace(w: World, content: Content, itemId: string, target: string): GameEvent[] {
  // Find matching interaction
  const interaction = content.interactions.find(
    (i) =>
      i.verb === "place" &&
      i.subject === itemId &&
      i.target === target &&
      (!i.room || i.room === w.player.room)
  );

  if (interaction) {
    return applyInteraction(w, content, interaction);
  }

  return [{ type: "action_failed", reason: "Nothing happens.", code: "NOTHING_HAPPENS" }];
}

function applyTalk(w: World, content: Content, npcId: string, topic?: string): GameEvent[] {
  const npcDef = content.npcs[npcId];
  const npcState = w.npcs[npcId];
  if (!npcDef || !npcState) return [];

  const events: GameEvent[] = [];

  // Handle topic
  if (topic && npcDef.topics[topic]) {
    const topicDef = npcDef.topics[topic]!;

    // Apply mood delta if not already used (once)
    if (!topicDef.once || !npcState.topicsUsed.includes(topic)) {
      if (topicDef.moodDelta !== 0) {
        const oldMood = npcState.mood;
        npcState.mood = Math.max(-100, Math.min(100, npcState.mood + topicDef.moodDelta));
        events.push({
          type: "npc_mood_changed",
          npc: npcId,
          from: oldMood,
          to: npcState.mood,
        });
      }
      if (topicDef.once) {
        npcState.topicsUsed.push(topic);
      }
    }
  }

  // Select hint based on current mood and flags
  const hint = selectHint(npcDef, npcState, w.flags);
  if (hint) {
    npcState.lastHintId = hint.id;
    events.push({ type: "npc_spoke", npc: npcId, hintId: hint.id });
  }

  return events;
}

function applySalt(w: World): GameEvent[] {
  const room = w.player.room;
  if (w.salted.includes(room)) {
    return [{ type: "action_failed", reason: "This room has already been salted.", code: "ALREADY_DONE" }];
  }
  w.salted.push(room);

  const events: GameEvent[] = [{ type: "room_salted", room }];

  // Eleanor mood −20 if present
  const eleanorState = w.npcs["eleanor"];
  if (eleanorState && eleanorState.room === room) {
    const oldMood = eleanorState.mood;
    eleanorState.mood = Math.max(-100, eleanorState.mood - 20);
    events.push({
      type: "npc_mood_changed",
      npc: "eleanor",
      from: oldMood,
      to: eleanorState.mood,
    });
  }

  return events;
}

/** Apply a content-defined interaction */
function applyInteraction(w: World, content: Content, interaction: Interaction): GameEvent[] {
  const events: GameEvent[] = [];

  // Check prerequisites
  if (interaction.requiresFlags) {
    for (const flag of interaction.requiresFlags) {
      if (!w.flags[flag]) {
        return [{ type: "action_failed", reason: "Nothing happens.", code: "NOTHING_HAPPENS" }];
      }
    }
  }

  if (interaction.requiresNpcMoodAtLeast) {
    const { npc, mood } = interaction.requiresNpcMoodAtLeast;
    const npcState = w.npcs[npc];
    if (!npcState || npcState.mood < mood) {
      // For give journal_page to hale: he reads it but is unconvinced
      return [{ type: "interaction_applied", id: interaction.id, successText: interaction.successText }];
    }
  }

  // Apply effects
  for (const effect of interaction.effects) {
    switch (effect.type) {
      case "setFlag":
        w.flags[effect.flag] = effect.value;
        events.push({ type: "flag_set", flag: effect.flag });
        break;

      case "moodDelta": {
        const npcState = w.npcs[effect.npc];
        if (npcState) {
          const oldMood = npcState.mood;
          npcState.mood = Math.max(-100, Math.min(100, npcState.mood + effect.delta));
          events.push({
            type: "npc_mood_changed",
            npc: effect.npc,
            from: oldMood,
            to: npcState.mood,
          });
        }
        break;
      }

      case "moveItem": {
        const itemState = w.items[effect.item];
        if (itemState) {
          if (effect.to === "inventory") {
            itemState.loc = { kind: "inventory" };
          } else if (effect.to === "void") {
            itemState.loc = { kind: "void" };
          } else {
            itemState.loc = { kind: "room", room: effect.to };
          }
        }
        break;
      }

      case "npcGives": {
        const itemState = w.items[effect.item];
        if (itemState) {
          itemState.loc = { kind: "inventory" };
          events.push({ type: "npc_gave", npc: effect.npc, item: effect.item });
        }
        break;
      }

      case "lightItem": {
        const itemState = w.items[effect.item];
        const itemDef = content.items[effect.item];
        if (itemState && itemDef?.lightSource) {
          itemState.lit = true;
          itemState.litTurnsLeft = itemDef.lightSource.turnsWhenLit;
          events.push({ type: "item_lit", item: effect.item });
        }
        break;
      }

      case "revealContainer": {
        const key = containerKey(effect.room, effect.fixture);
        const container = w.containers[key];
        if (container) {
          container.open = true;
          const revealed: string[] = [];
          for (const [id, itemState] of Object.entries(w.items)) {
            if (
              itemState.loc.kind === "container" &&
              itemState.loc.room === effect.room &&
              itemState.loc.fixture === effect.fixture
            ) {
              revealed.push(id);
            }
          }
          events.push({
            type: "container_opened",
            fixture: effect.fixture,
            revealed,
          });
        }
        break;
      }

      case "moveNpc": {
        const npcState = w.npcs[effect.npc];
        if (npcState) {
          const from = npcState.room;
          npcState.room = effect.to;
          events.push({
            type: "ghost_moved",
            npc: effect.npc,
            from,
            to: effect.to,
          });
        }
        break;
      }

      case "win":
        w.won = true;
        events.push({ type: "game_won" });
        break;
    }
  }

  events.push({
    type: "interaction_applied",
    id: interaction.id,
    successText: interaction.successText,
  });

  return events;
}
