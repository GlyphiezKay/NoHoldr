export async function exportWav(file: File, options: {
  start: number; end?: number; depth: number; mono: boolean; normalize: boolean;
}) {
  const context = new AudioContext();
  try {
    const audio = await context.decodeAudioData(await file.arrayBuffer());
    const start = Math.max(0, Math.min(audio.length, Math.round(options.start * audio.sampleRate)));
    const end = options.end === undefined ? audio.length : Math.min(audio.length, Math.round(options.end * audio.sampleRate));
    if (end <= start) throw new Error("Choose a non-empty audio range.");
    if (audio.numberOfChannels > 2 && !options.mono) throw new Error("Choose Mono for an input with more than two channels.");
    const channels = options.mono ? 1 : audio.numberOfChannels;
    const bytes = options.depth / 8;
    const payload = (end - start) * channels * bytes;
    if (payload > 256 * 1024 * 1024) throw new Error("The WAV would exceed 256 MB. Trim a shorter clip.");
    const output = new ArrayBuffer(44 + payload);
    const view = new DataView(output);
    const text = (offset: number, value: string) => [...value].forEach((char, i) => view.setUint8(offset + i, char.charCodeAt(0)));
    text(0, "RIFF"); view.setUint32(4, 36 + payload, true); text(8, "WAVE"); text(12, "fmt ");
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, channels, true);
    view.setUint32(24, audio.sampleRate, true); view.setUint32(28, audio.sampleRate * channels * bytes, true);
    view.setUint16(32, channels * bytes, true); view.setUint16(34, options.depth, true);
    text(36, "data"); view.setUint32(40, payload, true);
    const samples = Array.from({ length: audio.numberOfChannels }, (_, n) => audio.getChannelData(n));
    const at = (i: number, channel: number) => options.mono
      ? samples.reduce((sum, data) => sum + data[i], 0) / samples.length : samples[channel][i];
    let peak = 0;
    if (options.normalize) {
      for (let i = start; i < end; i++) {
        for (let channel = 0; channel < channels; channel++) peak = Math.max(peak, Math.abs(at(i, channel)));
      }
    }
    let offset = 44;
    for (let i = start; i < end; i++) {
      for (let channel = 0; channel < channels; channel++) {
        const sample = Math.max(-1, Math.min(1, at(i, channel) / (peak || 1)));
        if (bytes === 2) view.setInt16(offset, Math.round(sample * (sample < 0 ? 32768 : 32767)), true);
        else {
          const value = Math.round(sample * (sample < 0 ? 8388608 : 8388607));
          view.setUint8(offset, value & 255);
          view.setUint8(offset + 1, (value >> 8) & 255);
          view.setUint8(offset + 2, (value >> 16) & 255);
        }
        offset += bytes;
      }
    }
    return new Blob([output], { type: "audio/wav" });
  } finally {
    await context.close();
  }
}