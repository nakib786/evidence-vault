/**
 * Screen 1 — how the evidence gets in.
 *
 * Three routes, and the ordering is a judgement about what people actually need. Video
 * comes first: a lot of what this tool documents is spoken, not written, and a still
 * frame loses the words entirely. Photo second, import last.
 *
 * Live capture is the stronger record either way — the bytes are hashed inside this app,
 * so there is no window in which a pre-edited or generated file could be substituted.
 * Import is the honest fallback for when the moment has passed, and the report always
 * says which route was used.
 *
 * Neither camera nor microphone is touched until the user picks a live mode. The browser
 * permission prompt should never appear as a surprise on a screen about hate speech.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Button, Callout, Card, Field, inputClass } from './ui';
import type { CaptureItem, CaptureMeta, CaptureSource, MediaKind } from '../lib/types';
import {
  ACCEPTED_IMAGE_TYPES,
  ACCEPTED_VIDEO_TYPES,
  MAX_VIDEO_BYTES,
  MAX_VIDEO_SECONDS,
  formatDuration,
  getVideoDuration,
  isVideo,
  pickRecordingMimeType,
} from '../lib/media';

const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
const BURST_COUNT = 5;
const BURST_INTERVAL_MS = 220;
const TIMER_OPTIONS = [0, 3, 10] as const;
const LOW_LIGHT_THRESHOLD = 55; // mean luma out of 255, sampled from a downscaled frame

type FacingMode = 'user' | 'environment';
type BrightnessProp = 'exposureCompensation' | 'brightness';

/**
 * Torch, zoom, and exposure controls are real, broadly-supported capabilities on phones
 * and tablets, but they were still experimental when lib.dom.d.ts's MediaTrack* interfaces
 * were written, so TypeScript doesn't know about them. These extend the standard shapes
 * rather than casting through `any`, so everything downstream stays type-checked.
 */
interface ExtendedTrackCapabilities extends MediaTrackCapabilities {
  torch?: boolean;
  zoom?: { min: number; max: number; step: number };
  exposureCompensation?: { min: number; max: number; step: number };
  brightness?: { min: number; max: number; step: number };
}
interface ExtendedTrackSettings extends MediaTrackSettings {
  zoom?: number;
  exposureCompensation?: number;
  brightness?: number;
}
interface ExtendedTrackConstraintSet extends MediaTrackConstraintSet {
  torch?: boolean;
  zoom?: number;
  exposureCompensation?: number;
  brightness?: number;
}

export interface CapturePayload {
  blob: Blob;
  source: CaptureSource;
  kind: MediaKind;
  durationSeconds?: number;
  hasAudio?: boolean;
  /** Live capture only — see `CaptureMeta`. */
  captureMeta?: CaptureMeta;
}

interface Props {
  /** Everything captured so far this session — see the file-level comment on batching. */
  items: CaptureItem[];
  onCaptured: (payload: CapturePayload) => void;
  /** Leaves the capture screen for good and moves on to filling in the report. */
  onDone: () => void;
}

type Mode = 'choose' | 'live';

export default function CaptureScreen({ items, onCaptured, onDone }: Props) {
  const [mode, setMode] = useState<Mode>('choose');
  const [error, setError] = useState<string | null>(null);

  const fail = useCallback((message: string) => {
    setError(message);
    setMode('choose');
  }, []);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="font-display text-2xl font-bold text-ink">Document what happened</h1>
        <p className="text-ink-muted">
          Everything stays on this device. Nothing is uploaded, and there is no account to create.
        </p>
      </div>

      {error ? (
        <Callout tone="caution" title="That didn’t work">
          {error}
        </Callout>
      ) : null}

      {mode === 'choose' ? (
        <ChooseMode
          items={items}
          onPick={() => {
            setError(null);
            setMode('live');
          }}
          onFile={onCaptured}
          onError={setError}
          onDone={onDone}
        />
      ) : (
        <LiveCapture
          items={items}
          onCaptured={onCaptured}
          onCancel={() => setMode('choose')}
          onError={fail}
          onDone={onDone}
        />
      )}
    </div>
  );
}

