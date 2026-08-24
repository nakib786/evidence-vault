/**
 * A dedicated microphone-only capture route, for evidence that's audio without a picture
 * worth having — a phone call put on speaker, a voicemail, or someone talking near a phone
 * that can't safely or discreetly be pointed at them.
 *
 * Deliberately its own screen rather than a third mode bolted onto `CaptureScreen`'s
 * `LiveCapture`: the camera path already carries a lot of state (torch, zoom, exposure,
 * burst, self-timer) that has no meaning here, and "this screen never touches the camera"
 * is a much easier guarantee to read straight out of a small, separate file than to trust
 * out of a much larger one with a flag threaded through it. Recording, fingerprinting and
 * the batch strip all work exactly like the photo/video route — see `secureBlob` in
 * `lib/secure.ts` and this screen's `onCaptured` prop, which is the same callback
 * `LiveCapture` calls.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Callout, Field, inputClass } from './ui';
import { BatchStrip } from './CaptureShared';
import type { CapturePayload } from './CaptureScreen';
import type { CaptureItem, CaptureMeta } from '../lib/types';
import { MAX_AUDIO_SECONDS, formatDuration, pickAudioRecordingMimeType } from '../lib/media';

interface Props {
  items: CaptureItem[];
  onCaptured: (payload: CapturePayload) => void;
  onCancel: () => void;
  onError: (message: string) => void;
  onDone: () => void;
}

export default function AudioCaptureScreen({ items, onCaptured, onCancel, onError, onDone }: Props) {
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const startedAtRef = useRef<number>(0);
  const micLabelRef = useRef<string | undefined>(undefined);

  const [ready, setReady] = useState(false);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [busy, setBusy] = useState(false);
  const [activeStream, setActiveStream] = useState<MediaStream | null>(null);

  const [audioDeviceId, setAudioDeviceId] = useState<string | null>(null);
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [showDevicePanel, setShowDevicePanel] = useState(false);

  const canReconfigure = ready && !recording && !busy;

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setActiveStream(null);
  }, []);

  // Same reasoning as `LiveCapture`'s own `refreshDevices`: device labels only populate
  // once permission is granted, so this runs again after that and on every `devicechange`,
  // so a headset plugged in mid-session shows up without a reload.
  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const list = await navigator.mediaDevices.enumerateDevices();
      setAudioInputs(list.filter((d) => d.kind === 'audioinput'));
    } catch {
      /* enumeration is a nicety; a failure here shouldn't block recording */
    }
  }, []);

  useEffect(() => {
    if (!navigator.mediaDevices?.addEventListener) return;
    navigator.mediaDevices.addEventListener('devicechange', refreshDevices);
    return () => navigator.mediaDevices.removeEventListener('devicechange', refreshDevices);
  }, [refreshDevices]);

  // Opens the microphone, and reopens it whenever the device picker changes the selection.
  // Never requests video — that guarantee is the entire reason this is its own component.
  useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia) {
      onError('This browser cannot open the microphone. You can choose a file instead.');
      return;
    }
    let cancelled = false;
    let localStream: MediaStream | null = null;

    (async () => {
      try {
        const audio: MediaTrackConstraints | boolean = audioDeviceId
          ? { deviceId: { exact: audioDeviceId } }
          : true;
        const stream = await navigator.mediaDevices.getUserMedia({ video: false, audio });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        localStream = stream;
        streamRef.current = stream;
        setActiveStream(stream);
        micLabelRef.current = stream.getAudioTracks()[0]?.label || undefined;
        setReady(true);
        void refreshDevices();
      } catch (err) {
        const name = err instanceof DOMException ? err.name : '';
        onError(
          name === 'NotAllowedError'
            ? 'Permission was declined. You can allow microphone access in your browser settings, or choose a file instead.'
            : name === 'NotFoundError' || name === 'OverconstrainedError'
              ? 'No microphone could be found. You can choose a file instead.'
              : 'The microphone could not be opened. You can choose a file instead.',
        );
      }
    })();

    return () => {
      cancelled = true;
      localStream?.getTracks().forEach((t) => t.stop());
    };
  }, [audioDeviceId, onError, refreshDevices]);

  // Belt-and-braces: if the screen is torn down mid-recording, don't leave a recorder running.
  useEffect(() => {
    return () => {
      if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
    };
  }, []);

  // Recording timer, and the hard stop at the duration cap.
  useEffect(() => {
    if (!recording) return;
    const id = setInterval(() => {
      const secs = (Date.now() - startedAtRef.current) / 1000;
      setElapsed(secs);
      if (secs >= MAX_AUDIO_SECONDS) stopRecording();
    }, 200);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recording]);

  const startRecording = (): void => {
    const stream = streamRef.current;
    if (!stream) return;
    try {
      const mimeType = pickAudioRecordingMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const type = recorder.mimeType || mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: type.split(';')[0] });
        chunksRef.current = [];
        const seconds = (Date.now() - startedAtRef.current) / 1000;
        const captureMeta: CaptureMeta = { microphoneLabel: micLabelRef.current };
        onCaptured({
          blob,
          source: 'live',
          kind: 'audio',
          durationSeconds: seconds,
          hasAudio: true,
          captureMeta,
        });
        // Microphone stays open — the same reason `LiveCapture` leaves its camera open
        // between shots — so a batch of clips can be recorded back-to-back.
        setBusy(false);
      };
      recorder.onerror = () => onError('Recording stopped unexpectedly. Please try again.');

      recorderRef.current = recorder;
      startedAtRef.current = Date.now();
      recorder.start(1000);
      setRecording(true);
    } catch {
      onError('This browser cannot record audio. You can choose a file instead.');
    }
  };

  const stopRecording = (): void => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== 'recording') return;
    setBusy(true);
    recorder.stop();
    setRecording(false);
  };

  const overCap = elapsed >= MAX_AUDIO_SECONDS - 30;

  return (
    <div className="space-y-4">
      <div className="relative flex flex-col items-center justify-center gap-5 overflow-hidden rounded-2xl border border-line bg-ink px-6 py-12">
        <div
          className={`flex size-24 items-center justify-center rounded-full border-2 transition-colors ${
            recording ? 'border-danger bg-danger/20' : 'border-white/25 bg-white/10'
          }`}
        >
          <BigMicIcon />
        </div>

        {recording ? (
          <div className="flex items-center gap-2">
            <span className="size-2.5 animate-pulse rounded-full bg-danger" aria-hidden="true" />
            <span className="font-mono text-2xl font-semibold tabular-nums text-white">
              {formatDuration(elapsed)}
            </span>
            <span className="sr-only" aria-live="polite">
              Recording, {Math.floor(elapsed)} seconds elapsed
            </span>
          </div>
        ) : (
          <p className="text-sm text-white/70">{ready ? 'Ready to record' : 'Waiting for microphone…'}</p>
        )}

        {ready ? <BigLevelMeter stream={activeStream} /> : null}
      </div>

      {items.length > 0 ? <BatchStrip items={items} /> : null}

      {ready ? (
        <div
          className="overflow-hidden rounded-2xl border border-line bg-surface
            shadow-[0_1px_2px_rgb(15_23_42_/_0.04),0_12px_28px_-16px_rgb(15_23_42_/_0.16)]"
        >
          <button
            type="button"
            onClick={() => setShowDevicePanel((s) => !s)}
            aria-expanded={showDevicePanel}
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
          >
            <span className="text-sm font-semibold text-ink">Microphone</span>
            <ChevronIcon className={`size-4 text-ink-subtle transition-transform ${showDevicePanel ? 'rotate-180' : ''}`} />
          </button>
          {showDevicePanel ? (
            <div className="border-t border-line px-4 py-4">
              <Field label="Microphone" htmlFor="aud-mic">
                <select
                  id="aud-mic"
                  className={inputClass}
                  value={audioDeviceId ?? ''}
                  disabled={!canReconfigure}
                  onChange={(e) => setAudioDeviceId(e.target.value || null)}
                >
                  <option value="">Automatic</option>
                  {audioInputs.map((d, i) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label || `Microphone ${i + 1}`}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          ) : null}
        </div>
      ) : null}

      {recording ? (
        <>
          {overCap ? (
            <Callout tone="caution" title="Approaching the recording limit">
              Recording stops automatically at {MAX_AUDIO_SECONDS / 60} minutes.
            </Callout>
          ) : null}
          <Button variant="danger" block onClick={stopRecording} disabled={busy}>
            {busy ? 'Saving…' : 'Stop recording'}
          </Button>
        </>
      ) : (
        <Button block onClick={startRecording} disabled={!ready || busy}>
          {ready ? 'Start recording' : 'Waiting for microphone…'}
        </Button>
      )}

      {!recording && items.length > 0 ? (
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

      {!recording ? (
        <Button variant="quiet" block onClick={onCancel}>
          Cancel
        </Button>
      ) : null}
    </div>
  );
}

/** A larger microphone glyph for this screen's main visual, distinct from the small status icons. */
function BigMicIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-10 text-white"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0" />
      <path d="M12 17.5V21M9 21h6" />
    </svg>
  );
}

