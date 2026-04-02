import { access, readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import type { CropOptions } from './crop.js';

const DEFAULT_CONFIG_FILENAME = 'crop-config.yaml';
const LOCAL_CONFIG_FILENAME = 'crop-config.local.yaml';

/** Directory of the running script (package root when run from dist/cli.js). */
function getPackageRoot(): string {
  const dir = path.dirname(fileURLToPath(import.meta.url));
  return path.join(dir, '..');
}

/**
 * Resolve config file path in order:
 * 1. If explicit path is provided (--config), use it.
 * 2. For each of: cwd → ~/.config/image-content-crop/ → package root:
 *    crop-config.local.yaml if it exists, else crop-config.yaml if it exists.
 * 3. Fallback: package's crop-config.yaml (next to dist/cli.js), even if missing.
 */
export async function getConfigPath(explicitPath?: string): Promise<string> {
  if (explicitPath) return path.resolve(explicitPath);

  const homeDir = path.join(homedir(), '.config', 'image-content-crop');
  const bases = [process.cwd(), homeDir, getPackageRoot()];
  const defaultPath = path.join(getPackageRoot(), DEFAULT_CONFIG_FILENAME);

  for (const base of bases) {
    const localPath = path.join(base, LOCAL_CONFIG_FILENAME);
    try {
      await access(localPath);
      return localPath;
    } catch {}
    const sharedPath = path.join(base, DEFAULT_CONFIG_FILENAME);
    try {
      await access(sharedPath);
      return sharedPath;
    } catch {}
  }
  return defaultPath;
}

export interface GeminiPresetOptions {
  prompt: string;
  model?: string;
}

export interface PresetOptions extends Partial<CropOptions> {
  gemini?: GeminiPresetOptions;
}

export interface CropConfig {
  gemini?: { model?: string };
  presets?: Record<string, PresetOptions>;
}

/**
 * Load full config from a YAML file.
 * Uses getConfigPath() when no path is given: current dir → HOME → project default.
 * Returns a default empty config if the file is missing or invalid.
 */
export async function loadConfig(configPath?: string): Promise<CropConfig> {
  const filePath = await getConfigPath(configPath);
  let content: string;
  try {
    content = await readFile(filePath, 'utf-8');
  } catch {
    return {};
  }
  try {
    const parsed = parse(content) as CropConfig;
    return parsed ?? {};
  } catch {
    return {};
  }
}

/**
 * Load presets from a YAML config file.
 * Convenience wrapper around loadConfig().
 */
export async function loadPresets(configPath?: string): Promise<Record<string, PresetOptions>> {
  const config = await loadConfig(configPath);
  const presets = config.presets;
  if (!presets || typeof presets !== 'object') return {};
  return presets;
}
