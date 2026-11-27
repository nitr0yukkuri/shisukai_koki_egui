import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";

const developmentCsp: Plugin = {
  name: "jobuhan-development-csp",
  transformIndexHtml: {
    order: "post",
    handler(html, context) {
      if (!context.server) {
        return html;
      }

      const scriptPolicy = "script-src 'self';";
      const connectionPolicy = html.match(/connect-src 'self'(?: stun:)?;/u)?.[0];
      if (!html.includes(scriptPolicy) || !connectionPolicy) {
        throw new Error("開発用Content Security Policyが見つかりません。");
      }

      return html.replace(
        scriptPolicy,
        "script-src 'self' http://127.0.0.1:5173 'unsafe-inline';",
      ).replace(
        connectionPolicy,
        "connect-src 'self' stun: http://127.0.0.1:5173 ws://127.0.0.1:5173;",
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
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, "index.html"),
        join: resolve(import.meta.dirname, "join.html"),
      },
    },
  },
});
