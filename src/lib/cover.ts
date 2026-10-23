import sharp from "sharp";
import { fetchImage } from "./http";
import { palette, type RGB } from "./color";

export interface Cover {
  /** Square JPEG as a data URI, ready for <img> in the card. */
  dataUri: string;
  dominant: RGB;
  vivid: RGB;
}

/**
 * Download the cover, crop it to a centered square (YouTube thumbnails are 16:9)
 * and read its colors.
 */
export async function loadCover(url: string, size = 1200): Promise<Cover> {
  return coverFromBuffer(await fetchImage(url), size);
}

export async function coverFromBuffer(input: Buffer, size = 1200): Promise<Cover> {
  const square = sharp(input, { failOn: "none" }).rotate().resize(size, size, { fit: "cover", position: "centre" });

  const [jpeg, raw] = await Promise.all([
    square.clone().jpeg({ quality: 88, mozjpeg: true }).toBuffer(),
    square.clone().resize(48, 48).removeAlpha().raw().toBuffer({ resolveWithObject: true }),
  ]);
  const { dominant, vivid } = palette(raw.data, raw.info.channels);
  return { dataUri: `data:image/jpeg;base64,${jpeg.toString("base64")}`, dominant, vivid };
}
