// Lexicon — verbs, directions, synonyms, entity aliases
import type { Direction } from "../shared/types";

/** Direction synonyms */
export const DIRECTION_SYNONYMS: Record<string, Direction> = {
  north: "north",
  n: "north",
  south: "south",
  s: "south",
  east: "east",
  e: "east",
  west: "west",
  w: "west",
  up: "up",
  u: "up",
  down: "down",
  d: "down",
};

/** Movement verbs */
export const MOVE_VERBS = new Set([
  "go",
  "walk",
  "move",
  "head",
  "run",
  "travel",
]);

/** Look verbs */
export const LOOK_VERBS = new Set(["look", "l"]);

/** Examine verbs */
export const EXAMINE_VERBS = new Set([
  "examine",
  "x",
  "inspect",
  "look at",
  "check",
  "study",
]);

/** Take verbs */
export const TAKE_VERBS = new Set(["take", "get", "grab", "pick up", "pick"]);

/** Drop verbs */
export const DROP_VERBS = new Set(["drop", "put down", "discard", "leave"]);

/** Open verbs */
export const OPEN_VERBS = new Set(["open"]);

/** Use verbs */
export const USE_VERBS = new Set(["use", "apply"]);

/** Give verbs */
export const GIVE_VERBS = new Set(["give", "offer", "hand"]);

/** Place verbs */
export const PLACE_VERBS = new Set(["place", "put", "set"]);

/** Talk verbs */
export const TALK_VERBS = new Set([
  "talk to",
  "speak to",
  "ask",
  "talk",
  "speak",
  "chat",
  "converse",
]);

/** Light verbs */
export const LIGHT_VERBS = new Set(["light", "ignite", "kindle"]);

/** Wind verbs */
export const WIND_VERBS = new Set(["wind", "turn", "crank"]);

/** Wait verbs */
export const WAIT_VERBS = new Set(["wait", "z", "rest", "pause"]);

/** Inventory verbs */
export const INV_VERBS = new Set(["inventory", "inv", "i"]);

/** Help verbs */
export const HELP_VERBS = new Set(["help", "?"]);

/** Articles to strip */
export const ARTICLES = new Set(["the", "a", "an", "some", "my"]);

/** Prepositions used in commands */
export const PREPOSITIONS = new Set([
  "on",
  "with",
  "in",
  "to",
  "at",
  "about",
  "from",
]);
