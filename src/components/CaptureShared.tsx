/**
 * Small pieces shared between the two live capture routes — the camera (`CaptureScreen`'s
 * `LiveCapture`) and the microphone-only recorder (`AudioCaptureScreen`) — so that neither
 * one imports the other. Both need the same "what's been captured this session" strip and
 * the same live microphone-level meter; living here instead of in either screen keeps the
 * two capture routes independent of each other rather than tangled through a circular import.
 */
import { useEffect, useMemo, useRef } from 'react';
import type { CaptureItem } from '../lib/types';

export function VideoIcon({ compact = false }: { compact?: boolean }) {
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

export function MicIcon({ compact = false }: { compact?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={compact ? 'size-4 shrink-0' : 'mt-0.5 size-6 shrink-0 text-accent'}
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
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
 * A row of small thumbnails for what's been captured this session — shown on the chooser,
 * the live camera view and the audio recorder alike, so a batch of items stays visible
 * while more are taken. Deliberately read-only here: removing an item happens on the review
 * screen next, where its full context (and every other item) is already on screen at once.
 */
export function BatchStrip({ items }: { items: CaptureItem[] }) {
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
  const kindLabel = item.kind === 'video' ? 'video' : item.kind === 'audio' ? 'audio recording' : 'photo';

  return (
    <div
      role="listitem"
      aria-label={`Item ${index + 1}, ${kindLabel}, ${statusLabel}`}
      className="relative size-14 shrink-0 overflow-hidden rounded-lg border border-line bg-sunken"
    >
      {item.kind === 'video' ? (
        <div className="flex size-full items-center justify-center bg-ink text-white">
          <VideoIcon compact />
        </div>
      ) : item.kind === 'audio' ? (
        <div className="flex size-full items-center justify-center bg-ink text-white">
          <MicIcon compact />
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

/**
 * A live microphone-level meter. Reads the input via an AnalyserNode and drives bar heights
 * straight through refs on every animation frame — routing that through React state would
 * mean a re-render at up to 60fps for a purely decorative meter.
 */
export function MicLevelMeter({ stream }: { stream: MediaStream | null }) {
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
