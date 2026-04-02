# Image Content Crop

CLI to crop images to their content area by removing margins — and optionally post-process the cropped result with **Google Gemini** (image generation). Presets are defined in a YAML config file; margins and Gemini prompts can also be set via command-line options.

Use it for any workflow that needs consistent image cropping (e.g. stripping headers, footers, or page numbers) with an optional AI-powered editing pass.

## Requirements

- Node.js 20+
- Build once before using: `npm run build`

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

### Config file resolution

Config files are resolved in the following order (first existing file wins). At each location, a **local override** file is checked first:

1. **Current directory**: `./crop-config.local.yaml` → `./crop-config.yaml`
2. **User home**: `~/.config/image-content-crop/crop-config.local.yaml` → `~/.config/image-content-crop/crop-config.yaml`
3. **Package default**: the `crop-config.yaml` shipped with the package

Use `--config <path>` to force a specific file.

The `crop-config.local.yaml` file is **gitignored** by default — use it for personal overrides (custom prompts, project-specific margins) without affecting the shared config.

### Preset format

Presets define margin ratios (0–1) or pixel values, and optional Gemini post-processing settings.

```yaml
# Global Gemini settings (optional).
# Requires GEMINI_API_KEY env var. Model can be overridden per preset.
gemini:
  model: gemini-2.5-flash-image

presets:
  a:
    marginLeft: 0.10
    marginRight: 0.10
    marginBottom: 0.14
    marginTop: 0.12
    # Per-preset Gemini processing (optional).
    # Sends cropped image + prompt to Gemini for editing.
    # Use --no-gemini to skip at runtime.
    # gemini:
    #   prompt: "Recreate this image with a fresh clean look"
    #   model: gemini-2.5-flash-image   # optional, overrides global
  b:
    marginLeft: 0.10
    marginRight: 0.10
    marginBottom: 0.10
    marginTop: 0.12
```

- **marginLeft / marginRight / marginTop / marginBottom**: ratio 0–1 (e.g. 0.10 = 10%), or pixels if you set `marginsInPixels: true` in the preset.
- **gemini.prompt** (per preset): when present, the cropped image is sent to Gemini with this prompt. Omit to skip Gemini for the preset.
- **gemini.model** (per preset, optional): overrides the global model for this preset.
- Preset names are arbitrary (e.g. `a`, `b`, `sample`); use `--preset <name>` to apply one.

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
- `npm run crop:sample` — batch crop `sample-data/in/sample` → `sample-data/out/sample` with preset **sample**
- `npm run crop` — run the CLI (help and ad-hoc commands)

### Margin options (override preset or use without preset)

You can override any preset margin with:

- `-l, --margin-left <n>` — left margin (0–1 ratio, or pixels if `--margins-in-pixels`)
- `-t, --margin-top <n>` — top margin
- `-r, --margin-right <n>` — right margin (default 0.06)
- `-b, --margin-bottom <n>` — bottom margin (default 0.14)
- `--margins-in-pixels` — treat all margins as pixel values

Example (more crop on right and bottom):

```bash
npx image-content-crop single -s page.png -d out.png -r 0.08 -b 0.16
```

## Gemini integration (optional)

After cropping, images can be sent to **Google Gemini** for AI-powered post-processing (e.g. de-identifying content, refreshing visuals). This step is optional and disabled by default.

### Setup

1. Set the `GEMINI_API_KEY` environment variable (or add it to a `.env` file at the project root — the CLI loads `dotenv` automatically).

2. Add a `gemini` block to your preset in the config file:

```yaml
gemini:
  model: gemini-2.5-flash-image    # global default model

presets:
  my-preset:
    marginLeft: 0.10
    marginRight: 0.10
    marginBottom: 0.14
    marginTop: 0.12
    gemini:
      prompt: "Replace photos with different generic scenes; keep all text unchanged."
      model: gemini-2.5-flash-image   # optional, overrides global
```

### CLI options

These options are available on both `single` and `batch` subcommands:

| Option | Description |
|---|---|
| `--no-gemini` | Skip Gemini processing even if the preset configures it |
| `--gemini-prompt <text>` | Override the Gemini prompt from the preset |
| `--gemini-interval-ms <n>` | Batch only: minimum ms between Gemini API calls (default 2000) |

Examples:

```bash
# Crop + Gemini with preset
npx image-content-crop single -s input.png -d output.png -p sample

# Crop only (skip Gemini even if preset has it)
npx image-content-crop batch -s in/A -d out/A -p a --no-gemini

# Override prompt from command line
npx image-content-crop single -s input.png -d output.png --gemini-prompt "Make colors brighter"

# Batch with faster pacing (500ms between API calls)
npx image-content-crop batch -s in/A -d out/A -p a --gemini-interval-ms 500
```

### Retry and timeout behaviour

Gemini API calls are retried automatically with exponential backoff and jitter on:

- HTTP 429 (rate limit)
- HTTP 5xx (server errors)
- Transient network errors (`ECONNRESET`, `ETIMEDOUT`, `EAI_AGAIN`)

### Environment variables

| Variable | Default | Description |
|---|---|---|
| `GEMINI_API_KEY` | *(required)* | Google Gemini API key |
| `GEMINI_HTTP_TIMEOUT_MS` | `300000` (5 min) | HTTP timeout per Gemini request |
| `GEMINI_RETRY_MAX_ATTEMPTS` | `5` | Maximum number of retry attempts |
| `GEMINI_RETRY_INITIAL_MS` | `1000` | Initial backoff delay (ms) |
| `GEMINI_RETRY_MAX_MS` | `60000` | Maximum backoff delay cap (ms) |
| `GEMINI_MIN_INTERVAL_MS` | `2000` | Minimum delay between batch Gemini calls (also settable via `--gemini-interval-ms`) |

## Expected layout

- **Source directory**: any folder (default **`in`** for batch).
- **Output directory**: any folder (default **`out`** for batch).
- **Supported formats**: `.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`.

Example with two presets (A and B): the **sample-data** folder uses `sample-data/in/A`, `sample-data/in/B` and `sample-data/out/A`, `sample-data/out/B`. From the project root, `npm run crop:a` and `npm run crop:b` process that folder. For your own data, use `in/` and `out/` at the project root (or pass `-s` / `-d`).

## Development

- **Lint**: `npm run lint` (Biome)
- **Format**: `npm run format` or `npm run check` (Biome format + lint with auto-fix)
- **Unit tests**: `npm run test` (watch) or `npm run test:run` (single run). Test files sit next to the source (e.g. `src/crop.test.ts`, `src/gemini.test.ts`).
- **Typecheck**: `npm run typecheck`

## Publishing to npm (GitHub-hosted)

To publish this CLI to the npm registry with the repo on GitHub:

1. **GitHub**
   - The project is configured for [github.com/yortyrh/image-content-crop](https://github.com/yortyrh/image-content-crop). To use another repo, update `repository`, `homepage`, and `bugs.url` in `package.json`.

2. **npm**
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
   - Update the `version` field in `package.json` (e.g. `1.1.0`). The tag and `package.json` version must match.
   - Commit and push:
     ```bash
     git add package.json
     git commit -m "chore: release v1.1.0"
     git push origin main
     ```
   - Create and push a tag (use the same version as in `package.json`):
     ```bash
     git tag v1.1.0
     git push origin v1.1.0
     ```
   - The **Publish to npm** workflow will run: it typechecks, builds, and publishes to npm. Check the **Actions** tab on GitHub for status.
