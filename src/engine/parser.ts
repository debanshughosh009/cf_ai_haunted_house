// Parser — text → Action | Ambiguous | Unknown
// Pure TypeScript, no Cloudflare imports
import type { Content } from "./content";
import type { World } from "./world";
import type { Action, ParseResult, Direction } from "../shared/types";
import {
  DIRECTION_SYNONYMS,
  MOVE_VERBS,
  LOOK_VERBS,
  EXAMINE_VERBS,
  TAKE_VERBS,
  DROP_VERBS,
  OPEN_VERBS,
  USE_VERBS,
  GIVE_VERBS,
  PLACE_VERBS,
  TALK_VERBS,
  LIGHT_VERBS,
  WIND_VERBS,
  WAIT_VERBS,
  INV_VERBS,
  HELP_VERBS,
  ARTICLES,
} from "./lexicon";

/** Entities in scope for entity resolution */
interface Scope {
  roomItems: Array<{ id: string; name: string; aliases: string[] }>;
  inventoryItems: Array<{ id: string; name: string; aliases: string[] }>;
  fixtures: Array<{ id: string; name: string; aliases: string[] }>;
  npcs: Array<{ id: string; name: string; aliases: string[] }>;
  directions: Direction[];
  topics: string[];
}

/** Build scope from current world state */
export function buildScope(world: World, content: Content): Scope {
  const playerRoom = content.rooms[world.player.room];
  const roomItems: Scope["roomItems"] = [];
  const inventoryItems: Scope["inventoryItems"] = [];
  const fixtures: Scope["fixtures"] = [];
  const npcs: Scope["npcs"] = [];
  const directions: Direction[] = [];
  const topics: string[] = [];

  if (!playerRoom) return { roomItems, inventoryItems, fixtures, npcs, directions, topics };

  // Room items (visible: not dark or has light)
  const isDark =
    playerRoom.dark === true &&
    !Object.entries(world.items).some(
      ([_, item]) =>
        item.loc.kind === "inventory" && item.lit === true
    );

  if (!isDark) {
    for (const [id, itemState] of Object.entries(world.items)) {
      if (
        itemState.loc.kind === "room" &&
        itemState.loc.room === world.player.room
      ) {
        const itemDef = content.items[id];
        if (itemDef) {
          roomItems.push({ id, name: itemDef.name, aliases: itemDef.aliases });
        }
      }
    }
    // Items in open containers in this room
    for (const [fixtureId, fixture] of Object.entries(playerRoom.fixtures)) {
      const key = `${world.player.room}:${fixtureId}`;
      const containerState = world.containers[key];
      if (containerState?.open && fixture.container) {
        for (const [id, itemState] of Object.entries(world.items)) {
          if (
            itemState.loc.kind === "container" &&
            itemState.loc.room === world.player.room &&
            itemState.loc.fixture === fixtureId
          ) {
            const itemDef = content.items[id];
            if (itemDef) {
              roomItems.push({
                id,
                name: itemDef.name,
                aliases: itemDef.aliases,
              });
            }
          }
        }
      }
    }
  }

  // Inventory items
  for (const [id, itemState] of Object.entries(world.items)) {
    if (itemState.loc.kind === "inventory") {
      const itemDef = content.items[id];
      if (itemDef) {
        inventoryItems.push({
          id,
          name: itemDef.name,
          aliases: itemDef.aliases,
        });
      }
    }
  }

  // Fixtures
  for (const [id, fixture] of Object.entries(playerRoom.fixtures)) {
    fixtures.push({ id, name: fixture.name, aliases: fixture.aliases });
  }

  // NPCs in room
  for (const [id, npcState] of Object.entries(world.npcs)) {
    if (npcState.room === world.player.room) {
      const npcDef = content.npcs[id];
      if (npcDef) {
        npcs.push({ id, name: npcDef.name, aliases: npcDef.aliases });
        // Add topics from this NPC
        for (const topic of Object.keys(npcDef.topics)) {
          if (!topics.includes(topic)) topics.push(topic);
        }
      }
    }
  }

  // Directions
  for (const dir of Object.keys(playerRoom.exits) as Direction[]) {
    directions.push(dir);
  }

  return { roomItems, inventoryItems, fixtures, npcs, directions, topics };
}

/** Normalize input text */
export function normalize(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^\w\s]/g, "") // strip punctuation
    .replace(/\s+/g, " ") // collapse whitespace
    .trim();
}

/** Remove articles from words */
function stripArticles(words: string[]): string[] {
  return words.filter((w) => !ARTICLES.has(w));
}

