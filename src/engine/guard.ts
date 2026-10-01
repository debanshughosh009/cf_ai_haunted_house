// Narration guard — guard.ts
// Pure TypeScript — unit-tested
// Validates that LLM narration does not hallucinate entities, leak mechanics, or contradict engine facts.
import type { Content } from "./content";
import type { NarrationFacts } from "../shared/types";

export interface GuardResult {
  ok: boolean;
  violations: string[];
}

/** Extract all entity names, aliases, and room names in the game */
export function getAllGameEntities(content: Content): Set<string> {
  const names = new Set<string>();

  for (const room of Object.values(content.rooms)) {
    names.add(room.name.toLowerCase());
    for (const fixture of Object.values(room.fixtures)) {
      names.add(fixture.name.toLowerCase());
      for (const a of fixture.aliases) names.add(a.toLowerCase());
    }
  }

  for (const item of Object.values(content.items)) {
    names.add(item.name.toLowerCase());
    for (const a of item.aliases) names.add(a.toLowerCase());
  }

  for (const npc of Object.values(content.npcs)) {
    names.add(npc.name.toLowerCase());
    for (const a of npc.aliases) names.add(a.toLowerCase());
  }

  return names;
}

/** Check narration against facts and content rules */
export function guardNarration(
  narration: string,
  facts: NarrationFacts,
  content: Content
): GuardResult {
  const violations: string[] = [];
  const text = narration.toLowerCase();

  // 1. Check for mechanics leak: "json", "id", "facts"
  if (/\b(json|id|facts)\b/i.test(narration)) {
    violations.push("Mentions internal mechanics keywords (json, id, facts).");
  }

  // 2. Check for digits (mechanics leak / numbers)
  // Exception: words like "one", "two" are okay, but numeric digits 0-9 leak numbers
  if (/\d+/.test(narration)) {
    violations.push("Contains numeric digits (game mechanics leak).");
  }

  // 3. Check for forbidden entity names
  const allEntities = getAllGameEntities(content);
  const allowedSet = new Set(facts.allowedEntityNames.map((s) => s.toLowerCase()));

  for (const entity of allEntities) {
    // Skip short words like "key" or "salt" if they are parts of allowed names
    if (allowedSet.has(entity)) continue;

    // Check if the forbidden entity name is mentioned as a standalone phrase/word
    // Escape regex special chars
    const escaped = entity.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}s?\\b`, "i");

    if (regex.test(text)) {
      violations.push(`Mentions forbidden/unseen entity: "${entity}".`);
    }
  }

  // 4. Direction hallucination check:
  // Regex: \b(door|passage|stair\w*|exit|archway|path)\b.{0,30}\b(north|south|east|west|up|down)\b
  // Check if mentioned direction is in allowedEntityNames
  const directionRegex =
    /\b(door|passage|stair\w*|exit|archway|path)\b.{0,30}\b(north|south|east|west|up|down)\b/gi;
  let match: RegExpExecArray | null;
  while ((match = directionRegex.exec(narration)) !== null) {
    const dir = match[2]?.toLowerCase();
    if (dir && !allowedSet.has(dir)) {
      violations.push(`Mentions non-existent exit direction: "${dir}".`);
    }
  }

  // 5. Contradiction check: if an action failed, ensure narration doesn't falsely claim success
  if (facts.failed) {
    const successPhrases = [
      /\byou take\b/i,
      /\byou pick up\b/i,
      /\byou grab\b/i,
      /\byou successfully\b/i,
      /\byou open the\b/i,
      /\byou unlock\b/i,
    ];
    for (const phrase of successPhrases) {
      if (phrase.test(narration)) {
        violations.push(`Claims action succeeded when it failed with code "${facts.failed.code}".`);
        break;
      }
    }
  }

  return {
    ok: violations.length === 0,
    violations,
  };
}
