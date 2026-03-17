import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getConfigPath, loadPresets } from './config.js';

const mockAccess = vi.fn();
const mockReadFile = vi.fn();

vi.mock('fs/promises', () => ({
  readFile: (...args: unknown[]) => mockReadFile(...args),
  access: (...args: unknown[]) => mockAccess(...args),
}));

describe('getConfigPath', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns resolved path when explicit path is provided', async () => {
    const result = await getConfigPath('/some/custom/crop-config.yaml');
    expect(result).toMatch(/crop-config\.yaml$/);
    expect(result).toContain('some');
    expect(mockAccess).not.toHaveBeenCalled();
  });

  it('returns first existing candidate when no explicit path', async () => {
    mockAccess.mockRejectedValueOnce(new Error('not found')).mockResolvedValueOnce(undefined);

    const result = await getConfigPath();
    expect(mockAccess).toHaveBeenCalled();
    expect(result).toBeDefined();
  });
});

describe('loadPresets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty object when config file cannot be read', async () => {
    mockReadFile.mockRejectedValue(new Error('ENOENT'));

    const presets = await loadPresets('/nonexistent.yaml');
    expect(presets).toEqual({});
  });

  it('returns empty object when YAML has no presets key', async () => {
    mockReadFile.mockResolvedValue('other: value\n');

    const presets = await loadPresets(undefined);
    expect(presets).toEqual({});
  });

  it('returns presets from valid YAML content', async () => {
    mockReadFile.mockResolvedValue(`
presets:
  a:
    marginLeft: 0.1
    marginRight: 0.1
  b:
    marginBottom: 0.14
`);

    const presets = await loadPresets(undefined);
    expect(presets).toHaveProperty('a');
    expect(presets.a).toEqual({ marginLeft: 0.1, marginRight: 0.1 });
    expect(presets).toHaveProperty('b');
    expect(presets.b).toEqual({ marginBottom: 0.14 });
  });

  it('returns empty object when YAML is invalid', async () => {
    mockReadFile.mockResolvedValue('invalid: yaml: [[[');

    const presets = await loadPresets(undefined);
    expect(presets).toEqual({});
  });
});
