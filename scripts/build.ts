import { mkdir, rm, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"

export function renderHtmlDocument(title: string, scriptName: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>
      :root {
        color-scheme: light;
        font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      body {
        margin: 0;
        background: #f5f7fb;
        color: #1f2937;
      }
      #app {
        min-height: 100vh;
      }
    </style>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="./${scriptName}"></script>
  </body>
</html>
`
}

async function buildEntry(entrypoint: string, outfile: string) {
  const result = await Bun.build({
    entrypoints: [entrypoint],
    outdir: dirname(outfile),
    target: "browser",
    format: "esm",
    sourcemap: "external",
    minify: false,
  })

  if (!result.success) {
    const logs = result.logs.map((item) => item.message).join("\n")
    throw new Error(logs || `Build failed for ${entrypoint}`)
  }
}

async function writeTextFile(path: string, contents: string) {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, contents, "utf8")
}

export async function buildExtension() {
  const distDir = join(import.meta.dir, "..", "dist")
  await rm(distDir, { recursive: true, force: true })
  await mkdir(distDir, { recursive: true })

  await buildEntry(join(import.meta.dir, "..", "src/background/index.ts"), join(distDir, "background", "index.js"))
  await buildEntry(join(import.meta.dir, "..", "src/content/index.ts"), join(distDir, "content", "index.js"))
  await buildEntry(join(import.meta.dir, "..", "src/popup/index.ts"), join(distDir, "popup", "index.js"))
  await buildEntry(join(import.meta.dir, "..", "src/options/index.ts"), join(distDir, "options", "index.js"))

  await writeTextFile(
    join(distDir, "popup.html"),
    renderHtmlDocument("Deeting Browser Agent", "popup/index.js")
  )
  await writeTextFile(
    join(distDir, "options.html"),
    renderHtmlDocument("Deeting Browser Agent Settings", "options/index.js")
  )
}

if (import.meta.main) {
  await buildExtension()
  console.info("Built Deeting Browser Agent into dist/")
}
