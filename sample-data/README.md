# Sample data layout

This folder demonstrates the default **in** / **out** layout used by the CLI.

- **in/A** — input images for preset **a**
- **in/B** — input images for preset **b**
- **out/A** — cropped output for preset **a**
- **out/B** — cropped output for preset **b**

From the **project root** (one level up), the npm scripts use this folder by default:

```bash
npm run crop:a   # crop sample-data/in/A → sample-data/out/A with preset a
npm run crop:b   # crop sample-data/in/B → sample-data/out/B with preset b
```

To use this folder as the working directory, run from here with explicit paths:

```bash
node ../dist/cli.js batch -s in/A -d out/A -p a
node ../dist/cli.js batch -s in/B -d out/B -p b
```
