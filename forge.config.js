const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const rootEntry = (entry) => new RegExp("^[/\\\\]" + escapeRegExp(entry) + "(?:[/\\\\]|$)", "i");
const envFile = new RegExp("^[/\\\\]\\.env(?:\\.[^/\\\\]+)?$", "i");

export default {
  packagerConfig: {
    asar: true,
    arch: "x64",
    ignore: [
      envFile,
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
