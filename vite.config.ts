import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const developmentCsp: Plugin = {
  name: "jobuhan-development-csp",
  transformIndexHtml: {
    order: "post",
    handler(html, context) {
      if (!context.server) {
        return html;
      }

      const scriptPolicy = "script-src 'self' http://127.0.0.1:5173;";
      if (!html.includes(scriptPolicy)) {
        throw new Error("開発用Content Security Policyが見つかりません。");
      }

      return html.replace(
        scriptPolicy,
        "script-src 'self' http://127.0.0.1:5173 'unsafe-inline';",
      );
    },
  },
};

export default defineConfig({
  base: "./",
  plugins: [react(), developmentCsp],
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
  },
});
