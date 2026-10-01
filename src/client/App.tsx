import { useState } from "react";
import { useAgent } from "agents/react";
import { useAgentChat } from "@cloudflare/ai-chat/react";
import type { PublicView } from "../shared/types";

const playerId = localStorage.getItem("haunted-player") ?? crypto.randomUUID();
localStorage.setItem("haunted-player", playerId);

export default function App() {
  const [view, setView] = useState<PublicView | null>(null);
  const agent = useAgent<PublicView>({ agent: "haunted-house-agent", name: playerId, onStateUpdate: setView });
  const { messages, sendMessage, status } = useAgentChat({ agent });
  const [input, setInput] = useState("");
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!input.trim()) return;
    sendMessage({ role: "user", parts: [{ type: "text", text: input }] });
    setInput("");
  };
  return <main>
    <section className="chat"><header><p className="eyebrow">BLACKWOOD MANOR</p><h1>The Haunted House</h1><p>The house remembers what you do.</p></header>
      <div className="log" aria-live="polite">{messages.map((message) => <article className={message.role} key={message.id}><b>{message.role === "user" ? ">" : "DM"}</b><span>{message.parts.filter((part) => part.type === "text").map((part) => part.text).join("")}</span></article>)}</div>
      <form onSubmit={submit}><input aria-label="Command" value={input} onChange={(event) => setInput(event.target.value)} placeholder="go east, take the candle..." disabled={status === "streaming"} /><button type="submit">Send</button></form>
    </section>
    <aside><p className="eyebrow">AUTHORITATIVE STATE</p><h2>{view?.room.name ?? "Entering..."}</h2><p>{view?.room.dark ? "The dark hides the room." : "You can see the room clearly."}</p><h3>Exits</h3><p>{view?.exits.map((exit) => exit.dir).join(" · ") || "..."}</p><h3>Inventory</h3><p>{view?.inventory.map((item) => item.name).join(", ") || "Empty"}</p><p className="turn">Turn {view?.turn ?? 0}</p></aside>
  </main>;
}
