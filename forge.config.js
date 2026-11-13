import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const escapedRoot = projectRoot.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const rootPrefix = `${escapedRoot}[\\\\/]`;
const rootEntry = (entry) => new RegExp(`^${rootPrefix}${entry}(?:[\\\\/]|$)`, "i");

export default {
  packagerConfig: {
    asar: true,
    arch: "x64",
    ignore: [
      new RegExp(`^${rootPrefix}\\.env(?:\\.[^\\\\/]+)?$`, "i"),
      ...[
        ".agents",
        ".github",
        "docs",
        "out",
        "public",
        "rtms",
        "src",
        "tests",
      ].map(rootEntry),
      ...[
        ".coderabbit.yaml",
        ".gitignore",
        ".nvmrc",
        "CONTRIBUTING.md",
        "Makefile",
        "README.en.md",
        "README.md",
        "eslint.config.js",
        "package-lock.json",
        "tsconfig.json",
        "vite.config.ts",
      ].map(rootEntry),
    ],
  },
  makers: [
    {
      name: "@electron-forge/maker-squirrel",
      platforms: ["win32"],
      config: {
        authors: "じょぶはん開発チーム",
        description: "面接・面談の練習と振り返りを支援するWindowsアプリ",
        name: "jobuhan",
        noMsi: true,
        setupExe: "Jobuhan-Setup.exe",
        title: "じょぶはん",
      },
    },
  ],
};