function ChooseMode({
  items,
  onPick,
  onFile,
  onError,
  onDone,
}: {
  items: CaptureItem[];
  onPick: () => void;
  onFile: (payload: CapturePayload) => void;
  onError: (message: string) => void;
  onDone: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const accepted = [...ACCEPTED_IMAGE_TYPES, ...ACCEPTED_VIDEO_TYPES];

  const handleFile = async (file: File | undefined): Promise<void> => {
    if (!file) return;
    const video = isVideo(file.type);
    if (!accepted.includes(file.type) && !video) {
      onError(`That file is a ${file.type || 'unknown type'}. Please choose an image or a video.`);
      return;
    }
    const cap = video ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
    if (file.size > cap) {
      onError(
        `That file is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is ${cap / 1024 / 1024} MB.`,
      );
      return;
    }

    if (!video) {
      onFile({ blob: file, source: 'upload', kind: 'image' });
      return;
    }

    // Read the duration here rather than trusting the file to carry it. A live recording
    // knows how long it ran; an imported one does not, and reporting every uploaded video
    // as "0:00" in the record would be quietly wrong.
    let durationSeconds: number | undefined;
    try {
      const seconds = await getVideoDuration(file);
      if (Number.isFinite(seconds) && seconds > 0) durationSeconds = seconds;
    } catch {
      /* duration stays undefined; the report says "not available" rather than "0:00" */
    }
    onFile({ blob: file, source: 'upload', kind: 'video', durationSeconds });
  };

  return (
    <div className="space-y-4">
      {items.length > 0 ? (
        <Card className="space-y-3" data-tour="capture-batch">
          <div className="flex items-start gap-3">
            <BatchIcon />
            <div className="flex-1">
              <h2 className="font-display text-lg font-bold text-ink">
                {items.length} item{items.length === 1 ? '' : 's'} captured this session
              </h2>
              <p className="mt-1 text-sm text-ink-muted">
                Each is fingerprinted in the background as it comes in. Keep going below, or finish up
                and fill in the report.
              </p>
            </div>
          </div>
          <BatchStrip items={items} />
          <Button block onClick={onDone}>
            Review &amp; fill out report
          </Button>
        </Card>
      ) : null}

      <Card className="space-y-3" data-tour="capture-live">
        <div className="flex items-start gap-3">
          <CameraIcon />
          <div className="flex-1">
            <h2 className="font-display text-lg font-bold text-ink">
              {items.length > 0 ? 'Take another photo or video' : 'Take a photo or record video'}
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              A screen, a poster or graffiti as a photo — or anything spoken, like a confrontation or
              abuse shouted at someone, as video with sound. Switch between the two once the camera is
              open, take as many as you need one after another, and each is fingerprinted the instant
              you capture it.
            </p>
          </div>
        </div>
        <Button block onClick={onPick}>
          {items.length > 0 ? 'Add another' : 'Open camera'}
        </Button>
        <p className="text-xs text-ink-subtle">
          Your browser will ask for camera and microphone permission first. Nothing is captured until
          you press the button. Video is capped at {MAX_VIDEO_SECONDS / 60} minutes.
        </p>
      </Card>

      <Card className="space-y-3" data-tour="capture-upload">
        <div className="flex items-start gap-3">
          <FileIcon />
          <div className="flex-1">
            <h2 className="font-display text-lg font-bold text-ink">Use a file you already have</h2>
            <p className="mt-1 text-sm text-ink-muted">
              A screenshot or a video from your device. Faster if the moment has passed — the record
              will note that the file existed before this app saw it.
            </p>
          </div>
        </div>
        {/* Kept out of the tab order: the visible button below is the real control, and
            two stops for one action is just noise for keyboard and screen reader users. */}
        <input
          ref={inputRef}
          type="file"
          accept={accepted.join(',')}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            void handleFile(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        <Button variant="secondary" block onClick={() => inputRef.current?.click()}>
          Choose a file
        </Button>
      </Card>
    </div>
  );
}

function LiveCapture({
  items,
  onCaptured,
  onCancel,
  onError,
  onDone,
}: {
  items: CaptureItem[];
  onCaptured: (payload: CapturePayload) => void;
  onCancel: () => void;
  onError: (message: string) => void;
  onDone: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const startedAtRef = useRef<number>(0);

  // Photo and video used to be two separate entry points into this screen; now they're one
  // camera view with a mode switch, like an ordinary phone camera app, so this lives here
  // as state rather than arriving as a prop. Switching modes toggles whether the microphone
  // is requested (see `wantsAudio` below), which reopens the stream — the same mechanism
  // that already reopens it for a flipped camera or a picked device.
  const [mode, setMode] = useState<'photo' | 'video'>('photo');
  const [ready, setReady] = useState(false);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [busy, setBusy] = useState(false);
  const [hasAudio, setHasAudio] = useState(false);

  // Which physical devices are in use, and what the browser says is plugged in. Selection
  // stays in device-id terms once the user picks something specific; `facing` is only the
  // driver for the plain "flip the camera" gesture, and is corrected from the stream's own
  // reported settings so the mirrored preview and the flip button never fall out of sync.
  const [facing, setFacing] = useState<FacingMode>('environment');
  const [videoDeviceId, setVideoDeviceId] = useState<string | null>(null);
  const [audioDeviceId, setAudioDeviceId] = useState<string | null>(null);
  const [videoInputs, setVideoInputs] = useState<MediaDeviceInfo[]>([]);
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [activeStream, setActiveStream] = useState<MediaStream | null>(null);

  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [zoomRange, setZoomRange] = useState<{ min: number; max: number; step: number } | null>(null);
  const [zoomValue, setZoomValue] = useState(1);
  const [showGrid, setShowGrid] = useState(false);
  const [showDevicePanel, setShowDevicePanel] = useState(false);

  // Lighting adjustment. Chrome exposes exposureCompensation (EV stops) on most hardware;
  // a few devices only report the coarser `brightness` instead. Whichever the camera has,
  // it's surfaced as one "Brightness" slider — the distinction only matters for the value
  // shown next to it, and for how it's later described in the report.
  const [brightnessProp, setBrightnessProp] = useState<BrightnessProp | null>(null);
  const [brightnessRange, setBrightnessRange] = useState<{ min: number; max: number; step: number } | null>(
    null,
  );
  const [brightnessValue, setBrightnessValue] = useState(0);
  const [lowLight, setLowLight] = useState(false);

  // Self-timer: 0 (off), 3, or 10 seconds. `countdown` is only non-null while one is running.
  const [timerSeconds, setTimerSeconds] = useState<(typeof TIMER_OPTIONS)[number]>(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Burst mode. `burstMeta` is captured once, at the moment the frames are taken, rather
  // than recomputed when the user later picks one — the metadata should describe the
  // settings that were actually in effect for those pixels, not whatever the camera
  // happens to be set to by the time a frame is chosen.
  const [burstFrames, setBurstFrames] = useState<{ blob: Blob; url: string }[] | null>(null);
  const [burstMeta, setBurstMeta] = useState<CaptureMeta | null>(null);
  const [selectedBurstIndex, setSelectedBurstIndex] = useState<number | null>(null);
  const [burstCapturing, setBurstCapturing] = useState(false);

  const wantsAudio = mode === 'video';
  const canReconfigure =
    ready && !recording && !busy && !burstCapturing && !burstFrames && countdown === null;

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setActiveStream(null);
  }, []);

  // Revoke burst thumbnail URLs whenever the set changes (a retake, a fresh burst, or the
  // screen unmounting with the picker still open) — one effect handles every path.
  useEffect(() => {
    return () => {
      burstFrames?.forEach((f) => URL.revokeObjectURL(f.url));
    };
  }, [burstFrames]);

  useEffect(() => {
    return () => {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, []);

  // Device labels are only populated once permission has been granted, so this is called
  // after the first successful getUserMedia — and again on `devicechange`, so a camera or
  // microphone plugged in mid-session (a USB webcam, a headset) shows up without a reload.
  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const list = await navigator.mediaDevices.enumerateDevices();
      setVideoInputs(list.filter((d) => d.kind === 'videoinput'));
      setAudioInputs(list.filter((d) => d.kind === 'audioinput'));
    } catch {
      /* enumeration is a nicety; a failure here shouldn't block capture */
    }
  }, []);

  useEffect(() => {
    if (!navigator.mediaDevices?.addEventListener) return;
    navigator.mediaDevices.addEventListener('devicechange', refreshDevices);
    return () => navigator.mediaDevices.removeEventListener('devicechange', refreshDevices);
  }, [refreshDevices]);

  // Opens the camera/microphone, and reopens them whenever the flip button or the device
  // pickers change the selection. A picked deviceId always wins over facingMode; facingMode
  // is just the driver for the plain "flip the camera" gesture.
  useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia) {
      onError('This browser cannot open the camera. You can still choose a file instead.');
      return;
    }
    let cancelled = false;
    let localStream: MediaStream | null = null;

    (async () => {
      try {
        const video: MediaTrackConstraints = videoDeviceId
          ? { deviceId: { exact: videoDeviceId }, width: { ideal: 1920 } }
          : { facingMode: { ideal: facing }, width: { ideal: 1920 } };
        const audio: MediaTrackConstraints | boolean = !wantsAudio
          ? false
          : audioDeviceId
            ? { deviceId: { exact: audioDeviceId } }
            : true;

        const stream = await navigator.mediaDevices.getUserMedia({ video, audio });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        localStream = stream;
        streamRef.current = stream;
        setActiveStream(stream);
        setHasAudio(stream.getAudioTracks().length > 0);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }

        const track = stream.getVideoTracks()[0];
        const settings = (track?.getSettings?.() ?? {}) as ExtendedTrackSettings;
        if (settings.facingMode === 'user' || settings.facingMode === 'environment') {
          setFacing(settings.facingMode);
        }
        const caps = (track?.getCapabilities?.() ?? {}) as ExtendedTrackCapabilities;
        setTorchSupported(!!caps.torch);
        setTorchOn(false);
        if (caps.zoom) {
          setZoomRange({ min: caps.zoom.min, max: caps.zoom.max, step: caps.zoom.step || 0.1 });
          setZoomValue(settings.zoom ?? caps.zoom.min);
        } else {
          setZoomRange(null);
        }
        if (caps.exposureCompensation) {
          setBrightnessProp('exposureCompensation');
          setBrightnessRange({
            min: caps.exposureCompensation.min,
            max: caps.exposureCompensation.max,
            step: caps.exposureCompensation.step || 0.25,
          });
          setBrightnessValue(settings.exposureCompensation ?? 0);
        } else if (caps.brightness) {
          setBrightnessProp('brightness');
          setBrightnessRange({ min: caps.brightness.min, max: caps.brightness.max, step: caps.brightness.step || 1 });
          setBrightnessValue(settings.brightness ?? (caps.brightness.min + caps.brightness.max) / 2);
        } else {
          setBrightnessProp(null);
          setBrightnessRange(null);
        }

        setReady(true);
        void refreshDevices();
      } catch (err) {
        const name = err instanceof DOMException ? err.name : '';
        onError(
          name === 'NotAllowedError'
            ? `Permission was declined. You can allow ${wantsAudio ? 'camera and microphone' : 'camera'} access in your browser settings, or choose a file instead.`
            : name === 'NotFoundError' || name === 'OverconstrainedError'
              ? 'That camera or microphone could not be found. You can choose a file instead.'
              : 'The camera could not be opened. You can choose a file instead.',
        );
      }
    })();

    return () => {
      cancelled = true;
      localStream?.getTracks().forEach((t) => t.stop());
    };
  }, [facing, videoDeviceId, audioDeviceId, wantsAudio, onError, refreshDevices]);

  // Belt-and-braces: if the screen is torn down mid-shot, don't leave a recorder running.
  useEffect(() => {
    return () => {
      if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    };
  }, []);

  const flipCamera = useCallback(() => {
    if (!canReconfigure) return;
    setVideoDeviceId(null);
    setFacing((f) => (f === 'environment' ? 'user' : 'environment'));
  }, [canReconfigure]);

  const switchMode = useCallback(
    (next: 'photo' | 'video') => {
      if (!canReconfigure || next === mode) return;
      setMode(next);
    },
    [canReconfigure, mode],
  );

  const toggleTorch = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torchOn;
    const constraint: ExtendedTrackConstraintSet = { torch: next };
    try {
      await track.applyConstraints({ advanced: [constraint] });
      setTorchOn(next);
    } catch {
      /* some browsers advertise torch but reject it mid-stream; leave state unchanged */
    }
  }, [torchOn]);

  const handleZoom = useCallback(async (value: number) => {
    setZoomValue(value);
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const constraint: ExtendedTrackConstraintSet = { zoom: value };
    try {
      await track.applyConstraints({ advanced: [constraint] });
    } catch {
      /* ignore — the slider still reflects the requested value */
    }
  }, []);

  const handleBrightness = useCallback(
    async (value: number) => {
      setBrightnessValue(value);
      const track = streamRef.current?.getVideoTracks()[0];
      if (!track || !brightnessProp) return;
      const constraint: ExtendedTrackConstraintSet =
        brightnessProp === 'exposureCompensation' ? { exposureCompensation: value } : { brightness: value };
      try {
        await track.applyConstraints({ advanced: [constraint] });
      } catch {
        /* ignore — the slider still reflects the requested value */
      }
    },
    [brightnessProp],
  );

  const cycleTimer = useCallback(() => {
    if (!canReconfigure) return;
    setTimerSeconds((t) => TIMER_OPTIONS[(TIMER_OPTIONS.indexOf(t) + 1) % TIMER_OPTIONS.length]);
  }, [canReconfigure]);

  const cancelCountdown = useCallback(() => {
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    countdownIntervalRef.current = null;
    setCountdown(null);
  }, []);

  /**
   * Runs `fire` immediately if the timer is off, or after a visible countdown otherwise.
   * The countdown itself lives in a plain closure variable rather than the `countdown`
   * state's updater callback, so `fire` — which starts real capture work — is called
   * exactly once even under React StrictMode's double-invoked updaters in development.
   */
  const runWithTimer = useCallback(
    (fire: () => void) => {
      if (timerSeconds <= 0) {
        fire();
        return;
      }
      let remaining = timerSeconds;
      setCountdown(remaining);
      countdownIntervalRef.current = setInterval(() => {
        remaining -= 1;
        if (remaining <= 0) {
          if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
          setCountdown(null);
          fire();
        } else {
          setCountdown(remaining);
        }
      }, 1000);
    },
    [timerSeconds],
  );

  // A light, once-a-second read of the scene's average brightness, downscaled to a handful
  // of pixels so the cost is trivial. Purely advisory — it only ever suggests the torch or
  // the brightness slider that already sit right below it.
  useEffect(() => {
    if (!ready) {
      setLowLight(false);
      return;
    }
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 9;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const id = setInterval(() => {
      if (video.readyState < 2) return;
      try {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
        let sum = 0;
        for (let i = 0; i < data.length; i += 4) {
          sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        }
        setLowLight(sum / (data.length / 4) < LOW_LIGHT_THRESHOLD);
      } catch {
        /* a frame that isn't ready yet; skip this sample */
      }
    }, 1200);

    return () => clearInterval(id);
  }, [ready]);

  // Recording timer, and the hard stop at the duration cap.
  useEffect(() => {
    if (!recording) return;
    const id = setInterval(() => {
      const secs = (Date.now() - startedAtRef.current) / 1000;
      setElapsed(secs);
      if (secs >= MAX_VIDEO_SECONDS) stopRecording();
    }, 200);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording]);

  /** Technical facts about the shot in progress, as of right now — see `CaptureMeta`. */
  const buildCaptureMeta = useCallback(
    (extra?: Partial<CaptureMeta>): CaptureMeta => {
      const videoTrack = streamRef.current?.getVideoTracks()[0];
      const audioTrack = streamRef.current?.getAudioTracks()[0];
      return {
        facingMode: facing,
        cameraLabel: videoTrack?.label || undefined,
        microphoneLabel: audioTrack?.label || undefined,
        torchOn: torchSupported ? torchOn : undefined,
        zoom: zoomRange ? zoomValue : undefined,
        exposureCompensation: brightnessProp === 'exposureCompensation' ? brightnessValue : undefined,
        brightness: brightnessProp === 'brightness' ? brightnessValue : undefined,
        timerSeconds: timerSeconds > 0 ? timerSeconds : undefined,
        ...extra,
      };
    },
    [facing, torchSupported, torchOn, zoomRange, zoomValue, brightnessProp, brightnessValue, timerSeconds],
  );

  /** Draws the current video frame to a canvas and encodes it — the one place a still is made. */
  const captureFrameBlob = useCallback(async (): Promise<Blob | null> => {
    const video = videoRef.current;
    if (!video) return null;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0);
    return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  }, []);

  // Deliberately does not stop the stream: the camera stays open and ready for the next
  // shot, so a batch of photos (or a mix of photos and videos) can be taken back-to-back
  // without leaving this screen. See `onDone` for the explicit "finished, review it" exit.
  const capturePhoto = async (): Promise<void> => {
    if (busy) return;
    setBusy(true);
    try {
      const blob = await captureFrameBlob();
      if (!blob) throw new Error('encode failed');
      const captureMeta = buildCaptureMeta();
      onCaptured({ blob, source: 'live', kind: 'image', captureMeta });
    } catch {
      onError('The frame could not be captured. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const captureBurst = async (): Promise<void> => {
    if (!ready || busy || burstCapturing) return;
    setBurstCapturing(true);
    const meta = buildCaptureMeta();
    const frames: { blob: Blob; url: string }[] = [];
    try {
      for (let i = 0; i < BURST_COUNT; i += 1) {
        const blob = await captureFrameBlob();
        if (blob) frames.push({ blob, url: URL.createObjectURL(blob) });
        if (i < BURST_COUNT - 1) await new Promise((r) => setTimeout(r, BURST_INTERVAL_MS));
      }
      if (frames.length === 0) throw new Error('no frames captured');
      setBurstMeta(meta);
      setBurstFrames(frames);
      // Pre-select the middle frame: with a handheld shot, it's usually the steadiest.
      setSelectedBurstIndex(Math.floor(frames.length / 2));
    } catch {
      frames.forEach((f) => URL.revokeObjectURL(f.url));
      onError('The burst could not be captured. Please try again.');
    } finally {
      setBurstCapturing(false);
    }
  };

  const retakeBurst = useCallback(() => {
    setBurstFrames(null);
    setBurstMeta(null);
    setSelectedBurstIndex(null);
  }, []);

  const chooseBurstFrame = useCallback(() => {
    if (!burstFrames || selectedBurstIndex === null || !burstMeta) return;
    const chosen = burstFrames[selectedBurstIndex];
    onCaptured({
      blob: chosen.blob,
      source: 'live',
      kind: 'image',
      captureMeta: { ...burstMeta, burstIndex: selectedBurstIndex + 1, burstCount: burstFrames.length },
    });
    // Back to the live preview, ready for the next shot, rather than leaving this picker
    // on screen for a batch that's already moved on.
    setBurstFrames(null);
    setBurstMeta(null);
    setSelectedBurstIndex(null);
  }, [burstFrames, selectedBurstIndex, burstMeta, onCaptured]);

  const startRecording = (): void => {
    const stream = streamRef.current;
    if (!stream) return;
    try {
      const mimeType = pickRecordingMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const type = recorder.mimeType || mimeType || 'video/webm';
        const blob = new Blob(chunksRef.current, { type: type.split(';')[0] });
        chunksRef.current = [];
        const seconds = (Date.now() - startedAtRef.current) / 1000;
        const captureMeta = buildCaptureMeta();
        onCaptured({
          blob,
          source: 'live',
          kind: 'video',
          durationSeconds: seconds,
          hasAudio,
          captureMeta,
        });
        // Camera stays open (see `capturePhoto`'s comment) — clear the busy flag `stopRecording`
        // set so "Start recording" is immediately available again for the next clip.
        setBusy(false);
      };
      recorder.onerror = () => onError('Recording stopped unexpectedly. Please try again.');

      recorderRef.current = recorder;
      startedAtRef.current = Date.now();
      // Timeslice keeps data flowing, so a crash mid-recording loses seconds, not everything.
      recorder.start(1000);
      setRecording(true);
    } catch {
      onError('This browser cannot record video. You can take a photo or choose a file instead.');
    }
  };

  const stopRecording = (): void => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== 'recording') return;
    setBusy(true);
    recorder.stop();
    setRecording(false);
  };

  const overCap = elapsed >= MAX_VIDEO_SECONDS - 15;
  const showFlip = videoInputs.length > 1;
  const mirror = facing === 'user';

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-2xl border border-line bg-ink">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption -- live preview, not playback */}
        <video
          ref={videoRef}
          playsInline
          muted
          className={`aspect-[3/4] w-full object-cover ${mirror ? '-scale-x-100' : ''}`}
          aria-label="Live camera preview"
        />

        {showGrid ? <GridOverlay /> : null}

        {recording ? (
          <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-danger px-3 py-1.5">
            <span className="size-2.5 animate-pulse rounded-full bg-white" aria-hidden="true" />
            <span className="font-mono text-sm font-semibold tabular-nums text-white">
              {formatDuration(elapsed)}
            </span>
            <span className="sr-only">Recording in progress</span>
          </div>
        ) : items.length > 0 ? (
          <div className="absolute left-3 top-3">
            <StatusPill>
              <CheckIcon />
              {items.length} captured
            </StatusPill>
          </div>
        ) : null}

        {ready ? (
          <div className="absolute right-3 top-3 flex flex-col items-end gap-1.5">
            <StatusPill>
              <LiveDot />
              Camera
            </StatusPill>
            {wantsAudio ? (
              hasAudio ? (
                <StatusPill>
                  <MicLevelMeter stream={activeStream} />
                  Mic
                </StatusPill>
              ) : (
                <StatusPill tone="warn">
                  <MicOffIcon />
                  No mic
                </StatusPill>
              )
            ) : null}
          </div>
        ) : null}

        {ready ? (
          <div className="absolute bottom-3 right-3 flex items-center gap-2">
            <ToolButton label="Grid overlay" active={showGrid} onClick={() => setShowGrid((g) => !g)}>
              <GridIcon />
            </ToolButton>
            <ToolButton
              label={`Self-timer: ${timerSeconds === 0 ? 'off' : `${timerSeconds} seconds`}`}
              active={timerSeconds > 0}
              onClick={cycleTimer}
              disabled={!canReconfigure}
            >
              {timerSeconds === 0 ? <TimerIcon /> : <span className="text-xs font-bold">{timerSeconds}s</span>}
            </ToolButton>
            {torchSupported ? (
              <ToolButton label="Flashlight" active={torchOn} onClick={() => void toggleTorch()}>
                <FlashIcon />
              </ToolButton>
            ) : null}
            {showFlip ? (
              <ToolButton label="Switch camera" onClick={flipCamera} disabled={!canReconfigure}>
                <FlipCameraIcon />
              </ToolButton>
            ) : null}
          </div>
        ) : null}

        {countdown !== null ? (
          <div className="absolute inset-0 flex items-center justify-center bg-ink/45">
            <span
              key={countdown}
              className="animate-[ev-countdown-pop_1s_ease-out] font-display text-7xl font-bold text-white drop-shadow-lg"
              aria-hidden="true"
            >
              {countdown}
            </span>
            <span className="sr-only" aria-live="assertive">
              Capturing in {countdown} second{countdown === 1 ? '' : 's'}
            </span>
          </div>
        ) : null}
      </div>

      {items.length > 0 && !burstFrames ? <BatchStrip items={items} /> : null}

      {lowLight && !burstFrames ? (
        <Callout tone="caution" title="It looks dark">
          {torchSupported && !torchOn
            ? 'Try the flashlight, or the brightness control below, for a clearer record.'
            : 'Try moving somewhere brighter, or use the brightness control below, for a clearer record.'}
        </Callout>
      ) : null}

      {zoomRange ? (
        <div className="flex items-center gap-3 px-1">
          <span className="w-16 shrink-0 text-xs font-semibold text-ink-subtle">Zoom</span>
          <input
            type="range"
            min={zoomRange.min}
            max={zoomRange.max}
            step={zoomRange.step}
            value={zoomValue}
            onChange={(e) => void handleZoom(Number(e.target.value))}
            disabled={!canReconfigure}
            className="h-1.5 flex-1 accent-accent disabled:opacity-50"
            aria-label="Camera zoom"
          />
          <span className="w-9 text-right font-mono text-xs tabular-nums text-ink-subtle">
            {zoomValue.toFixed(1)}×
          </span>
        </div>
      ) : null}

      {brightnessRange ? (
        <div className="flex items-center gap-3 px-1">
          <span className="w-16 shrink-0 text-xs font-semibold text-ink-subtle">Brightness</span>
          <input
            type="range"
            min={brightnessRange.min}
            max={brightnessRange.max}
            step={brightnessRange.step}
            value={brightnessValue}
            onChange={(e) => void handleBrightness(Number(e.target.value))}
            disabled={!canReconfigure}
            className="h-1.5 flex-1 accent-accent disabled:opacity-50"
            aria-label="Camera brightness"
          />
          <span className="w-12 text-right font-mono text-xs tabular-nums text-ink-subtle">
            {brightnessProp === 'exposureCompensation'
              ? `${brightnessValue > 0 ? '+' : ''}${brightnessValue.toFixed(2)}`
              : Math.round(brightnessValue)}
          </span>
        </div>
      ) : null}

      {mode === 'video' && ready && !hasAudio ? (
        <Callout tone="caution" title="Recording without sound">
          The microphone is unavailable, so this will record picture only. If the words matter, that
          is a significant loss — check your microphone permission before recording.
        </Callout>
      ) : null}

      {ready && !burstFrames ? (
        <DevicePanel
          open={showDevicePanel}
          onToggle={() => setShowDevicePanel((s) => !s)}
          videoInputs={videoInputs}
          audioInputs={audioInputs}
          videoDeviceId={videoDeviceId}
          audioDeviceId={audioDeviceId}
          onVideoChange={setVideoDeviceId}
          onAudioChange={setAudioDeviceId}
          showAudio={wantsAudio}
          disabled={!canReconfigure}
        />
      ) : null}

      {ready && !burstFrames ? (
        <ModeToggle mode={mode} onChange={switchMode} disabled={!canReconfigure} />
      ) : null}

      {burstFrames ? (
        <BurstPicker
          frames={burstFrames}
          selected={selectedBurstIndex}
          onSelect={setSelectedBurstIndex}
          onRetake={retakeBurst}
          onUse={chooseBurstFrame}
          disabled={busy}
        />
      ) : recording ? (
        <>
          <div aria-live="polite" className="sr-only">
            Recording, {Math.floor(elapsed)} seconds elapsed
          </div>
          {overCap ? (
            <Callout tone="caution" title="Approaching the recording limit">
              Recording stops automatically at {MAX_VIDEO_SECONDS / 60} minutes.
            </Callout>
          ) : null}
          <Button variant="danger" block onClick={stopRecording} disabled={busy}>
            {busy ? 'Saving…' : 'Stop recording'}
          </Button>
        </>
      ) : mode === 'video' ? (
        <Button
          block
          onClick={() => runWithTimer(startRecording)}
          disabled={!ready || busy || countdown !== null}
        >
          {countdown !== null
            ? `Starting in ${countdown}…`
            : ready
              ? 'Start recording'
              : 'Waiting for camera…'}
        </Button>
      ) : (
        <>
          <Button
            block
            onClick={() => runWithTimer(() => void capturePhoto())}
            disabled={!ready || busy || burstCapturing || countdown !== null}
          >
            {countdown !== null
              ? `Capturing in ${countdown}…`
              : busy
                ? 'Capturing…'
                : ready
                  ? 'Capture this frame'
                  : 'Waiting for camera…'}
          </Button>
          <Button
            variant="secondary"
            block
            onClick={() => void captureBurst()}
            disabled={!ready || busy || burstCapturing || countdown !== null}
          >
            {burstCapturing ? 'Capturing burst…' : `Burst mode — ${BURST_COUNT} shots`}
          </Button>
        </>
      )}

      {!recording && !burstFrames && countdown === null && items.length > 0 ? (
        <Button
          variant="secondary"
          block
          onClick={() => {
            stopStream();
            onDone();
          }}
        >
          Done — review &amp; fill out report ({items.length})
        </Button>
      ) : null}

      {!recording && !burstFrames ? (
        <Button variant="quiet" block onClick={countdown !== null ? cancelCountdown : onCancel}>
          {countdown !== null ? 'Cancel countdown' : 'Cancel'}
        </Button>
      ) : null}
    </div>
  );
}

