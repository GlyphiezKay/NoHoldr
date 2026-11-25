type VideoOptions = {
    mimeType?: string;
    fps?: number;
    bitrate?: number;
    scale?: number;
    maxHeight?: number;
    start?: number;
    end?: number;
    cancelled?: () => boolean;
    onProgress?: (percent: number) => void;
};

function waitFor(video: HTMLVideoElement, event: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const cleanup = () => {
            clearTimeout(timer);
            video.removeEventListener(event, success);
            video.removeEventListener("error", failure);
        };
        const success = () => { cleanup(); resolve(); };
        const failure = () => { cleanup(); reject(new Error("Unable to decode or seek in this video")); };
        const timer = setTimeout(failure, 30000);
        video.addEventListener(event, success, { once: true });
        video.addEventListener("error", failure, { once: true });
    });
}

export async function extractVideoFrame(file: File, time: number, mimeType: string): Promise<Blob> {
    const video = document.createElement("video");
    const url = URL.createObjectURL(file);
    try {
        const loaded = waitFor(video, "loadeddata");
        video.src = url;
        await loaded;
        const target = Math.max(0, Math.min(time, video.duration - 0.001));
        if (target !== video.currentTime) {
            const seeked = waitFor(video, "seeked");
            video.currentTime = target;
            await seeked;
        }
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx || !canvas.width || !canvas.height) throw new Error("Invalid video frame.");
        ctx.drawImage(video, 0, 0);
        return await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob(blob => blob && blob.type === mimeType ? resolve(blob) : reject(new Error("Frame format is unavailable.")), mimeType, 0.92);
        });
    } finally {
        video.removeAttribute("src");
        video.load();
        URL.revokeObjectURL(url);
    }
}

export async function recordVideo(file: File, options: VideoOptions = {}): Promise<Blob> {
    const mimeType = options.mimeType ?? "video/webm";
    if (typeof MediaRecorder === "undefined" || !MediaRecorder.isTypeSupported(mimeType)) {
        throw new Error("Your browser does not support this video output format.");
    }
    const video = document.createElement("video");
    const url = URL.createObjectURL(file);
    let audio: AudioContext | undefined;
    let stream: MediaStream | undefined;
    let recorder: MediaRecorder | undefined;
    let frame = 0;
    try {
        const loaded = waitFor(video, "loadeddata");
        video.playsInline = true;
        video.src = url;
        await loaded;
        const start = Math.max(0, options.start ?? 0);
        const end = Math.min(video.duration, options.end ?? video.duration);
        if (!Number.isFinite(end) || end <= start || !video.videoWidth) throw new Error("Invalid video duration or dimensions.");
        if (start !== video.currentTime) {
            const seeked = waitFor(video, "seeked");
            video.currentTime = start;
            await seeked;
        }
        const scale = Math.min(options.scale ?? 1, (options.maxHeight ?? video.videoHeight) / video.videoHeight);
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(2, Math.round(video.videoWidth * scale / 2) * 2);
        canvas.height = Math.max(2, Math.round(video.videoHeight * scale / 2) * 2);
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas is unavailable.");
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        stream = canvas.captureStream(options.fps ?? 30);
        audio = new AudioContext();
        const source = audio.createMediaElementSource(video);
        const destination = audio.createMediaStreamDestination();
        source.connect(destination);
        destination.stream.getAudioTracks().forEach(track => stream!.addTrack(track));
        // Resume playback audio alongside video, after constructing the graph.
        const audioReady = audio.resume();
        recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: options.bitrate });
        const activeRecorder = recorder;
        const chunks: Blob[] = [];
        const stop = () => { if (activeRecorder.state !== "inactive") activeRecorder.stop(); };
        const result = new Promise<Blob>((resolve, reject) => {
            activeRecorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
            activeRecorder.onerror = () => reject(new Error("Video recording failed."));
            activeRecorder.onstop = () => {
                const blob = new Blob(chunks, { type: activeRecorder.mimeType });
                if (blob.size) resolve(blob);
                else reject(new Error("Video recording produced no data."));
            };
            video.onerror = () => reject(new Error("Video playback failed."));
            video.onended = stop;
        });
        activeRecorder.start();
        const playback = video.play();
        const draw = () => {
            if (options.cancelled?.() || video.ended || video.currentTime >= end) { video.pause(); stop(); return; }
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            options.onProgress?.(Math.min(100, Math.round((video.currentTime - start) / (end - start) * 100)));
            frame = requestAnimationFrame(draw);
        };
        await Promise.race([Promise.all([playback, audioReady]), result]);
        draw();
        return await result;
    } finally {
        cancelAnimationFrame(frame);
        video.pause();
        if (recorder && recorder.state !== "inactive") recorder.stop();
        stream?.getTracks().forEach(track => track.stop());
        if (audio) await audio.close();
        video.removeAttribute("src");
        video.load();
        URL.revokeObjectURL(url);
    }
}
