const urlArg = process.argv.find((arg) => arg.startsWith("--url="))?.slice(6) ?? process.env.DEPLOY_URL;
if (!urlArg) throw new Error("Usage: npm run smoke -- --url=https://example.workers.dev");

const base = urlArg.replace(/\/$/, "");
const health = await fetch(`${base}/api/health`);
if (!health.ok || !(await health.json()).ok) throw new Error(`Health check failed: ${health.status}`);

const wsUrl = `${base.replace(/^http/, "ws")}/agents/haunted-house-agent/smoke-${Date.now()}`;
const socket = new WebSocket(wsUrl);
await new Promise<void>((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error("WebSocket state timeout")), 5000);
  socket.addEventListener("message", () => { clearTimeout(timer); resolve(); }, { once: true });
  socket.addEventListener("error", () => { clearTimeout(timer); reject(new Error("WebSocket connection failed")); }, { once: true });
});
socket.close();
console.log(`Smoke passed: ${base}`);
