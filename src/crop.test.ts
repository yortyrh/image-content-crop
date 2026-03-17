import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cropImage } from './crop.js';

const mockMkdir = vi.fn();
const mockToFile = vi.fn();
const mockExtract = vi.fn();
const mockMetadata = vi.fn();

vi.mock('sharp', () => ({
  default: vi.fn(() => ({
    metadata: mockMetadata,
    extract: mockExtract.mockReturnValue({
      toFile: mockToFile,
    }),
  })),
}));

vi.mock('fs/promises', () => ({
  mkdir: (...args: unknown[]) => mockMkdir(...args),
}));

describe('cropImage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMetadata.mockResolvedValue({ width: 1000, height: 500 });
    mockToFile.mockResolvedValue(undefined);
  });

  it('uses default margins (ratio) and extracts correct region', async () => {
    await cropImage('/in.png', '/out/cropped.png', {});

    expect(mockMetadata).toHaveBeenCalledTimes(1);
    expect(mockExtract).toHaveBeenCalledWith({
      left: 0,
      top: 0,
      width: 940,
      height: 430,
    });
    expect(mockToFile).toHaveBeenCalledWith('/out/cropped.png');
    expect(mockMkdir).toHaveBeenCalledWith('/out', { recursive: true });
  });

  it('applies custom ratio margins', async () => {
    await cropImage('/a.png', '/b.png', {
      marginLeft: 0.1,
      marginTop: 0.2,
      marginRight: 0.1,
      marginBottom: 0.2,
    });

    expect(mockExtract).toHaveBeenCalledWith({
      left: 100,
      top: 100,
      width: 800,
      height: 300,
    });
  });

  it('applies pixel margins when marginsInPixels is true', async () => {
    await cropImage('/a.png', '/b.png', {
      marginLeft: 50,
      marginTop: 25,
      marginRight: 50,
      marginBottom: 25,
      marginsInPixels: true,
    });

    expect(mockExtract).toHaveBeenCalledWith({
      left: 50,
      top: 25,
      width: 900,
      height: 450,
    });
  });

  it('caps pixel margins at dimension size and throws when region invalid', async () => {
    mockMetadata.mockResolvedValue({ width: 1000, height: 500 });
    await expect(
      cropImage('/a.png', '/b.png', {
        marginLeft: 9999,
        marginTop: 0,
        marginRight: 0,
        marginBottom: 0,
        marginsInPixels: true,
      }),
    ).rejects.toThrow(/Invalid crop region.*left=1000/);
    expect(mockExtract).not.toHaveBeenCalled();
  });

  it('throws on invalid dimensions (zero width)', async () => {
    mockMetadata.mockResolvedValue({ width: 0, height: 500 });

    await expect(cropImage('/in.png', '/out.png', {})).rejects.toThrow(
      'Invalid dimensions for /in.png: 0x500',
    );
    expect(mockExtract).not.toHaveBeenCalled();
  });

  it('throws on invalid dimensions (missing metadata)', async () => {
    mockMetadata.mockResolvedValue({});

    await expect(cropImage('/in.png', '/out.png', {})).rejects.toThrow(
      'Invalid dimensions for /in.png: 0x0',
    );
  });

  it('throws when crop region is invalid (margins exceed size)', async () => {
    mockMetadata.mockResolvedValue({ width: 100, height: 100 });
    await expect(
      cropImage('/in.png', '/out.png', {
        marginLeft: 0.5,
        marginRight: 0.5,
        marginTop: 0.5,
        marginBottom: 0.5,
      }),
    ).rejects.toThrow('Invalid crop region');
    expect(mockToFile).not.toHaveBeenCalled();
  });
});