/**
 * A bigger sibling of `CaptureShared`'s `MicLevelMeter`, sized to be this screen's main
 * visual rather than a small status pill — same AnalyserNode approach, more and taller
 * bars. Kept separate rather than parameterising the shared one with a size prop: the two
 * are visually unrelated enough (a status chip vs. a full-width waveform) that one prop
 * would just be two designs wearing a shared name.
 */
function BigLevelMeter({ stream }: { stream: MediaStream | null }) {
  const barsRef = useRef<(HTMLSpanElement | null)[]>([]);
  const BAR_COUNT = 9;

  useEffect(() => {
    if (!stream || stream.getAudioTracks().length === 0) return;
    const AudioCtxCtor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtxCtor) return;

    const ctx = new AudioCtxCtor();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 128;
    analyser.smoothingTimeConstant = 0.75;
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
        bar.style.transform = `scaleY(${Math.max(0.08, Math.min(1, level * 1.7))})`;
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
    <span className="flex h-10 items-end gap-1" aria-hidden="true">
      {Array.from({ length: BAR_COUNT }, (_, i) => (
        <span
          key={i}
          ref={(el) => {
            barsRef.current[i] = el;
          }}
          className="h-full w-1.5 origin-bottom rounded-full bg-white/80 transition-transform duration-75 ease-out"
          style={{ transform: 'scaleY(0.08)' }}
        />
      ))}
    </span>
  );
}

function ChevronIcon({ className = 'size-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
