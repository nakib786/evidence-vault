/**
 * Video capture, format negotiation, and frame extraction.
 *
 * Video matters more than stills for a lot of what this tool documents. Street
 * harassment, a confrontation, someone shouting at a person in a shop — none of that is
 * a screenshot, and the words are usually the evidence. So recording carries audio by
 * default, and the UI says so plainly before the microphone is ever opened.
 *
 * Everything here is local. A recording is hashed the moment it stops, exactly like a
 * still capture, and is never uploaded.
 */

export const MAX_VIDEO_SECONDS = 300;
export const MAX_VIDEO_BYTES = 200 * 1024 * 1024;

// Audio-only is allowed to run much longer than video for the same size cap — a spoken
// account or a recorded call is a fraction of a video's bytes per second, so ten minutes of
// audio is still a small file where ten minutes of video would not be.
export const MAX_AUDIO_SECONDS = 600;
export const MAX_AUDIO_BYTES = 50 * 1024 * 1024;

export const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif'];
export const ACCEPTED_VIDEO_TYPES = ['video/webm', 'video/mp4', 'video/quicktime', 'video/x-matroska', 'video/ogg'];
export const ACCEPTED_AUDIO_TYPES = [
  'audio/webm', 'audio/ogg', 'audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/wav', 'audio/x-m4a', 'audio/x-wav',
];

export const isVideo = (mime: string): boolean =>
  mime.startsWith('video/') || ACCEPTED_VIDEO_TYPES.includes(mime);

export const isAudio = (mime: string): boolean =>
  mime.startsWith('audio/') || ACCEPTED_AUDIO_TYPES.includes(mime);

/**
 * Pick a container/codec the browser will actually record.
 *
 * Chrome and Firefox record WebM; Safari only records MP4. Passing an unsupported type
 * to MediaRecorder throws, and passing nothing gives you whatever the browser prefers —
 * which is fine, but then we cannot label the file correctly.
 */
export function pickRecordingMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4;codecs=avc1,mp4a.40.2',
    'video/mp4',
  ];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t));
}

/** Same idea as `pickRecordingMimeType`, for a stream with no video track. */
export function pickAudioRecordingMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/ogg'];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t));
}

export const extensionForMime = (mime: string): string => {
  const base = mime.split(';')[0].trim();
  return (
    {
      'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp',
      'image/gif': 'gif', 'image/avif': 'avif',
      'video/webm': 'webm', 'video/mp4': 'mp4', 'video/quicktime': 'mov',
      'video/x-matroska': 'mkv', 'video/ogg': 'ogv',
      'audio/webm': 'weba', 'audio/ogg': 'oga', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a',
      'audio/aac': 'aac', 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/x-m4a': 'm4a',
    }[base] ?? 'bin'
  );
};

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '--:--';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Load a blob into a detached <video> element and wait for its metadata. */
function loadVideoElement(blob: Blob): Promise<{ video: HTMLVideoElement; url: string }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    video.onloadedmetadata = () => resolve({ video, url });
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('This video could not be read.'));
    };
    video.src = url;
  });
}

/**
 * Determine a video's duration.
 *
 * MediaRecorder output frequently reports `Infinity` because the container is written
 * without a duration header when recording stops. The usual workaround is to seek far
 * past the end, which forces the browser to compute the real duration.
 */
export async function getVideoDuration(blob: Blob): Promise<number> {
  const { video, url } = await loadVideoElement(blob);
  try {
    if (Number.isFinite(video.duration) && video.duration > 0) return video.duration;

    return await new Promise<number>((resolve) => {
      const done = () => {
        video.ontimeupdate = null;
        resolve(Number.isFinite(video.duration) ? video.duration : 0);
      };
      video.ontimeupdate = () => {
        if (video.currentTime > 0) done();
      };
      video.currentTime = 1e8;
      setTimeout(done, 3000);
    });
  } finally {
    URL.revokeObjectURL(url);
    video.src = '';
  }
}

/**
 * A `<video>` element loads and reports metadata for an audio-only source exactly as it
 * does for one with picture, so there is no separate implementation needed here — only a
 * name that doesn't lie to whoever's calling it for an audio blob.
 */
export const getAudioDuration = getVideoDuration;

export interface VideoFrame {
  /** PNG data URL. */
  dataUrl: string;
  /** Seconds into the recording. */
  at: number;
  width: number;
  height: number;
}

/**
 * Grab evenly spaced frames from a video.
 *
 * A PDF cannot play video, so the report carries a contact sheet instead — the same
 * approach a forensic report uses. It lets a reviewer see the substance of a recording
 * without opening the file, while the original video travels alongside it.
 */
export async function extractFrames(blob: Blob, count = 6): Promise<VideoFrame[]> {
  const duration = await getVideoDuration(blob);
  const { video, url } = await loadVideoElement(blob);
  const frames: VideoFrame[] = [];

  try {
    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height) return frames;

    // Cap the contact sheet's resolution; six full-size frames would dwarf the report.
    const scale = Math.min(1, 480 / width);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return frames;

    const usable = Number.isFinite(duration) && duration > 0 ? duration : 0;
    for (let i = 0; i < count; i += 1) {
      // Offset from the very start/end, which are often black or mid-transition.
      const at = usable ? ((i + 0.5) / count) * usable : 0;
      const ok = await seekTo(video, at);
      if (!ok) break;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      frames.push({
        dataUrl: canvas.toDataURL('image/jpeg', 0.75),
        at,
        width: canvas.width,
        height: canvas.height,
      });
      if (!usable) break;
    }
  } finally {
    URL.revokeObjectURL(url);
    video.src = '';
  }

  return frames;
}

function seekTo(video: HTMLVideoElement, time: number): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      video.onseeked = null;
      resolve(ok);
    };
    video.onseeked = () => finish(true);
    try {
      video.currentTime = time;
    } catch {
      finish(false);
    }
    setTimeout(() => finish(false), 4000);
  });
}

/** A single representative frame, used as the blurred preview for a recording. */
export async function posterFrame(blob: Blob): Promise<string | null> {
  const frames = await extractFrames(blob, 1);
  return frames[0]?.dataUrl ?? null;
}
