---
description: Bump version, commit, tag, and push to trigger npm publish via GitHub Actions
argument-hint: version (e.g. 1.0.2 or patch|minor|major)
allowed-tools: Read, Bash
---

# Deploy to npm (push and publish)

Run the full release flow so that **GitHub Actions** publishes this package to npm. This command:

1. Bumps the package version (from argument or user choice)
2. Commits the version bump and creates an annotated tag `v<version>`
3. Pushes the current branch and the tag → the **Publish to npm** workflow runs and publishes to npm

## Version argument

- **If `$1` is provided**: use it as the version. It can be:
  - An exact version: `1.0.2`
  - A semver bump: `patch`, `minor`, or `major` (from current version in `package.json`)
- **If `$1` is not provided**: read the current version from `package.json`, suggest the next **patch** (e.g. `1.0.0` → `1.0.1`), and **ask the user** which version to assign. Then proceed with the chosen version.

## Steps to run

1. **Determine the version**
   - If the user provided a version argument (`$1`), use it.
   - Otherwise, read `package.json` and suggest the next patch version; ask the user to confirm or give another version (e.g. minor/major or exact).

2. **Bump version, commit, and tag**
   - Run: `npm version <VERSION> -m "chore: release v%s"`
   - Replace `<VERSION>` with the chosen value: either `patch`, `minor`, `major`, or an exact version (e.g. `1.0.2`).
   - This updates `package.json`, creates a commit, and creates an annotated tag `v<version>`.

3. **Push branch and tags**
   - Run: `git push origin HEAD && git push origin --tags`
   - Pushing the tag triggers the GitHub Action **Publish to npm** (see `.github/workflows/publish.yml`).

4. **Confirm to the user**
   - Tell them the release is in progress and that they can check the **Actions** tab on GitHub. Remind them that the repo must have the **NPM_TOKEN** secret configured for the publish to succeed.

## Prerequisites (remind if relevant)

- Working directory clean or only `package.json` changed (no uncommitted changes besides the version bump).
- Remote `origin` points to the GitHub repo.
- Repository has the **NPM_TOKEN** secret set in Settings → Secrets and variables → Actions.

## Example usage

- `/deploy-npm` → ask user which version, then run the flow.
- `/deploy-npm patch` → bump patch (e.g. 1.0.0 → 1.0.1), commit, tag, push.
- `/deploy-npm 1.0.2` → set version to 1.0.2, commit, tag, push.
