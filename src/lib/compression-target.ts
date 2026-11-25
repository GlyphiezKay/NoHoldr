/**
 * Find a high-quality result under the size cap without padding the file.
 * Keep the nearest observed result, since encoding sizes can fluctuate slightly.
 */
export async function findCompressionTarget<T extends { size: number }>(
  original: T,
  targetBytes: number,
  encode: (quality: number, pass: number, maxPasses: number) => Promise<T>,
): Promise<T> {
  if (original.size <= targetBytes) return original;
  const maxPasses = 9;
  const tolerance = Math.max(384, targetBytes * 0.0125);
  let smallest = original;
  let nearest: T | undefined;

  async function test(quality: number, pass: number) {
    const result = await encode(quality, pass, maxPasses);
    if (result.size < smallest.size) smallest = result;
    if (result.size <= targetBytes && (!nearest || result.size > nearest.size)) nearest = result;
    return result;
  }

  const sharp = await test(1, 0);
  if (sharp.size <= targetBytes) return sharp;
  const compact = await test(0, 1);
  if (compact.size > targetBytes) return smallest;

  let low = 0;
  let high = 1;
  for (let pass = 2; pass < maxPasses && targetBytes - (nearest?.size ?? 0) > tolerance; pass++) {
    const quality = (low + high) / 2;
    const candidate = await test(quality, pass);
    if (candidate.size <= targetBytes) low = quality;
    else high = quality;
  }
  return nearest ?? smallest;
}