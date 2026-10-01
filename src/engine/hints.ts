// Hints selection for NPCs
import type { Npc } from "./content";
import type { HintId, FlagId } from "../shared/types";

export interface NpcHintState {
  mood: number;
  lastHintId?: HintId;
}

export interface HintSelection {
  id: HintId;
  text: string;
}

/**
 * Select the allowed hint for an NPC.
 * Selects highest-index hint where minMood <= mood and all required flags are true.
 */
export function selectHint(
  npcDef: Npc,
  npcState: NpcHintState,
  flags: Record<FlagId, boolean>
): HintSelection | undefined {
  if (!npcDef.hints || npcDef.hints.length === 0) return undefined;

  let best: HintSelection | undefined;

  for (const hint of npcDef.hints) {
    if (npcState.mood < hint.minMood) continue;

    if (hint.requiresFlags && hint.requiresFlags.length > 0) {
      const satisfied = hint.requiresFlags.every((f) => flags[f] === true);
      if (!satisfied) continue;
    }

    best = { id: hint.id, text: hint.text };
  }

  return best;
}
