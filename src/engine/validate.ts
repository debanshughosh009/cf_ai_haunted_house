// Validate — Action × World → ok | RuleError
// Pure TypeScript
import type { Content } from "./content";
import type { World } from "./world";
import type { Action, Direction } from "../shared/types";

export type ValidationResult =
  | { ok: true }
  | { ok: false; code: string; reason: string };

/** Check if the player has a lit light source */
export function hasLight(world: World): boolean {
  return Object.entries(world.items).some(
    ([_, item]) => item.loc.kind === "inventory" && item.lit === true
  );
}

/** Check if current room is dark (and player has no light) */
export function isDark(world: World, content: Content): boolean {
  const room = content.rooms[world.player.room];
  return room?.dark === true && !hasLight(world);
}

/** Validate an action against the current world state */
export function validate(
  world: World,
  content: Content,
  action: Action
): ValidationResult {
  if (world.won) {
    return { ok: false, code: "GAME_OVER", reason: "The house is quiet now. Type 'new game' to start again." };
  }

  switch (action.type) {
    case "go":
      return validateGo(world, content, action.dir);
    case "look":
    case "inventory":
    case "help":
    case "wait":
      return { ok: true };
    case "examine":
      return validateExamine(world, content, action.target);
    case "take":
      return validateTake(world, content, action.item);
    case "drop":
      return validateDrop(world, action.item);
    case "open":
      return validateOpen(world, content, action.fixture, action.room);
    case "use":
      return validateUse(world, content, action.item, action.target);
    case "give":
      return validateGive(world, content, action.item, action.npc);
    case "place":
      return validatePlace(world, content, action.item, action.target);
    case "talk":
      return validateTalk(world, content, action.npc);
    case "light":
      return validateLight(world, content, action.item);
    default:
      return { ok: false, code: "NOTHING_HAPPENS", reason: "Nothing happens." };
  }
}

function validateGo(world: World, content: Content, dir: Direction): ValidationResult {
  const room = content.rooms[world.player.room];
  if (!room) return { ok: false, code: "NO_EXIT", reason: "You can't go that way." };

  const exit = room.exits[dir];
  if (!exit) return { ok: false, code: "NO_EXIT", reason: "There is no exit in that direction." };

  // Check locked
  if (exit.lockedBy) {
    // Check if the player has the key OR the flag is set
    const hasKey =
      world.items[exit.lockedBy]?.loc.kind === "inventory";
    // Check for unlock flags (e.g., crypt_unlocked)
    const flagId = `${exit.to}_unlocked`;
    if (!hasKey && !world.flags[flagId]) {
      return { ok: false, code: "LOCKED", reason: exit.blockedText };
    }
  }

  // Check requiresFlag
  if (exit.requiresFlag && !world.flags[exit.requiresFlag]) {
    return { ok: false, code: "LOCKED", reason: exit.blockedText };
  }

  return { ok: true };
}

function validateExamine(world: World, content: Content, target: string): ValidationResult {
  if (isDark(world, content)) {
    return { ok: false, code: "TOO_DARK", reason: "It's too dark to see anything." };
  }
  // Can examine anything in scope
  return { ok: true };
}

function validateTake(world: World, content: Content, itemId: string): ValidationResult {
  if (isDark(world, content)) {
    return { ok: false, code: "TOO_DARK", reason: "It's too dark to see anything to take." };
  }

  const itemState = world.items[itemId];
  const itemDef = content.items[itemId];

  if (!itemDef) {
    return { ok: false, code: "NOT_HERE", reason: "You don't see that here." };
  }

  if (!itemDef.takeable) {
    return { ok: false, code: "NOT_TAKEABLE", reason: `You can't take the ${itemDef.name}.` };
  }

  if (!itemState) {
    return { ok: false, code: "NOT_HERE", reason: "You don't see that here." };
  }

  if (itemState.loc.kind === "inventory") {
    return { ok: false, code: "ALREADY_DONE", reason: "You already have that." };
  }

  // Must be in the current room (loose or in open container)
  if (itemState.loc.kind === "room" && itemState.loc.room === world.player.room) {
    return { ok: true };
  }

  if (
    itemState.loc.kind === "container" &&
    itemState.loc.room === world.player.room
  ) {
    const key = `${itemState.loc.room}:${itemState.loc.fixture}`;
    if (world.containers[key]?.open) {
      return { ok: true };
    }
    return { ok: false, code: "NOT_HERE", reason: "You don't see that here." };
  }

  return { ok: false, code: "NOT_HERE", reason: "You don't see that here." };
}

