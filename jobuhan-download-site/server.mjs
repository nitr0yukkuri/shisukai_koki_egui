import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL(".", import.meta.url)));
const port = Number(process.env.PORT || 4173);
const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".exe": "application/vnd.microsoft.portable-executable",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

const server = createServer((request, response) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url || "/", "http://localhost").pathname);
  } catch {
    response.writeHead(400).end("Bad request");
    return;
  }

  if (pathname === "/") pathname = "/index.html";
  const target = resolve(root, "." + pathname);
  if (target !== root && !target.startsWith(root + sep)) {
    response.writeHead(403).end("Forbidden");
    return;
  }
  if (!existsSync(target) || !statSync(target).isFile()) {
    response.writeHead(404, { "Cache-Control": "no-store" }).end("Not found");
    return;
  }

  const extension = extname(target).toLowerCase();
  response.writeHead(200, {
    "Cache-Control": "no-store",
    "Content-Type": contentTypes[extension] || "application/octet-stream",
    ...(extension === ".exe"
      ? { "Content-Disposition": 'attachment; filename="jobuhan-setup.exe"' }
      : {}),
  });
  if (request.method === "HEAD") {
    response.end();
  } else {
    createReadStream(target).pipe(response);
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log("じょぶはん ダウンロードサイト: http://127.0.0.1:" + port);
});
