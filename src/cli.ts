#!/usr/bin/env node
import 'dotenv/config';
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { Command } from 'commander';
import { loadConfig, type PresetOptions } from './config.js';
import { type CropOptions, cropImage, cropImageToBuffer } from './crop.js';
import { processImageWithGemini } from './gemini.js';

const require = createRequire(import.meta.url);
const { version } = require('../package.json') as { version: string };

const MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

interface GeminiContext {
  enabled: boolean;
  prompt?: string;
  model?: string;
}

function resolveGeminiContext(
  presetOpts: PresetOptions | undefined,
  globalModel: string | undefined,
  cliNoGemini: boolean,
  cliGeminiPrompt: string | undefined,
): GeminiContext {
  const presetPrompt = presetOpts?.gemini?.prompt;
  const prompt = cliGeminiPrompt ?? presetPrompt;
  if (cliNoGemini || !prompt) return { enabled: false };

  const model = presetOpts?.gemini?.model ?? globalModel;
  return { enabled: true, prompt, model };
}

async function processFile(
  src: string,
  dest: string,
  cropOpts: CropOptions,
  gemini: GeminiContext,
): Promise<void> {
  if (!gemini.enabled) {
    await cropImage(src, dest, cropOpts);
    return;
  }

  const buffer = await cropImageToBuffer(src, cropOpts);
  const ext = path.extname(src).toLowerCase();
  const mimeType = MIME_TYPES[ext] ?? 'image/png';
  const result = await processImageWithGemini(buffer, mimeType, gemini.prompt!, gemini.model);

  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, result);
}

function addGeminiOptions(cmd: Command): Command {
  return cmd
    .option('--no-gemini', 'Skip Gemini processing even if the preset configures it')
    .option('--gemini-prompt <text>', 'Override the Gemini prompt from the preset');
}

const program = new Command();

program
  .name('image-crop')
  .description(
    'CLI to crop images to content (remove margins). Use presets from a YAML config or set margins via options.',
  )
  .version(version);

const singleCmd = program
  .command('single')
  .description('Crop a single image file')
  .option('-s, --source <path>', 'Source image file (required)')
  .option('-d, --dest <path>', 'Destination image file (required)')
  .option(
    '-c, --config <path>',
    'Config file path. Else: cwd → HOME/.config/image-content-crop → project default',
  )
  .option('-p, --preset <name>', 'Preset name from config (e.g. a, b)')
  .option(
    '-l, --margin-left <number>',
    'Left margin (0–1 or pixels if --margins-in-pixels)',
    parseFloat,
  )
  .option(
    '-t, --margin-top <number>',
    'Top margin (0–1 or pixels if --margins-in-pixels)',
    parseFloat,
  )
  .option('-r, --margin-right <number>', 'Right margin (0–1 or pixels)', parseFloat)
  .option('-b, --margin-bottom <number>', 'Bottom margin (0–1 or pixels)', parseFloat)
  .option('--margins-in-pixels', 'Interpret margins as pixels');