/**
 * A row of small thumbnails for what's been captured this session — shown on both the
 * chooser and the live camera view, so a batch of shots stays visible while more are taken.
 * Deliberately read-only here: removing an item happens on the review screen next, where
 * its full context (and every other item) is already on screen at once.
 */
function BatchStrip({ items }: { items: CaptureItem[] }) {
  return (
    <div
      className="flex gap-2 overflow-x-auto pb-1"
      role="list"
      aria-label={`${items.length} item${items.length === 1 ? '' : 's'} captured this session`}
    >
      {items.map((item, i) => (
        <BatchThumb key={item.id} item={item} index={i} />
      ))}
    </div>
  );
}

function BatchThumb({ item, index }: { item: CaptureItem; index: number }) {
  const url = useMemo(() => URL.createObjectURL(item.blob), [item.blob]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);

  const statusLabel =
    item.status === 'securing' ? 'fingerprinting' : item.status === 'error' ? 'could not be secured' : 'ready';

  return (
    <div
      role="listitem"
      aria-label={`Item ${index + 1}, ${item.kind === 'video' ? 'video' : 'photo'}, ${statusLabel}`}
      className="relative size-14 shrink-0 overflow-hidden rounded-lg border border-line bg-sunken"
    >
      {item.kind === 'video' ? (
        <div className="flex size-full items-center justify-center bg-ink text-white">
          <VideoIcon compact />
        </div>
      ) : (
        <img src={url} alt="" className="size-full object-cover" />
      )}
      {item.status === 'securing' ? (
        <span className="absolute inset-0 flex items-center justify-center bg-ink/45">
          <span className="size-2 animate-pulse rounded-full bg-white" aria-hidden="true" />
        </span>
      ) : item.status === 'error' ? (
        <span className="absolute inset-0 flex items-center justify-center bg-danger/60">
          <span className="text-xs font-bold text-white">!</span>
        </span>
      ) : null}
    </div>
  );
}

function BatchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="mt-0.5 size-6 shrink-0 text-accent"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function VideoIcon({ compact = false }: { compact?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={compact ? 'size-4 shrink-0' : 'mt-0.5 size-6 shrink-0 text-accent'}
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
    >
      <rect x="3" y="6" width="12.5" height="12" rx="2.5" />
      <path d="M15.5 10.5 20.2 7.8a.6.6 0 0 1 .9.5v7.4a.6.6 0 0 1-.9.5l-4.7-2.7z" />
    </svg>
  );
}

function CameraIcon({ compact = false }: { compact?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={compact ? 'size-4 shrink-0' : 'mt-0.5 size-6 shrink-0 text-accent'}
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
    >
      <path d="M3 8.5A2.5 2.5 0 0 1 5.5 6h1.2a1 1 0 0 0 .8-.4l.9-1.2a1 1 0 0 1 .8-.4h5.6a1 1 0 0 1 .8.4l.9 1.2a1 1 0 0 0 .8.4h1.2A2.5 2.5 0 0 1 21 8.5v8A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5z" />
      <circle cx="12" cy="12.5" r="3.5" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg viewBox="0 0 24 24" className="mt-0.5 size-6 shrink-0 text-accent" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M14 3v4.5a1 1 0 0 0 1 1h4.5" />
      <path d="M19.5 10.5V19a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2H14z" />
    </svg>
  );
}