function validateDrop(world: World, itemId: string): ValidationResult {
  const itemState = world.items[itemId];
  if (!itemState || itemState.loc.kind !== "inventory") {
    return { ok: false, code: "NOT_HELD", reason: "You're not carrying that." };
  }
  return { ok: true };
}

function validateOpen(
  world: World,
  content: Content,
  fixtureId: string,
  room?: string
): ValidationResult {
  const roomId = room ?? world.player.room;
  const roomDef = content.rooms[roomId];
  if (!roomDef) return { ok: false, code: "NOT_HERE", reason: "You don't see that here." };

  const fixture = roomDef.fixtures[fixtureId];
  if (!fixture) {
    return { ok: false, code: "NOT_HERE", reason: "You don't see that here." };
  }

  if (!fixture.container?.openable) {
    return { ok: false, code: "NOTHING_HAPPENS", reason: `You can't open the ${fixture.name}.` };
  }

  const key = `${roomId}:${fixtureId}`;
  if (world.containers[key]?.open) {
    return { ok: false, code: "ALREADY_DONE", reason: `The ${fixture.name} is already open.` };
  }

  return { ok: true };
}

function validateUse(
  world: World,
  content: Content,
  itemId: string,
  target?: string
): ValidationResult {
  // Check if item is in inventory or room
  const itemState = world.items[itemId];
  if (!itemState) {
    return { ok: false, code: "NOT_HERE", reason: "You don't have that." };
  }

  // For "use" with specific interactions, validation is deferred to apply
  // But basic checks:
  if (
    itemState.loc.kind !== "inventory" &&
    !(itemState.loc.kind === "room" && itemState.loc.room === world.player.room)
  ) {
    return { ok: false, code: "NOT_HERE", reason: "You don't see that here." };
  }

  return { ok: true };
}

function validateGive(
  world: World,
  content: Content,
  itemId: string,
  npcId: string
): ValidationResult {
  const itemState = world.items[itemId];
  if (!itemState || itemState.loc.kind !== "inventory") {
    return { ok: false, code: "NOT_HELD", reason: "You're not carrying that." };
  }

  const npcState = world.npcs[npcId];
  if (!npcState || npcState.room !== world.player.room) {
    return { ok: false, code: "NOT_HERE", reason: "They're not here." };
  }

  return { ok: true };
}

function validatePlace(
  world: World,
  content: Content,
  itemId: string,
  target: string
): ValidationResult {
  const itemState = world.items[itemId];
  if (!itemState || itemState.loc.kind !== "inventory") {
    return { ok: false, code: "NOT_HELD", reason: "You're not carrying that." };
  }

  return { ok: true };
}

function validateTalk(
  world: World,
  content: Content,
  npcId: string
): ValidationResult {
  const npcState = world.npcs[npcId];
  if (!npcState || npcState.room !== world.player.room) {
    return { ok: false, code: "NOT_HERE", reason: "There's nobody here by that name." };
  }
  return { ok: true };
}

function validateLight(
  world: World,
  content: Content,
  itemId: string
): ValidationResult {
  // "light candle" means "use matches on candle"
  const itemDef = content.items[itemId];
  if (!itemDef) {
    return { ok: false, code: "NOT_HERE", reason: "You don't see that." };
  }

  if (!itemDef.lightSource) {
    return { ok: false, code: "NOTHING_HAPPENS", reason: `You can't light the ${itemDef.name}.` };
  }

  const itemState = world.items[itemId];
  if (!itemState || itemState.loc.kind !== "inventory") {
    return { ok: false, code: "NOT_HELD", reason: `You need to be holding the ${itemDef.name}.` };
  }

  if (itemState.lit) {
    return { ok: false, code: "ALREADY_DONE", reason: `The ${itemDef.name} is already lit.` };
  }

  // Need matches
  const matchesState = world.items["matches"];
  if (!matchesState || matchesState.loc.kind !== "inventory") {
    return { ok: false, code: "NOT_HELD", reason: "You need matches to light that." };
  }

  return { ok: true };
}