/** Resolve an entity name against scope */
function resolveEntity(
  name: string,
  entities: Array<{ id: string; name: string; aliases: string[] }>
): string[] {
  const lower = name.toLowerCase();
  const matches: string[] = [];
  for (const e of entities) {
    if (
      e.name.toLowerCase() === lower ||
      e.id.toLowerCase() === lower ||
      e.id.replace(/_/g, " ").toLowerCase() === lower ||
      e.aliases.some((a) => a.toLowerCase() === lower)
    ) {
      matches.push(e.id);
    }
  }
  // Also try partial matching (first word of name or alias)
  if (matches.length === 0) {
    for (const e of entities) {
      if (
        e.name.toLowerCase().startsWith(lower) ||
        e.name.toLowerCase().split(" ").some((w) => w === lower) ||
        e.aliases.some(
          (a) =>
            a.toLowerCase().startsWith(lower) ||
            a.toLowerCase().split(" ").some((w) => w === lower)
        )
      ) {
        matches.push(e.id);
      }
    }
  }
  return [...new Set(matches)];
}

/** Parse player input into an action */
export function parse(input: string, world: World, content: Content): ParseResult {
  const scope = buildScope(world, content);
  const normalized = normalize(input);
  if (!normalized) {
    return { kind: "action", action: { type: "help" } };
  }

  const words = stripArticles(normalized.split(" "));
  const text = words.join(" ");

  // ─── Bare direction ─────────────────────────────────
  if (words.length === 1 && DIRECTION_SYNONYMS[words[0]!]) {
    return {
      kind: "action",
      action: { type: "go", dir: DIRECTION_SYNONYMS[words[0]!]! },
    };
  }

  // ─── Go / movement ─────────────────────────────────
  if (words.length >= 1 && MOVE_VERBS.has(words[0]!)) {
    const dirWord = words[1] === "to" ? words[2] : words[1];
    if (dirWord && DIRECTION_SYNONYMS[dirWord]) {
      return {
        kind: "action",
        action: { type: "go", dir: DIRECTION_SYNONYMS[dirWord]! },
      };
    }
  }

  // ─── Look ───────────────────────────────────────────
  if (
    (words.length === 1 && LOOK_VERBS.has(words[0]!)) ||
    (words.length === 2 && words[0] === "look" && words[1] === "around")
  ) {
    return { kind: "action", action: { type: "look" } };
  }

  // ─── Inventory ──────────────────────────────────────
  if (words.length === 1 && INV_VERBS.has(words[0]!)) {
    return { kind: "action", action: { type: "inventory" } };
  }

  // ─── Help ───────────────────────────────────────────
  if (words.length === 1 && HELP_VERBS.has(words[0]!)) {
    return { kind: "action", action: { type: "help" } };
  }

  // ─── Wait ───────────────────────────────────────────
  if (words.length === 1 && WAIT_VERBS.has(words[0]!)) {
    return { kind: "action", action: { type: "wait" } };
  }

  // ─── New game / restart ─────────────────────────────
  if (text === "new game" || text === "restart") {
    // Handled at agent level, but parser recognizes it
    return { kind: "action", action: { type: "help" } };
  }

  // ─── Examine ────────────────────────────────────────
  const examineMatch = matchVerb(words, EXAMINE_VERBS);
  if (examineMatch !== null) {
    const targetName = words.slice(examineMatch).join(" ");
    if (targetName) {
      // Try resolving against all visible entities
      const allEntities = [
        ...scope.roomItems,
        ...scope.inventoryItems,
        ...scope.fixtures,
        ...scope.npcs,
      ];
      const matches = resolveEntity(targetName, allEntities);
      if (matches.length === 1) {
        return {
          kind: "action",
          action: { type: "examine", target: matches[0]! },
        };
      }
      if (matches.length > 1) {
        return { kind: "ambiguous", options: matches };
      }
      // Allow examining by raw name even if not resolved
      return {
        kind: "action",
        action: { type: "examine", target: targetName },
      };
    }
  }

  // Special: "look at X"
  if (words.length >= 3 && words[0] === "look" && words[1] === "at") {
    const targetName = words.slice(2).join(" ");
    const allEntities = [
      ...scope.roomItems,
      ...scope.inventoryItems,
      ...scope.fixtures,
      ...scope.npcs,
    ];
    const matches = resolveEntity(targetName, allEntities);
    if (matches.length === 1) {
      return {
        kind: "action",
        action: { type: "examine", target: matches[0]! },
      };
    }
    if (matches.length > 1) {
      return { kind: "ambiguous", options: matches };
    }
    return {
      kind: "action",
      action: { type: "examine", target: targetName },
    };
  }

  // ─── Take ───────────────────────────────────────────
  const takeMatch = matchVerb(words, TAKE_VERBS);
  if (takeMatch !== null) {
    const itemName = words.slice(takeMatch).join(" ");
    if (itemName) {
      const matches = resolveEntity(itemName, [
        ...scope.roomItems,
        ...scope.inventoryItems,
      ]);
      if (matches.length === 1) {
        return {
          kind: "action",
          action: { type: "take", item: matches[0]! },
        };
      }
      if (matches.length > 1) {
        return { kind: "ambiguous", options: matches };
      }
      // Try fixture names too in case they try to take a fixture
      const fixtureMatches = resolveEntity(itemName, scope.fixtures);
      if (fixtureMatches.length >= 1) {
        return {
          kind: "action",
          action: { type: "take", item: fixtureMatches[0]! },
        };
      }
    }
    return { kind: "unknown" };
  }

  // ─── Drop ───────────────────────────────────────────
  const dropMatch = matchVerb(words, DROP_VERBS);
  if (dropMatch !== null) {
    const itemName = words.slice(dropMatch).join(" ");
    if (itemName) {
      const matches = resolveEntity(itemName, scope.inventoryItems);
      if (matches.length === 1) {
        return {
          kind: "action",
          action: { type: "drop", item: matches[0]! },
        };
      }
      if (matches.length > 1) {
        return { kind: "ambiguous", options: matches };
      }
    }
    return { kind: "unknown" };
  }

  // ─── Light ──────────────────────────────────────────
  if (words.length >= 2 && LIGHT_VERBS.has(words[0]!)) {
    const itemName = words.slice(1).join(" ");
    const matches = resolveEntity(itemName, [
      ...scope.inventoryItems,
      ...scope.roomItems,
    ]);
    if (matches.length === 1) {
      return {
        kind: "action",
        action: { type: "light", item: matches[0]! },
      };
    }
    if (matches.length > 1) {
      return { kind: "ambiguous", options: matches };
    }
    return {
      kind: "action",
      action: { type: "light", item: itemName },
    };
  }

  // ─── Wind ───────────────────────────────────────────
  if (words.length >= 2 && WIND_VERBS.has(words[0]!)) {
    const itemName = words.slice(1).join(" ");
    const matches = resolveEntity(itemName, [
      ...scope.inventoryItems,
      ...scope.roomItems,
    ]);
    if (matches.length === 1) {
      return {
        kind: "action",
        action: { type: "use", item: "winding_key", target: matches[0] },
      };
    }
    // If "wind music box" and we have winding_key
    if (itemName.includes("music")) {
      return {
        kind: "action",
        action: { type: "use", item: "winding_key", target: "music_box" },
      };
    }
    return { kind: "unknown" };
  }

  // ─── Open ───────────────────────────────────────────
  if (words.length >= 2 && OPEN_VERBS.has(words[0]!)) {
    const targetName = words.slice(1).join(" ");
    const matches = resolveEntity(targetName, scope.fixtures);
    if (matches.length === 1) {
      return {
        kind: "action",
        action: { type: "open", fixture: matches[0]!, room: world.player.room },
      };
    }
    if (matches.length > 1) {
      return { kind: "ambiguous", options: matches };
    }
    // Maybe trying to open with raw name
    return {
      kind: "action",
      action: { type: "open", fixture: targetName, room: world.player.room },
    };
  }

  // ─── Give ───────────────────────────────────────────
  const giveMatch = matchVerb(words, GIVE_VERBS);
  if (giveMatch !== null) {
    const rest = words.slice(giveMatch).join(" ");
    const toIdx = rest.indexOf(" to ");
    if (toIdx !== -1) {
      const itemName = rest.slice(0, toIdx);
      const npcName = rest.slice(toIdx + 4);
      const itemMatches = resolveEntity(itemName, scope.inventoryItems);
      const npcMatches = resolveEntity(npcName, scope.npcs);
      if (itemMatches.length === 1 && npcMatches.length === 1) {
        return {
          kind: "action",
          action: { type: "give", item: itemMatches[0]!, npc: npcMatches[0]! },
        };
      }
      // Try with unresolved names
      if (itemMatches.length <= 1 && npcMatches.length <= 1) {
        return {
          kind: "action",
          action: {
            type: "give",
            item: itemMatches[0] ?? itemName,
            npc: npcMatches[0] ?? npcName,
          },
        };
      }
    }
    return { kind: "unknown" };
  }

  // ─── Place ──────────────────────────────────────────
  const placeMatch = matchVerb(words, PLACE_VERBS);
  if (placeMatch !== null) {
    const rest = words.slice(placeMatch).join(" ");
    // "place X on Y" / "put X in Y"
    const onIdx = rest.indexOf(" on ");
    const inIdx = rest.indexOf(" in ");
    const sepIdx = onIdx !== -1 ? onIdx : inIdx;
    const sepLen = onIdx !== -1 ? 4 : 4;
    if (sepIdx !== -1) {
      const itemName = rest.slice(0, sepIdx);
      const targetName = rest.slice(sepIdx + sepLen);
      const itemMatches = resolveEntity(itemName, scope.inventoryItems);
      const targetMatches = resolveEntity(targetName, [
        ...scope.fixtures,
        ...scope.roomItems,
      ]);
      return {
        kind: "action",
        action: {
          type: "place",
          item: itemMatches[0] ?? itemName,
          target: targetMatches[0] ?? targetName,
        },
      };
    }
    return { kind: "unknown" };
  }

  // ─── Use ────────────────────────────────────────────
  const useMatch = matchVerb(words, USE_VERBS);
  if (useMatch !== null) {
    const rest = words.slice(useMatch);
    // "use X on/with Y"
    const onIdx = rest.indexOf("on");
    const withIdx = rest.indexOf("with");
    const inIdx = rest.indexOf("in");
    const sepIdx = Math.min(
      ...[onIdx, withIdx, inIdx].filter((i) => i !== -1).concat([rest.length])
    );

    const itemName = rest.slice(0, sepIdx).join(" ");
    const targetName =
      sepIdx < rest.length ? rest.slice(sepIdx + 1).join(" ") : undefined;

    const allItems = [...scope.inventoryItems, ...scope.roomItems];
    const itemMatches = resolveEntity(itemName, allItems);
    let targetId: string | undefined;
    if (targetName) {
      const targetMatches = resolveEntity(targetName, [
        ...allItems,
        ...scope.fixtures,
        ...scope.npcs,
      ]);
      targetId = targetMatches[0] ?? targetName;
    }

    if (itemMatches.length === 1) {
      return {
        kind: "action",
        action: { type: "use", item: itemMatches[0]!, target: targetId },
      };
    }
    if (itemMatches.length > 1) {
      return { kind: "ambiguous", options: itemMatches };
    }
    // Try unresolved
    if (itemName) {
      return {
        kind: "action",
        action: { type: "use", item: itemName, target: targetId },
      };
    }
    return { kind: "unknown" };
  }

  // ─── Talk ───────────────────────────────────────────
  const talkMatch = matchTalkVerb(words);
  if (talkMatch !== null) {
    const rest = words.slice(talkMatch);
    const aboutIdx = rest.indexOf("about");
    const npcName =
      aboutIdx !== -1 ? rest.slice(0, aboutIdx).join(" ") : rest.join(" ");
    const topic =
      aboutIdx !== -1 ? rest.slice(aboutIdx + 1).join(" ") : undefined;

    const npcMatches = resolveEntity(npcName, scope.npcs);
    if (npcMatches.length === 1) {
      return {
        kind: "action",
        action: { type: "talk", npc: npcMatches[0]!, topic },
      };
    }
    if (npcMatches.length > 1) {
      return { kind: "ambiguous", options: npcMatches };
    }
    // Allow with raw name
    if (npcName) {
      return {
        kind: "action",
        action: { type: "talk", npc: npcName, topic },
      };
    }
    return { kind: "unknown" };
  }

  return { kind: "unknown" };
}

/** Match multi-word verbs, returns the index after the verb or null */
function matchVerb(words: string[], verbs: Set<string>): number | null {
  // Try two-word verbs first
  if (words.length >= 2) {
    const twoWord = `${words[0]} ${words[1]}`;
    if (verbs.has(twoWord)) return 2;
  }
  // Single-word verb
  if (words.length >= 1 && verbs.has(words[0]!)) return 1;
  return null;
}

/** Match talk verbs specifically (handles "talk to", "speak to", "ask") */
function matchTalkVerb(words: string[]): number | null {
  if (words.length >= 3 && (words[0] === "talk" || words[0] === "speak") && words[1] === "to") {
    return 2;
  }
  if (words.length >= 2 && words[0] === "ask") return 1;
  if (words.length >= 2 && (words[0] === "talk" || words[0] === "speak" || words[0] === "chat")) {
    return 1;
  }
  return null;
}
