/**
 * Turns a `CaptureMeta` into the ordered list of label/value facts shown to a person. The
 * Review screen's capture-details list and the PDF report's "What was recorded" section
 * both render off this single function, so the two can never quietly say different things
 * about how the same file was captured.
 *
 * Every fact is conditional on its own — a laptop webcam has no facing side, most cameras
 * have no zoom or exposure control, and burst/timer only ever apply to some shots. Nothing
 * here fabricates a value the browser didn't actually report.
 */
import type { CaptureMeta } from './types';

export function describeCaptureMeta(meta: CaptureMeta): { label: string; value: string }[] {
  const facts: { label: string; value: string }[] = [];

  if (meta.cameraLabel) {
    facts.push({ label: 'Camera', value: meta.cameraLabel });
  } else if (meta.facingMode) {
    facts.push({ label: 'Camera', value: meta.facingMode === 'user' ? 'Front-facing' : 'Rear-facing' });
  }

  if (meta.microphoneLabel) facts.push({ label: 'Microphone', value: meta.microphoneLabel });

  if (meta.zoom !== undefined && Math.round(meta.zoom * 10) !== 10) {
    facts.push({ label: 'Zoom', value: `${meta.zoom.toFixed(1)}×` });
  }

  if (meta.exposureCompensation !== undefined && meta.exposureCompensation !== 0) {
    facts.push({
      label: 'Exposure adjustment',
      value: `${meta.exposureCompensation > 0 ? '+' : ''}${meta.exposureCompensation.toFixed(2)} EV`,
    });
  } else if (meta.brightness !== undefined) {
    facts.push({ label: 'Brightness adjustment', value: `${Math.round(meta.brightness)}` });
  }

  if (meta.torchOn) facts.push({ label: 'Flashlight', value: 'On' });

  if (meta.timerSeconds) facts.push({ label: 'Self-timer', value: `${meta.timerSeconds}s delay` });

  if (meta.burstCount && meta.burstCount > 1) {
    facts.push({ label: 'Burst photo', value: `Frame ${meta.burstIndex} of ${meta.burstCount}` });
  }

  return facts;
}
