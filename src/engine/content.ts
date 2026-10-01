// Content schema for house.json — validates game content
import { z } from "zod";

const DirectionSchema = z.enum([
  "north",
  "south",
  "east",
  "west",
  "up",
  "down",
]);

const ExitSchema = z.object({
  to: z.string(),
  lockedBy: z.string().optional(),
  requiresFlag: z.string().optional(),
  blockedText: z.string().default("The way is blocked."),
});

const FixtureSchema = z.object({
  name: z.string(),
  aliases: z.array(z.string()),
  description: z.string(),
  container: z
    .object({
      openable: z.boolean(),
      startsOpen: z.boolean(),
      contents: z.array(z.string()),
    })
    .optional(),
});

const RoomSchema = z.object({
  name: z.string(),
  description: z.string(),
  dark: z.boolean().optional(),
  exits: z.record(z.string(), ExitSchema),
  fixtures: z.record(z.string(), FixtureSchema),
  items: z.array(z.string()),
  ghostForbidden: z.boolean().optional(),
});

const ItemSchema = z.object({
  name: z.string(),
  aliases: z.array(z.string()),
  description: z.string(),
  takeable: z.boolean(),
  ghostMovable: z.boolean(),
  ghostStealable: z.boolean(),
  lightSource: z
    .object({
      turnsWhenLit: z.number(),
    })
    .optional(),
});

const HintSchema = z.object({
  id: z.string(),
  minMood: z.number(),
  requiresFlags: z.array(z.string()).optional(),
  text: z.string(),
});

const TopicSchema = z.object({
  moodDelta: z.number(),
  once: z.boolean(),
  hintId: z.string().optional(),
});

const NpcSchema = z.object({
  name: z.string(),
  aliases: z.array(z.string()),
  kind: z.enum(["ghost", "human", "spirit"]),
  startRoom: z.string(),
  roams: z.boolean(),
  startMood: z.number(),
  personality: z.string(),
  hints: z.array(HintSchema),
  topics: z.record(z.string(), TopicSchema),
});

const EffectSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("setFlag"), flag: z.string(), value: z.boolean() }),
  z.object({ type: z.literal("moodDelta"), npc: z.string(), delta: z.number() }),
  z.object({ type: z.literal("moveItem"), item: z.string(), to: z.string() }),
  z.object({ type: z.literal("npcGives"), npc: z.string(), item: z.string() }),
  z.object({ type: z.literal("lightItem"), item: z.string() }),
  z.object({
    type: z.literal("revealContainer"),
    room: z.string(),
    fixture: z.string(),
  }),
  z.object({ type: z.literal("moveNpc"), npc: z.string(), to: z.string() }),
  z.object({ type: z.literal("win") }),
]);

const InteractionSchema = z.object({
  id: z.string(),
  verb: z.enum(["use", "give", "open", "light", "wind", "place"]),
  subject: z.string(),
  target: z.string().optional(),
  room: z.string().optional(),
  requiresFlags: z.array(z.string()).optional(),
  requiresNpcMoodAtLeast: z
    .object({ npc: z.string(), mood: z.number() })
    .optional(),
  effects: z.array(EffectSchema),
  successText: z.string(),
});

const EndingSchema = z.object({
  requiresFlags: z.array(z.string()),
  room: z.string(),
  text: z.string(),
});

export const ContentSchema = z.object({
  version: z.literal(1),
  title: z.string(),
  startRoom: z.string(),
  rooms: z.record(z.string(), RoomSchema),
  items: z.record(z.string(), ItemSchema),
  npcs: z.record(z.string(), NpcSchema),
  interactions: z.array(InteractionSchema),
  ending: EndingSchema,
});

export type Content = z.infer<typeof ContentSchema>;
export type Room = z.infer<typeof RoomSchema>;
export type Item = z.infer<typeof ItemSchema>;
export type Npc = z.infer<typeof NpcSchema>;
export type Interaction = z.infer<typeof InteractionSchema>;
export type Exit = z.infer<typeof ExitSchema>;
export type Fixture = z.infer<typeof FixtureSchema>;
export type Effect = z.infer<typeof EffectSchema>;

/** Load and validate content */
export function loadContent(raw: unknown): Content {
  return ContentSchema.parse(raw);
}
