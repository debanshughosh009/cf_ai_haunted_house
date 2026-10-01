// ─── Id types ───────────────────────────────────────────────
export type RoomId = string;
export type ItemId = string;
export type FixtureId = string;
export type NpcId = string;
export type FlagId = string;
export type HintId = string;

// ─── Direction ──────────────────────────────────────────────
export type Direction = "north" | "south" | "east" | "west" | "up" | "down";
export const DIRECTIONS: readonly Direction[] = [
  "north",
  "south",
  "east",
  "west",
  "up",
  "down",
] as const;

// ─── Mood labels ────────────────────────────────────────────
export type MoodLabel = "furious" | "hostile" | "wary" | "warm" | "devoted";

export function moodToLabel(mood: number): MoodLabel {
  if (mood <= -60) return "furious";
  if (mood <= -20) return "hostile";
  if (mood <= 19) return "wary";
  if (mood <= 59) return "warm";
  return "devoted";
}

// ─── Location ───────────────────────────────────────────────
export type Location =
  | { kind: "room"; room: RoomId }
  | { kind: "inventory" }
  | { kind: "npc"; npc: NpcId }
  | { kind: "container"; room: RoomId; fixture: FixtureId }
  | { kind: "void" };

// ─── Actions ────────────────────────────────────────────────
export type Action =
  | { type: "go"; dir: Direction }
  | { type: "look" }
  | { type: "inventory" }
  | { type: "help" }
  | { type: "wait" }
  | { type: "examine"; target: string }
  | { type: "take"; item: ItemId }
  | { type: "drop"; item: ItemId }
  | { type: "open"; fixture: FixtureId; room?: RoomId }
  | { type: "use"; item: ItemId; target?: string }
  | { type: "give"; item: ItemId; npc: NpcId }
  | { type: "place"; item: ItemId; target: string }
  | { type: "talk"; npc: NpcId; topic?: string }
  | { type: "light"; item: ItemId };

// ─── Parse result ───────────────────────────────────────────
export type ParseResult =
  | { kind: "action"; action: Action }
  | { kind: "ambiguous"; options: string[] }
  | { kind: "unknown" };

// ─── Game events ────────────────────────────────────────────
export type GameEvent =
  | { type: "player_moved"; from: RoomId; to: RoomId; dir: Direction }
  | { type: "move_blocked"; dir: Direction; reason: string }
  | { type: "item_taken"; item: ItemId }
  | { type: "item_dropped"; item: ItemId; room: RoomId }
  | { type: "container_opened"; fixture: FixtureId; revealed: ItemId[] }
  | { type: "item_lit"; item: ItemId }
  | { type: "light_out"; item: ItemId }
  | { type: "flag_set"; flag: FlagId }
  | { type: "npc_mood_changed"; npc: NpcId; from: number; to: number }
  | { type: "npc_spoke"; npc: NpcId; hintId: HintId }
  | { type: "npc_gave"; npc: NpcId; item: ItemId }
  | { type: "room_salted"; room: RoomId }
  | { type: "ghost_moved"; npc: NpcId; from: RoomId; to: RoomId }
  | { type: "ghost_moved_item"; item: ItemId; from: RoomId; to: RoomId }
  | { type: "ghost_stole_item"; item: ItemId; droppedIn: RoomId }
  | { type: "examined"; target: string }
  | { type: "action_failed"; reason: string; code: string }
  | { type: "game_won" }
  | { type: "game_started" }
  | {
      type: "looked";
      room: RoomId;
      description: string;
      items: string[];
      npcs: string[];
      exits: string[];
    }
  | { type: "inventory_listed"; items: string[] }
  | { type: "help_shown" }
  | { type: "waited" }
  | { type: "interaction_applied"; id: string; successText: string };

// ─── PublicView ─────────────────────────────────────────────
export interface PublicView {
  gameId: string;
  turn: number;
  won: boolean;
  room: { id: RoomId; name: string; dark: boolean };
  exits: Array<{ dir: Direction; label: string; locked: boolean }>;
  visibleItems: Array<{ id: ItemId; name: string }>;
  inventory: Array<{ id: ItemId; name: string; lit?: boolean }>;
  npcsHere: Array<{ id: NpcId; name: string; moodLabel: MoodLabel }>;
  knownNpcs: Array<{ id: NpcId; name: string; moodLabel: MoodLabel }>;
  light: { lit: boolean; turnsLeft?: number };
  awayDigest: Array<{ tickId: string; text: string; at: number }>;
  pendingTick: boolean;
}

// ─── Narration facts ────────────────────────────────────────
export interface NarrationFacts {
  kind: "turn" | "tick" | "digest" | "talk";
  playerCommand?: string;
  room: { name: string; description: string; dark: boolean };
  events: Array<HumanFact>;
  visibleItems: string[];
  inventory: string[];
  npcsHere: Array<{ name: string; moodLabel: MoodLabel; personality: string }>;
  allowedHintText?: string;
  allowedEntityNames: string[];
  failed?: { code: string; reason: string };
}

export interface HumanFact {
  text: string;
  ids: string[];
}

// ─── Empty view ─────────────────────────────────────────────
export const EMPTY_VIEW: PublicView = {
  gameId: "",
  turn: 0,
  won: false,
  room: { id: "", name: "", dark: false },
  exits: [],
  visibleItems: [],
  inventory: [],
  npcsHere: [],
  knownNpcs: [],
  light: { lit: false },
  awayDigest: [],
  pendingTick: false,
};
