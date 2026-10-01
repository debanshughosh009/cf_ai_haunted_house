// Generate docs/CONTENT.md with room map & puzzle dependency chain
import * as fs from "node:fs";
import * as path from "node:path";
import { loadContent } from "../src/engine/content";

const CONTENT_FILE = path.resolve(import.meta.dirname, "../content/house.json");
const DOCS_DIR = path.resolve(import.meta.dirname, "../docs");
const OUTPUT_FILE = path.join(DOCS_DIR, "CONTENT.md");

function generate() {
  const raw = JSON.parse(fs.readFileSync(CONTENT_FILE, "utf-8"));
  const content = loadContent(raw);

  if (!fs.existsSync(DOCS_DIR)) {
    fs.mkdirSync(DOCS_DIR, { recursive: true });
  }

  let doc = `# Manor Content & Puzzle Dependency Map\n\n`;
  doc += `> Auto-generated from \`content/house.json\` by \`scripts/gen-content-doc.ts\`.\n\n`;

  // 1. Room connectivity diagram
  doc += `## 1. Room Map\n\n\`\`\`mermaid\ngraph TD\n`;
  const drawnEdges = new Set<string>();

  for (const [roomId, room] of Object.entries(content.rooms)) {
    for (const [dir, exit] of Object.entries(room.exits)) {
      const edgeKey = [roomId, exit.to].sort().join("<->");
      if (!drawnEdges.has(edgeKey)) {
        drawnEdges.add(edgeKey);
        let label = dir;
        if (exit.lockedBy) label += ` [Locked: ${exit.lockedBy}]`;
        if (exit.requiresFlag) label += ` [Req: ${exit.requiresFlag}]`;
        doc += `  ${roomId}["${room.name}"] ---|${label}| ${exit.to}["${content.rooms[exit.to]?.name ?? exit.to}"]\n`;
      }
    }
  }
  doc += `\`\`\`\n\n`;

  // 2. Items table
  doc += `## 2. Items\n\n`;
  doc += `| ID | Name | Takeable | Movable | Stealable | Notes |\n`;
  doc += `|---|---|---|---|---|---|\n`;
  for (const [id, item] of Object.entries(content.items)) {
    const notes = item.lightSource
      ? `Light source (${item.lightSource.turnsWhenLit} turns)`
      : "-";
    doc += `| \`${id}\` | ${item.name} | ${item.takeable ? "✓" : "✗"} | ${item.ghostMovable ? "✓" : "✗"} | ${item.ghostStealable ? "✓" : "✗"} | ${notes} |\n`;
  }
  doc += `\n`;

  // 3. Puzzle Dependency Chain
  doc += `## 3. Puzzle Dependency Chain\n\n\`\`\`mermaid\ngraph LR\n`;
  doc += `  matches[Take Matches] --> lightCandle[Light Candle]\n`;
  doc += `  lightCandle --> cellarAccess[Access Dark Cellar]\n`;
  doc += `  bookshelf[Open Bookshelf] --> journalPage[Take Journal Page]\n`;
  doc += `  journalPage --> giveHale[Give Journal Page to Hale]\n`;
  doc += `  giveHale --> ironKey[Receive Iron Key]\n`;
  doc += `  ironKey --> unlockCrypt[Unlock Crypt Gate]\n`;
  doc += `  flowerpot[Search Flowerpot] --> windingKey[Take Winding Key]\n`;
  doc += `  nursery[Take Music Box] --> windBox[Wind Music Box with Key]\n`;
  doc += `  trunk[Open Attic Trunk] --> locket[Take Silver Locket]\n`;
  doc += `  cellarAccess --> enterCrypt[Enter Crypt]\n`;
  doc += `  unlockCrypt --> enterCrypt\n`;
  doc += `  windBox --> playMusic[Play Music Box in Crypt]\n`;
  doc += `  enterCrypt --> playMusic\n`;
  doc += `  playMusic --> eleanorArrives[Eleanor Enters Crypt]\n`;
  doc += `  locket --> placeLocket[Place Locket on Coffin]\n`;
  doc += `  eleanorArrives --> placeLocket\n`;
  doc += `  placeLocket --> win([Game Won: Eleanor at Rest])\n`;
  doc += `\`\`\`\n\n`;

  // 4. Canonical Walkthrough
  doc += `## 4. Canonical Walkthrough (26 Turns)\n\n`;
  doc += `1. \`go north\` (Library)\n`;
  doc += `2. \`take matches\`\n`;
  doc += `3. \`open bookshelf\`\n`;
  doc += `4. \`take journal page\`\n`;
  doc += `5. \`go west\` (Conservatory)\n`;
  doc += `6. \`take winding key\`\n`;
  doc += `7. \`go east\`\n`;
  doc += `8. \`go south\` (Foyer)\n`;
  doc += `9. \`give journal page to hale\` (Receives Iron Key)\n`;
  doc += `10. \`go east\` (Kitchen)\n`;
  doc += `11. \`take candle\`\n`;
  doc += `12. \`light candle\` (Candle lit for 30 turns)\n`;
  doc += `13. \`go west\`\n`;
  doc += `14. \`go up\` (Nursery)\n`;
  doc += `15. \`take music box\`\n`;
  doc += `16. \`wind music box\`\n`;
  doc += `17. \`go up\` (Attic)\n`;
  doc += `18. \`open trunk\`\n`;
  doc += `19. \`take locket\`\n`;
  doc += `20. \`go down\`\n`;
  doc += `21. \`go down\` (Foyer)\n`;
  doc += `22. \`go east\` (Kitchen)\n`;
  doc += `23. \`go down\` (Cellar, lit)\n`;
  doc += `24. \`go north\` (Crypt, gate unlocked with iron key)\n`;
  doc += `25. \`use music box\` (Eleanor called to crypt)\n`;
  doc += `26. \`place locket on coffin\` (Eleanor at rest - WIN)\n`;

  fs.writeFileSync(OUTPUT_FILE, doc, "utf-8");
  console.log(`✅ Generated ${OUTPUT_FILE}`);
}

generate();
