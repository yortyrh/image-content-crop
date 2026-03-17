# Image Content Crop

CLI to crop images to their content area by removing margins. Presets are defined in a YAML config file; you can also set margins via command-line options. Use it for any workflow that needs consistent image cropping (e.g. stripping headers, footers, or page numbers).

## Requirements

- Node.js 18+
- Build once before using: `npm run build`

## Development

- **Lint**: `npm run lint` (Biome)
- **Format**: `npm run format` or `npm run check` (Biome format + lint with auto-fix)
- **Unit tests**: `npm run test` (watch) or `npm run test:run` (single run). Test files sit next to the source (e.g. `src/crop.test.ts`).
- **Typecheck**: `npm run typecheck`

## Installation

**Local (clone or download):**

```bash
npm install
npm run build
```

**Run with npx (no install):**

```bash
npx image-content-crop --help
npx image-content-crop batch -s ./my-images -d ./cropped -p a
```

If you publish this package to npm, anyone can run it with:

```bash
npx image-content-crop <command> [options]
```

## Configuration (YAML)

Config file is resolved in this order (first existing file wins):

1. **Current directory**: `./crop-config.yaml`
2. **User home**: `~/.config/image-content-crop/crop-config.yaml`
3. **Project default**: the `crop-config.yaml` shipped with the package

Use `--config <path>` to force a specific file. Presets in the file define margin ratios (0–1) or pixel values.

Example `crop-config.yaml`:

```yaml
presets:
  a:
    marginLeft: 0.10
    marginRight: 0.10
    marginBottom: 0.14
    marginTop: 0
  b:
    marginLeft: 0.10
    marginRight: 0.10
    marginBottom: 0.10
    marginTop: 0
```

- **marginLeft / marginRight / marginTop / marginBottom**: ratio 0–1 (e.g. 0.10 = 10%), or pixels if you set `marginsInPixels: true` in the preset.
- Preset names are arbitrary (e.g. `a`, `b`); use `--preset <name>` to apply one.

## CLI usage

### Single file

**With `single` subcommand:**

```bash
npx image-content-crop single --source path/to/image.png --dest path/to/out.png
npx image-content-crop single -s input.png -d output.png

# With a preset from config
npx image-content-crop single -s input.png -d output.png -p a

# With custom config file
npx image-content-crop single -s input.png -d output.png -c ./my-crop-config.yaml -p my-preset
```

**Short form (no subcommand):**

```bash
npx image-content-crop --src input.png --out output.png
```

### Batch (whole directory)

Default directories are **`in`** (source) and **`out`** (destination).

```bash
# Default: reads from "in", writes to "out"
npx image-content-crop batch

# Presets A and B (e.g. in/A → out/A, in/B → out/B)
npx image-content-crop batch -s in/A -d out/A -p a
npx image-content-crop batch -s in/B -d out/B -p b

# Custom dirs and preset
npx image-content-crop batch --source-dir ./images --dest-dir ./cropped --preset a
npx image-content-crop batch -s ./images -d ./cropped -p b -c ./crop-config.yaml
```

**npm scripts** (from project root; they use **sample-data** by default):

- `npm run crop:a` — batch crop `sample-data/in/A` → `sample-data/out/A` with preset **a**
- `npm run crop:b` — batch crop `sample-data/in/B` → `sample-data/out/B` with preset **b**
- `npm run crop` — run the CLI (help and ad‑hoc commands)

### Margin options (override preset or use without preset)

You can override any preset with:

- `-l, --margin-left <n>` — left margin (0–1 ratio, or pixels if `--margins-in-pixels`)
- `-t, --margin-top <n>` — top margin
- `-r, --margin-right <n>` — right margin (default 0.06)
- `-b, --margin-bottom <n>` — bottom margin (default 0.14)
- `--margins-in-pixels` — treat all margins as pixel values

Example (more crop on right and bottom):

```bash
npx image-content-crop single -s page.png -d out.png -r 0.08 -b 0.16
```

## Expected layout

- **Source directory**: any folder (default **`in`** for batch).
- **Output directory**: any folder (default **`out`** for batch).
- **Supported formats**: `.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`.

Example with two presets (A and B): the **sample-data** folder uses `sample-data/in/A`, `sample-data/in/B` and `sample-data/out/A`, `sample-data/out/B`. From the project root, `npm run crop:a` and `npm run crop:b` process that folder. For your own data, use `in/` and `out/` at the project root (or pass `-s` / `-d`).

Config is resolved from current dir, then HOME, then project default (see above), unless you pass `-c` / `--config`.

## Publishing to NPM (GitHub-hosted)

To publish this CLI to the npm registry with the repo on GitHub:

1. **GitHub**
   - The project is configured for [github.com/yortyrh/image-content-crop](https://github.com/yortyrh/image-content-crop). To use another repo, update `repository`, `homepage`, and `bugs.url` in `package.json`.

2. **NPM**
   - Create an account at [npmjs.com](https://www.npmjs.com/signup) if needed.
   - Log in: `npm login`.
   - From the project root, run:
     - `npm run build`
     - `npm publish`
   - If the package name `image-content-crop` is taken, use a scoped name (e.g. `@your-username/image-content-crop`) and publish with `npm publish --access public`.

3. **After publishing**
   - Anyone can run: `npx image-content-crop --help` or `npx image-content-crop batch -s ./in -d ./out -p a`.
   - `prepublishOnly` runs `npm run build` before each publish so the built `dist/` is up to date.

### Deploying a new version (after pushing changes)

Releases are published to npm automatically via **GitHub Actions** when you push a **version tag**.

1. **One-time setup** (if not done yet)  
   In the repo: **Settings → Secrets and variables → Actions**. Add a secret **`NPM_TOKEN`** with an [npm access token](https://www.npmjs.com/settings/~/tokens) that has **Publish** permission (automation or classic token).

2. **For each release**
   - Update the `version` field in `package.json` (e.g. `1.0.1`). The tag and `package.json` version must match.
   - Commit and push:
     ```bash
     git add package.json
     git commit -m "chore: release v1.0.1"
     git push origin main
     ```
   - Create and push a tag (use the same version as in `package.json`):
     ```bash
     git tag v1.0.1
     git push origin v1.0.1
     ```
   - The **Publish to npm** workflow will run: it typechecks, builds, and publishes to npm. Check the **Actions** tab on GitHub for status.
