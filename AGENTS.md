# Agent context: image-content-crop

This project is a **Node.js CLI** that crops images to their content area by removing configurable margins. Presets are defined in YAML; margins can also be set via CLI options.

## Stack and layout

- **Runtime**: Node.js 18+, ESM.
- **Entry**: `src/cli.ts` → built to `dist/cli.js` (esbuild).
- **Core logic**: `src/crop.ts` (Sharp-based cropping), `src/config.ts` (YAML presets).
- **Config**: `crop-config.yaml` at project root (or overridden with `--config`).
- **Sample data**: `sample-data/in/A`, `sample-data/in/B` (inputs) and `sample-data/out/A`, `sample-data/out/B` (outputs). Content of those dirs is gitignored; only the directory structure and local `.gitignore` files are committed.

## Conventions

- **Documentation**: All project documentation (README, AGENTS.md, doc comments, user-facing help) must be **in English only**. Do not add documentation in French or other non-English languages.
- **Unit tests**: Test files sit next to the file under test; run with `--run` (e.g. `npm test -- --run`).
- **Git commits**: Use conventional commits with a title and a description.

## Commands (from project root)

- `npm run build` — build CLI to `dist/cli.js`
- `npm run crop:a` — batch crop `sample-data/in/A` → `sample-data/out/A` with preset `a`
- `npm run crop:b` — batch crop `sample-data/in/B` → `sample-data/out/B` with preset `b`
- `npm run crop` — run CLI (help / ad-hoc usage)

## Adding features

- New presets: edit `crop-config.yaml` (presets are named arbitrarily, e.g. `a`, `b`).
- New CLI options: extend `src/cli.ts` (Commander) and pass options through to `cropImage` in `src/crop.ts`.
- Config resolution order: current dir → `~/.config/image-content-crop/` → bundled default.

## Releasing / deploying to npm (for AI agents)

**Claude:** A custom command runs the full deploy flow: `/deploy-npm [version]`. With no argument it asks which version; with `patch`/`minor`/`major` or an exact version (e.g. `1.0.2`) it bumps, commits, tags, and pushes so the GitHub Action publishes to npm.

When the user has pushed changes or completed work that might warrant a new release:

1. **Offer to prepare a release**
   - Ask: “Do you want to deploy a new version to npm?”
   - If yes, ask: “Which version do you want to assign?” (e.g. suggest next patch/minor/major from current in `package.json`, or accept a specific version like `1.0.2`).

2. **Update version**
   - Set the chosen version in `package.json` (`version` field). The tag and this value must match (tag format: `v<version>`, e.g. `v1.0.2`).

3. **Commit and tag**
   - Commit the version bump (e.g. `chore: release v1.0.2`), then create an annotated tag and push both:
     - `git tag v<version>` (e.g. `git tag v1.0.2`)
     - `git push origin <branch>` then `git push origin v<version>`
   - Or instruct the user to run these commands so they control the push.

4. **What happens next**
   - The GitHub Action **Publish to npm** runs on tag push: it typechecks, builds, and publishes to npm. The repo must have the `NPM_TOKEN` secret configured (see README).