/** A small dark, translucent status chip overlaid on the live preview. */
function StatusPill({ tone = 'neutral', children }: { tone?: 'neutral' | 'warn'; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm ${
        tone === 'warn' ? 'bg-danger/85' : 'bg-ink/70'
      }`}
    >
      {children}
    </span>
  );
}

/** The "camera is live" indicator: a pulsing green light, same idea as a hardware tally lamp. */
function LiveDot() {
  return (
    <span className="relative flex size-2" aria-hidden="true">
      <span className="absolute inline-flex size-full animate-ping rounded-full bg-affirm opacity-75" />
      <span className="relative inline-flex size-2 rounded-full bg-affirm" />
    </span>
  );
}

/**
 * A live microphone-level meter. Reads the input via an AnalyserNode and drives bar heights
 * straight through refs on every animation frame — routing that through React state would
 * mean a re-render at up to 60fps for a purely decorative meter.
 */
function MicLevelMeter({ stream }: { stream: MediaStream | null }) {
  const barsRef = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    if (!stream || stream.getAudioTracks().length === 0) return;
    const AudioCtxCtor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtxCtor) return;

    const ctx = new AudioCtxCtor();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 64;
    analyser.smoothingTimeConstant = 0.8;
    source.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    const bars = barsRef.current;
    let raf = 0;

    const tick = () => {
      analyser.getByteFrequencyData(data);
      bars.forEach((bar, i) => {
        if (!bar) return;
        const idx = 1 + Math.floor((i / bars.length) * (data.length - 1) * 0.7);
        const level = data[idx] / 255;
        bar.style.transform = `scaleY(${Math.max(0.15, Math.min(1, level * 1.7))})`;
      });
      raf = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      source.disconnect();
      analyser.disconnect();
      void ctx.close();
    };
  }, [stream]);

  return (
    <span className="flex h-3 items-end gap-[2px]" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          ref={(el) => {
            barsRef.current[i] = el;
          }}
          className="h-full w-[2.5px] origin-bottom rounded-full bg-white/90 transition-transform duration-75 ease-out"
          style={{ transform: 'scaleY(0.15)' }}
        />
      ))}
    </span>
  );
}

/** Rule-of-thirds guide lines, toggled on top of the live preview. */
function GridOverlay() {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      <div className="absolute inset-y-0 left-1/3 w-px bg-white/35" />
      <div className="absolute inset-y-0 left-2/3 w-px bg-white/35" />
      <div className="absolute inset-x-0 top-1/3 h-px bg-white/35" />
      <div className="absolute inset-x-0 top-2/3 h-px bg-white/35" />
    </div>
  );
}

/** A circular icon button overlaid on the live preview — grid, flash, and flip camera. */
function ToolButton({
  children,
  label,
  onClick,
  active = false,
  disabled = false,
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      aria-label={label}
      title={label}
      className={`flex size-10 items-center justify-center rounded-full border backdrop-blur-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        active ? 'border-accent bg-accent text-white' : 'border-white/25 bg-ink/55 text-white hover:bg-ink/70'
      }`}
    >
      {children}
    </button>
  );
}

/**
 * A collapsed-by-default picker for camera and microphone — the "use this specific device"
 * escape hatch for anyone with an external webcam or mic plugged in. Collapsed by default so
 * it doesn't compete with the capture button; most people never need to open it.
 */
function DevicePanel({
  open,
  onToggle,
  videoInputs,
  audioInputs,
  videoDeviceId,
  audioDeviceId,
  onVideoChange,
  onAudioChange,
  showAudio,
  disabled,
}: {
  open: boolean;
  onToggle: () => void;
  videoInputs: MediaDeviceInfo[];
  audioInputs: MediaDeviceInfo[];
  videoDeviceId: string | null;
  audioDeviceId: string | null;
  onVideoChange: (id: string | null) => void;
  onAudioChange: (id: string | null) => void;
  showAudio: boolean;
  disabled: boolean;
}) {
  return (
    <div
      className="overflow-hidden rounded-2xl border border-line bg-surface
        shadow-[0_1px_2px_rgb(15_23_42_/_0.04),0_12px_28px_-16px_rgb(15_23_42_/_0.16)]"
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-ink">
          <SettingsIcon />
          Camera &amp; microphone
        </span>
        <ChevronIcon className={`size-4 text-ink-subtle transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open ? (
        <div className="space-y-3 border-t border-line px-4 py-4">
          <Field label="Camera" htmlFor="cap-camera">
            <select
              id="cap-camera"
              className={inputClass}
              value={videoDeviceId ?? ''}
              disabled={disabled}
              onChange={(e) => onVideoChange(e.target.value || null)}
            >
              <option value="">Automatic</option>
              {videoInputs.map((d, i) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `Camera ${i + 1}`}
                </option>
              ))}
            </select>
          </Field>
          {showAudio ? (
            <Field label="Microphone" htmlFor="cap-mic">
              <select
                id="cap-mic"
                className={inputClass}
                value={audioDeviceId ?? ''}
                disabled={disabled}
                onChange={(e) => onAudioChange(e.target.value || null)}
              >
                <option value="">Automatic</option>
                {audioInputs.map((d, i) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `Microphone ${i + 1}`}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Photo/video mode switch, the same idea as the segmented control on any phone's camera
 * app. Sits right above the shutter — the same spot a native camera puts it — rather than
 * requiring two separate entry points before the camera even opens.
 */
function ModeToggle({
  mode,
  onChange,
  disabled,
}: {
  mode: 'photo' | 'video';
  onChange: (mode: 'photo' | 'video') => void;
  disabled: boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Capture mode"
      className="mx-auto flex w-fit rounded-full border border-line-strong bg-sunken p-1"
    >
      {(
        [
          { id: 'photo', label: 'Photo', icon: <CameraIcon compact /> },
          { id: 'video', label: 'Video', icon: <VideoIcon compact /> },
        ] as const
      ).map((opt) => (
        <button
          key={opt.id}
          type="button"
          role="radio"
          aria-checked={mode === opt.id}
          disabled={disabled}
          onClick={() => onChange(opt.id)}
          className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
            mode === opt.id ? 'bg-accent text-white' : 'text-ink-muted hover:text-ink'
          }`}
        >
          {opt.icon}
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function FlipCameraIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 11A8 8 0 0 0 6.3 6.3L4 8.6" />
      <path d="M4 4v4.6h4.6" />
      <path d="M4 13a8 8 0 0 0 13.7 4.7L20 15.4" />
      <path d="M20 20v-4.6h-4.6" />
    </svg>
  );
}

function FlashIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2 4.5 13.5H11L10.5 22 19.5 10H13z" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="4" y="4" width="16" height="16" rx="1.5" />
      <line x1="9.3" y1="4" x2="9.3" y2="20" />
      <line x1="14.7" y1="4" x2="14.7" y2="20" />
      <line x1="4" y1="9.3" x2="20" y2="9.3" />
      <line x1="4" y1="14.7" x2="20" y2="14.7" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4 text-ink-subtle" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="2.8" />
      <path d="M12 4.5v2M12 17.5v2M19.5 12h-2M6.5 12h-2M17.4 6.6l-1.4 1.4M8 16l-1.4 1.4M17.4 17.4 16 16M8 8 6.6 6.6" />
    </svg>
  );
}

function ChevronIcon({ className = 'size-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function MicOffIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-3.5" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 9v3a3 3 0 0 0 4.6 2.5M15 9V6a3 3 0 0 0-5.7-1.3" />
      <path d="M19 11a7 7 0 0 1-1.3 4.1M5 11a7 7 0 0 0 7 7m0 0v3m-3 0h6" />
      <line x1="3" y1="3" x2="21" y2="21" />
    </svg>
  );
}

function TimerIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l3 2" />
      <path d="M9.5 2h5" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-3" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="m5 12 5 5 9-10" />
    </svg>
  );
}

/**
 * The post-burst review: tap a shot to preview it selected, then confirm. A two-step
 * pick-then-confirm rather than tap-to-finish, because choosing a frame here immediately
 * hands it on to hashing — a single mis-tap shouldn't commit the wrong photo.
 */
function BurstPicker({
  frames,
  selected,
  onSelect,
  onRetake,
  onUse,
  disabled,
}: {
  frames: { blob: Blob; url: string }[];
  selected: number | null;
  onSelect: (i: number) => void;
  onRetake: () => void;
  onUse: () => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-3">
      <div>
        <p className="font-display text-sm font-bold text-ink">Pick the best shot</p>
        <p className="text-sm text-ink-muted">
          {frames.length} photos, taken about a fifth of a second apart. Tap one to preview it, then
          use it.
        </p>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1" role="radiogroup" aria-label="Burst photos">
        {frames.map((frame, i) => (
          <button
            key={frame.url}
            type="button"
            role="radio"
            aria-checked={selected === i}
            aria-label={`Photo ${i + 1} of ${frames.length}`}
            onClick={() => onSelect(i)}
            disabled={disabled}
            className={`relative shrink-0 overflow-hidden rounded-xl border-2 transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
              selected === i ? 'border-accent' : 'border-transparent'
            }`}
          >
            <img src={frame.url} alt="" className="h-24 w-20 object-cover" />
            {selected === i ? (
              <span className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-accent text-white">
                <CheckIcon />
              </span>
            ) : null}
          </button>
        ))}
      </div>
      <Button block onClick={onUse} disabled={selected === null || disabled}>
        Use this photo
      </Button>
      <Button variant="quiet" block onClick={onRetake} disabled={disabled}>
        Retake burst
      </Button>
    </div>
  );
}
