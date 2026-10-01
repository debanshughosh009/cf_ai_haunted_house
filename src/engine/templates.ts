// Templates — deterministic fallback narration
// Pure TypeScript — no Cloudflare imports
import type { Content } from "./content";
import type { GameEvent } from "../shared/types";

export function renderEventTemplate(event: GameEvent, content: Content): string {
  switch (event.type) {
    case "player_moved": {
      const room = content.rooms[event.to];
      return `You move ${event.dir} into ${room?.name ?? "another room"}.`;
    }
    case "move_blocked":
      return `You cannot go ${event.dir}. ${event.reason}`;
    case "item_taken": {
      const item = content.items[event.item];
      return `You take the ${item?.name ?? event.item}.`;
    }
    case "item_dropped": {
      const item = content.items[event.item];
      return `You drop the ${item?.name ?? event.item}.`;
    }
    case "container_opened": {
      const revealedNames = event.revealed
        .map((id) => content.items[id]?.name ?? id)
        .join(", ");
      return revealedNames
        ? `You open the ${event.fixture}. Inside you find: ${revealedNames}.`
        : `You open the ${event.fixture}. It is empty.`;
    }
    case "item_lit": {
      const item = content.items[event.item];
      return `You light the ${item?.name ?? event.item}.`;
    }
    case "light_out": {
      const item = content.items[event.item];
      return `The ${item?.name ?? event.item} burns down and flickers out.`;
    }
    case "flag_set":
      return `Something shifts in the quiet air of the manor.`;
    case "npc_mood_changed": {
      const npc = content.npcs[event.npc];
      return `${npc?.name ?? event.npc}'s expression tightens with shifting emotion.`;
    }
    case "npc_spoke": {
      const npc = content.npcs[event.npc];
      const hint = npc?.hints.find((h) => h.id === event.hintId);
      return `${npc?.name ?? event.npc} speaks: "${hint?.text ?? "..."}"`;
    }
    case "npc_gave": {
      const npc = content.npcs[event.npc];
      const item = content.items[event.item];
      return `${npc?.name ?? event.npc} hands you the ${item?.name ?? event.item}.`;
    }
    case "room_salted":
      return `You scatter coarse ritual salt across the threshold. The air hums with warding magic.`;
    case "ghost_moved": {
      const toRoom = content.rooms[event.to];
      return `A spectral chill drafts through the hall as the ghost wanders into ${toRoom?.name ?? "the darkness"}.`;
    }
    case "ghost_moved_item": {
      const item = content.items[event.item];
      return `A whisper of cold air rustled nearby. The ${item?.name ?? "object"} has been moved.`;
    }
    case "ghost_stole_item": {
      const item = content.items[event.item];
      return `A sudden icy chill chills your marrow! The ghost plucked the ${item?.name ?? "item"} from your possession!`;
    }
    case "examined":
      return `You closely examine the ${event.target}.`;
    case "action_failed":
      return event.reason;
    case "game_won":
      return `The curse on Blackwood Manor is lifted. Eleanor rests in peace at last.`;
    case "game_started":
      return `You step into the foyer of Blackwood Manor. Behind you, the heavy oak doors slam shut with finality.`;
    case "looked": {
      let desc = event.description;
      if (event.items.length > 0) {
        desc += ` Visible items: ${event.items.join(", ")}.`;
      }
      if (event.npcs.length > 0) {
        desc += ` Present: ${event.npcs.join(", ")}.`;
      }
      if (event.exits.length > 0) {
        desc += ` Exits: ${event.exits.join(", ")}.`;
      }
      return desc;
    }
    case "inventory_listed":
      return event.items.length > 0
        ? `You are carrying: ${event.items.join(", ")}.`
        : `Your pockets are empty.`;
    case "help_shown":
      return `Commands: go <direction> (n, s, e, w, u, d), look, inventory, take <item>, drop <item>, examine <target>, open <fixture>, light <item>, use <item> [on <target>], give <item> to <npc>, place <item> on <target>, talk to <npc> [about <topic>], wait, help, new game.`;
    case "waited":
      return `You stand motionless. Time slips past in the cold silence.`;
    case "interaction_applied":
      return event.successText;
    default:
      return "Something happens in the house.";
  }
}

/** Render a list of events into a coherent narrative paragraph */
export function renderEventsParagraph(events: GameEvent[], content: Content): string {
  if (events.length === 0) return "Nothing happens.";
  return events.map((e) => renderEventTemplate(e, content)).join(" ");
}