addGeminiOptions(singleCmd).action(async (opts) => {
  if (!opts.source || !opts.dest) {
    console.error("Error: --source and --dest are required for the 'single' command.");
    process.exit(1);
  }
  const config = await loadConfig(opts.config);
  const presets = config.presets ?? {};
  const presetOpts = opts.preset ? presets[opts.preset] : undefined;
  if (opts.preset && !presetOpts) {
    const names = Object.keys(presets).length
      ? Object.keys(presets).join(', ')
      : '(none in config)';
    console.error(`Unknown preset: "${opts.preset}". Available: ${names}`);
    process.exit(1);
  }
  const cropOpts: CropOptions = { ...presetOpts };
  if (opts.marginLeft != null) cropOpts.marginLeft = opts.marginLeft;
  if (opts.marginTop != null) cropOpts.marginTop = opts.marginTop;
  if (opts.marginRight != null) cropOpts.marginRight = opts.marginRight;
  if (opts.marginBottom != null) cropOpts.marginBottom = opts.marginBottom;
  if (opts.marginsInPixels) cropOpts.marginsInPixels = true;

  const gemini = resolveGeminiContext(
    presetOpts,
    config.gemini?.model,
    !opts.gemini,
    opts.geminiPrompt,
  );

  try {
    await processFile(opts.source, opts.dest, cropOpts, gemini);
    const suffix = gemini.enabled ? ' + Gemini' : '';
    console.log(`Cropped${suffix}: ${opts.source} → ${opts.dest}`);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
});

const batchCmd = program
  .command('batch')
  .description('Crop all image files from a source directory to a destination directory')
  .option('-s, --source-dir <path>', 'Source directory', 'in')
  .option('-d, --dest-dir <path>', 'Destination directory', 'out')
  .option(
    '-c, --config <path>',
    'Config file path. Else: cwd → HOME/.config/image-content-crop → project default',
  )
  .option('-p, --preset <name>', 'Preset name from config')
  .option(
    '-l, --margin-left <number>',
    'Left margin (0–1 or pixels if --margins-in-pixels)',
    parseFloat,
  )
  .option(
    '-t, --margin-top <number>',
    'Top margin (0–1 or pixels if --margins-in-pixels)',
    parseFloat,
  )
  .option('-r, --margin-right <number>', 'Right margin (0–1 or pixels)', parseFloat)
  .option('-b, --margin-bottom <number>', 'Bottom margin (0–1 or pixels)', parseFloat)
  .option('--margins-in-pixels', 'Interpret margins as pixels');

addGeminiOptions(batchCmd).action(async (opts) => {
  const sourceDir = opts.sourceDir ?? 'in';
  const destDir = opts.destDir ?? 'out';
  const config = await loadConfig(opts.config);
  const presets = config.presets ?? {};
  const presetOpts = opts.preset ? presets[opts.preset] : undefined;
  if (opts.preset && !presetOpts) {
    const names = Object.keys(presets).length
      ? Object.keys(presets).join(', ')
      : '(none in config)';
    console.error(`Unknown preset: "${opts.preset}". Available: ${names}`);
    process.exit(1);
  }
  const cropOpts: CropOptions = { ...presetOpts };
  if (opts.marginLeft != null) cropOpts.marginLeft = opts.marginLeft;
  if (opts.marginTop != null) cropOpts.marginTop = opts.marginTop;
  if (opts.marginRight != null) cropOpts.marginRight = opts.marginRight;
  if (opts.marginBottom != null) cropOpts.marginBottom = opts.marginBottom;
  if (opts.marginsInPixels) cropOpts.marginsInPixels = true;

  const gemini = resolveGeminiContext(
    presetOpts,
    config.gemini?.model,
    !opts.gemini,
    opts.geminiPrompt,
  );

  let files: string[];
  try {
    files = await readdir(sourceDir);
  } catch (e) {
    console.error(`Error reading source directory "${sourceDir}":`, e);
    process.exit(1);
  }

  const imageExtensions = new Set(Object.keys(MIME_TYPES));
  const imageFiles = files.filter((f) => imageExtensions.has(path.extname(f).toLowerCase()));

  if (imageFiles.length === 0) {
    console.log(`No images found in ${sourceDir}.`);
    return;
  }

  const modeLabel = gemini.enabled ? 'crop + Gemini' : 'crop';
  console.log(`${imageFiles.length} image(s) to ${modeLabel}: ${sourceDir} → ${destDir}`);
  let ok = 0;
  let err = 0;
  for (const file of imageFiles) {
    const src = path.join(sourceDir, file);
    const dest = path.join(destDir, file);
    try {
      await processFile(src, dest, cropOpts, gemini);
      ok++;
      console.log(`  ${file}`);
    } catch (e) {
      err++;
      console.error(`  ${file}:`, e);
    }
  }
  console.log(`Done: ${ok} succeeded, ${err} failed.`);
  if (err > 0) process.exit(1);
});

program
  .option('--src <path>', 'Source file (single-file mode)')
  .option('--out <path>', 'Destination file (single-file mode)')
  .option('-l, --margin-left <number>', 'Left margin', parseFloat)
  .option('-t, --margin-top <number>', 'Top margin', parseFloat)
  .option('-r, --margin-right <number>', 'Right margin', parseFloat, 0.06)
  .option('-b, --margin-bottom <number>', 'Bottom margin', parseFloat, 0.14)
  .option('--margins-in-pixels', 'Margins in pixels')
  .action(async (opts) => {
    if (opts.src && opts.out) {
      const cropOpts: CropOptions = {};
      if (opts.marginLeft != null) cropOpts.marginLeft = opts.marginLeft;
      if (opts.marginTop != null) cropOpts.marginTop = opts.marginTop;
      if (opts.marginRight != null) cropOpts.marginRight = opts.marginRight;
      if (opts.marginBottom != null) cropOpts.marginBottom = opts.marginBottom;
      if (opts.marginsInPixels) cropOpts.marginsInPixels = true;
      try {
        await cropImage(opts.src, opts.out, cropOpts);
        console.log(`Cropped: ${opts.src} → ${opts.out}`);
      } catch (e) {
        console.error(e);
        process.exit(1);
      }
      return;
    }
    program.help();
  });

program.parse();
