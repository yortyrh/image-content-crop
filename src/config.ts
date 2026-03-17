import { access, readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import type { CropOptions } from './crop.js';

const DEFAULT_CONFIG_FILENAME = 'crop-config.yaml';

/** Directory of the running script (package root when run from dist/cli.js). */
function getPackageRoot(): string {
  const dir = path.dirname(fileURLToPath(import.meta.url));
  return path.join(dir, '..');
}

/**
 * Resolve config file path in order:
 * 1. If explicit path is provided (--config), use it.
 * 2. Current working directory: ./crop-config.yaml
 * 3. User home: ~/.config/image-content-crop/crop-config.yaml
 * 4. Project default: package's crop-config.yaml (next to dist/cli.js)
 */
export async function getConfigPath(explicitPath?: string): Promise<string> {
  if (explicitPath) return path.resolve(explicitPath);

  const cwdPath = path.join(process.cwd(), DEFAULT_CONFIG_FILENAME);
  const homePath = path.join(homedir(), '.config', 'image-content-crop', DEFAULT_CONFIG_FILENAME);
  const defaultPath = path.join(getPackageRoot(), DEFAULT_CONFIG_FILENAME);

  const candidates = [cwdPath, homePath, defaultPath];
  for (const p of candidates) {
    try {
      await access(p);
      return p;
    } catch {}
  }
  return defaultPath;
}

export interface CropConfig {
  presets?: Record<string, Partial<CropOptions>>;
}

/**
 * Load presets from a YAML config file.
 * Uses getConfigPath() when no path is given: current dir → HOME → project default.
 * Returns an empty object if the file is missing or invalid.
 */
export async function loadPresets(
  configPath?: string,
): Promise<Record<string, Partial<CropOptions>>> {
  const filePath = await getConfigPath(configPath);
  let content: string;
  try {
    content = await readFile(filePath, 'utf-8');
  } catch {
    return {};
  }
  try {
    const parsed = parse(content) as CropConfig;
    const presets = parsed?.presets;
    if (!presets || typeof presets !== 'object') return {};
    return presets as Record<string, Partial<CropOptions>>;
  } catch {
    return {};
  }
}
