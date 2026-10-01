import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import agents from "agents/vite";

export default defineConfig(({ mode }) => ({
  plugins: [
    agents(),
    react(),
    cloudflare({
      configPath:
        mode === "development" && process.env.MOCK_LLM !== "0"
          ? "./wrangler.local.jsonc"
          : "./wrangler.jsonc",
      remoteBindings: false,
    }),
    tailwindcss(),
  ],
  build: { minify: false },
}));
