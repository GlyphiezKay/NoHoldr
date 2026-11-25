declare module "gifenc" {
  type Pixels = Uint8Array | Uint8ClampedArray;
  export function quantize(rgba: Pixels, maxColors: number): number[][];
  export function applyPalette(rgba: Pixels, palette: number[][]): Uint8Array;
  export function GIFEncoder(): {
    writeFrame(index: Uint8Array, width: number, height: number, options: { palette: number[][]; delay: number; repeat: number }): void;
    finish(): void;
    bytes(): Uint8Array;
  };
}