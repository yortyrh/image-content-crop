import sharp from "sharp";
import { mkdir } from "fs/promises";
import path from "path";

export interface CropOptions {
  /** Margin to remove from the left (0–1 = ratio, or pixels if > 1). Default 0. */
  marginLeft?: number;
  /** Margin to remove from the top (0–1 = ratio, or pixels if > 1). Default 0. */
  marginTop?: number;
  /** Margin to remove from the right (0–1 = ratio, or pixels if > 1). Default 0.06 (6%). */
  marginRight?: number;
  /** Margin to remove from the bottom (0–1 = ratio, or pixels if > 1). Default 0.14 (14%). */
  marginBottom?: number;
  /** If true, margins are interpreted as pixel values. */
  marginsInPixels?: boolean;
}

const defaultCropOptions: Required<CropOptions> = {
  marginLeft: 0,
  marginTop: 0,
  marginRight: 0.06,
  marginBottom: 0.14,
  marginsInPixels: false,
};

function resolveMargin(value: number, dimension: number, inPixels: boolean): number {
  if (inPixels) return Math.min(value, dimension);
  return Math.floor(dimension * value);
}

/**
 * Crops an image to the content region by removing margins.
 * Use CropOptions or a preset (from crop-config.yaml) to define margins.
 */
export async function cropImage(
  sourcePath: string,
  destPath: string,
  options: CropOptions = {}
): Promise<void> {
  const opts = { ...defaultCropOptions, ...options };
  const image = sharp(sourcePath);
  const metadata = await image.metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;

  if (width <= 0 || height <= 0) {
    throw new Error(`Invalid dimensions for ${sourcePath}: ${width}x${height}`);
  }

  const inPx = opts.marginsInPixels;
  const left = resolveMargin(opts.marginLeft, width, inPx);
  const top = resolveMargin(opts.marginTop, height, inPx);
  const right = resolveMargin(opts.marginRight, width, inPx);
  const bottom = resolveMargin(opts.marginBottom, height, inPx);

  const extractWidth = width - left - right;
  const extractHeight = height - top - bottom;

  if (extractWidth <= 0 || extractHeight <= 0) {
    throw new Error(
      `Invalid crop region: left=${left} top=${top} right=${right} bottom=${bottom} on ${width}x${height}`
    );
  }

  await mkdir(path.dirname(destPath), { recursive: true });
  await image
    .extract({
      left,
      top,
      width: extractWidth,
      height: extractHeight,
    })
    .toFile(destPath);
}
