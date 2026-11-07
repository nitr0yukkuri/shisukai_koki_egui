import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

test("development CSP permits the React Refresh preamble", async () => {
  const sourceHtml = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const server = await createServer({
    configFile: fileURLToPath(new URL("../vite.config.ts", import.meta.url)),
    server: { middlewareMode: true },
    appType: "custom",
    logLevel: "silent",
  });

  try {
    const developmentHtml = await server.transformIndexHtml("/", sourceHtml);

    assert.match(
      developmentHtml,
      /script-src 'self' http:\/\/127\.0\.0\.1:5173 'unsafe-inline';/,
    );
    assert.match(
      developmentHtml,
      /connect-src 'self' http:\/\/127\.0\.0\.1:5173 ws:\/\/127\.0\.0\.1:5173;/,
    );
    assert.match(developmentHtml, /injectIntoGlobalHook\(window\)/);
    assert.match(sourceHtml, /script-src 'self';/);
    assert.match(sourceHtml, /connect-src 'self';/);
    assert.doesNotMatch(sourceHtml, /127\.0\.0\.1:5173|script-src[^;]*'unsafe-inline'/);
  } finally {
    await server.close();
  }
});
