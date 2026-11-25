export function encodeWav(audio: AudioBuffer, options: {
  start?: number; end?: number; depth: 8 | 16 | 24 | 32; mono?: boolean; normalize?: boolean;
}) {
  const start = Math.max(0, Math.min(audio.length, Math.round((options.start ?? 0) * audio.sampleRate)));
  const end = options.end === undefined ? audio.length : Math.min(audio.length, Math.round(options.end * audio.sampleRate));
  if (end <= start) throw new Error("Choose a non-empty audio range.");
  if (audio.numberOfChannels > 2 && !options.mono) throw new Error("Choose Mono for an input with more than two channels.");
  const channels = options.mono ? 1 : audio.numberOfChannels;
  const bytes = options.depth / 8;
  const payload = (end - start) * channels * bytes;
  if (payload > 256 * 1024 * 1024) throw new Error("The WAV would exceed 256 MB. Choose a shorter clip.");
  const padding = payload % 2;
  const output = new ArrayBuffer(44 + payload + padding);
  const view = new DataView(output);
  const text = (offset: number, value: string) => [...value].forEach((char, i) => view.setUint8(offset + i, char.charCodeAt(0)));
  text(0, "RIFF"); view.setUint32(4, 36 + payload + padding, true); text(8, "WAVE"); text(12, "fmt ");
  view.setUint32(16, 16, true); view.setUint16(20, options.depth === 32 ? 3 : 1, true); view.setUint16(22, channels, true);
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
      if (bytes === 1) view.setUint8(offset, Math.round((sample + 1) * 127.5));
      else if (bytes === 2) view.setInt16(offset, Math.round(sample * (sample < 0 ? 32768 : 32767)), true);
      else if (bytes === 4) view.setFloat32(offset, sample, true);
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
}

export async function exportWav(file: File, options: {
  start: number; end?: number; depth: number; mono: boolean; normalize: boolean;
}) {
  if (options.depth !== 16 && options.depth !== 24) throw new Error("Choose 16- or 24-bit audio.");
  const context = new AudioContext();
  try {
    const audio = await context.decodeAudioData(await file.arrayBuffer());
    return encodeWav(audio, { ...options, depth: options.depth });
  } finally {
    await context.close();
  }
}

export async function convertAudio(file: File, options: {
  sampleRate: number; channels: 1 | 2; normalize: boolean; depth: 8 | 16 | 24 | 32; mime: string;
}) {
  const decoder = new AudioContext({ sampleRate: options.sampleRate });
  let decoded: AudioBuffer;
  try {
    decoded = await decoder.decodeAudioData(await file.arrayBuffer());
  } finally {
    await decoder.close();
  }
  if (decoded.length * options.channels * 4 > 256 * 1024 * 1024) throw new Error("Choose a shorter file or a lower sample rate.");
  const mix = new OfflineAudioContext(options.channels, decoded.length, decoded.sampleRate);
  const source = mix.createBufferSource();
  source.buffer = decoded;
  source.connect(mix.destination);
  source.start();
  const audio = await mix.startRendering();
  if (options.mime === "audio/wav") return encodeWav(audio, options);

  if (typeof MediaRecorder === "undefined" || !MediaRecorder.isTypeSupported(options.mime)) {
    throw new Error("This browser cannot encode the chosen format. Try WAV.");
  }
  const context = new AudioContext({ sampleRate: audio.sampleRate });
  const stream = context.createMediaStreamDestination();
  stream.channelCount = options.channels;
  const clip = context.createBufferSource();
  clip.buffer = audio;
  if (options.normalize) {
    let peak = 0;
    for (let i = 0; i < audio.numberOfChannels; i++) {
      for (const sample of audio.getChannelData(i)) peak = Math.max(peak, Math.abs(sample));
    }
    const gain = context.createGain();
    gain.gain.value = 1 / (peak || 1);
    clip.connect(gain).connect(stream);
  } else clip.connect(stream);
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await context.resume();
    const recorder = new MediaRecorder(stream.stream, { mimeType: options.mime });
    const chunks: Blob[] = [];
    return await new Promise<Blob>((resolve, reject) => {
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      recorder.onerror = () => reject(new Error("The audio encoder stopped unexpectedly."));
      recorder.onstop = () => chunks.length
        ? resolve(new Blob(chunks, { type: options.mime.split(";")[0] }))
        : reject(new Error("The audio encoder returned an empty file."));
      clip.onended = () => { if (recorder.state !== "inactive") recorder.stop(); };
      timeout = setTimeout(() => {
        reject(new Error("The audio encoder timed out."));
        if (recorder.state !== "inactive") recorder.stop();
      }, (audio.duration + 10) * 1000);
      recorder.start();
      clip.start();
    });
  } finally {
    clearTimeout(timeout);
    stream.stream.getTracks().forEach(track => track.stop());
    await context.close();
  }
}
