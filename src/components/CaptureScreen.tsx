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
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Callout, Card } from './ui';
import type { CaptureSource, MediaKind } from '../lib/types';
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

export interface CapturePayload {
  blob: Blob;
  source: CaptureSource;
  kind: MediaKind;
  durationSeconds?: number;
  hasAudio?: boolean;
}

interface Props {
  onCaptured: (payload: CapturePayload) => void;
}

type Mode = 'choose' | 'photo' | 'video';

export default function CaptureScreen({ onCaptured }: Props) {
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
          onPick={(m) => {
            setError(null);
            setMode(m);
          }}
          onFile={onCaptured}
          onError={setError}
        />
      ) : (
        <LiveCapture
          mode={mode}
          onCaptured={onCaptured}
          onCancel={() => setMode('choose')}
          onError={fail}
        />
      )}
    </div>
  );
}

function ChooseMode({
  onPick,
  onFile,
  onError,
}: {
  onPick: (mode: 'photo' | 'video') => void;
  onFile: (payload: CapturePayload) => void;
  onError: (message: string) => void;
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
      <Card className="space-y-3" data-tour="capture-video">
        <div className="flex items-start gap-3">
          <VideoIcon />
          <div className="flex-1">
            <h2 className="font-display text-lg font-bold text-ink">Record a video</h2>
            <p className="mt-1 text-sm text-ink-muted">
              For anything spoken — harassment in the street, a confrontation, abuse shouted at
              someone. Records sound as well as picture, because the words are usually the evidence.
            </p>
          </div>
        </div>
        <Button block onClick={() => onPick('video')}>
          Start recording
        </Button>
        <p className="text-xs text-ink-subtle">
          Your browser will ask for camera and microphone permission first. Nothing is recorded until
          you press record. Up to {MAX_VIDEO_SECONDS / 60} minutes.
        </p>
      </Card>

      <Card className="space-y-3" data-tour="capture-photo">
        <div className="flex items-start gap-3">
          <CameraIcon />
          <div className="flex-1">
            <h2 className="font-display text-lg font-bold text-ink">Take a photo</h2>
            <p className="mt-1 text-sm text-ink-muted">
              Photograph a screen, a poster, or graffiti. Fingerprinted the instant it is taken.
            </p>
          </div>
        </div>
        <Button variant="secondary" block onClick={() => onPick('photo')}>
          Open camera
        </Button>
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
  mode,
  onCaptured,
  onCancel,
  onError,
}: {
  mode: 'photo' | 'video';
  onCaptured: (payload: CapturePayload) => void;
  onCancel: () => void;
  onError: (message: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const startedAtRef = useRef<number>(0);

  const [ready, setReady] = useState(false);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [busy, setBusy] = useState(false);
  const [hasAudio, setHasAudio] = useState(false);

  const wantsAudio = mode === 'video';

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        onError('This browser cannot open the camera. You can still choose a file instead.');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 } },
          audio: wantsAudio,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        setHasAudio(stream.getAudioTracks().length > 0);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
        setReady(true);
      } catch (err) {
        const name = err instanceof DOMException ? err.name : '';
        onError(
          name === 'NotAllowedError'
            ? `Permission was declined. You can allow ${wantsAudio ? 'camera and microphone' : 'camera'} access in your browser settings, or choose a file instead.`
            : name === 'NotFoundError'
              ? 'No camera was found on this device. You can choose a file instead.'
              : 'The camera could not be opened. You can choose a file instead.',
        );
      }
    })();

    return () => {
      cancelled = true;
      if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
      stopStream();
    };
  }, [onError, stopStream, wantsAudio]);

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

  const capturePhoto = async (): Promise<void> => {
    const video = videoRef.current;
    if (!video || busy) return;
    setBusy(true);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('no 2d context');
      ctx.drawImage(video, 0, 0);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('encode failed');
      stopStream();
      onCaptured({ blob, source: 'live', kind: 'image' });
    } catch {
      onError('The frame could not be captured. Please try again.');
    } finally {
      setBusy(false);
    }
  };

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
        stopStream();
        onCaptured({
          blob,
          source: 'live',
          kind: 'video',
          durationSeconds: seconds,
          hasAudio,
        });
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

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-2xl border border-line bg-ink">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption -- live preview, not playback */}
        <video
          ref={videoRef}
          playsInline
          muted
          className="aspect-[3/4] w-full object-cover"
          aria-label="Live camera preview"
        />
        {recording ? (
          <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-danger px-3 py-1.5">
            <span className="size-2.5 animate-pulse rounded-full bg-white" aria-hidden="true" />
            <span className="font-mono text-sm font-semibold tabular-nums text-white">
              {formatDuration(elapsed)}
            </span>
            <span className="sr-only">Recording in progress</span>
          </div>
        ) : null}
      </div>

      {mode === 'video' && ready && !hasAudio ? (
        <Callout tone="caution" title="Recording without sound">
          The microphone is unavailable, so this will record picture only. If the words matter, that
          is a significant loss — check your microphone permission before recording.
        </Callout>
      ) : null}

      {recording ? (
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
        <Button block onClick={startRecording} disabled={!ready || busy}>
          {ready ? 'Start recording' : 'Waiting for camera…'}
        </Button>
      ) : (
        <Button block onClick={capturePhoto} disabled={!ready || busy}>
          {busy ? 'Capturing…' : ready ? 'Capture this frame' : 'Waiting for camera…'}
        </Button>
      )}

      {!recording ? (
        <Button variant="quiet" block onClick={onCancel}>
          Cancel
        </Button>
      ) : null}
    </div>
  );
}

function VideoIcon() {
  return (
    <svg viewBox="0 0 24 24" className="mt-0.5 size-6 shrink-0 text-accent" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7">
      <rect x="3" y="6" width="12.5" height="12" rx="2.5" />
      <path d="M15.5 10.5 20.2 7.8a.6.6 0 0 1 .9.5v7.4a.6.6 0 0 1-.9.5l-4.7-2.7z" />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" className="mt-0.5 size-6 shrink-0 text-accent" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7">
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
