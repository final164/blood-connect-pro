import { useSyncExternalStore } from "react";
import {
  DEFAULT_URGENCY_ANIMATION,
  fetchUrgencyAnimationSettings,
  type UrgencyAnimationSettings,
} from "@/lib/urgency-animation";

let snapshot: UrgencyAnimationSettings = DEFAULT_URGENCY_ANIMATION;
let started = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function ensureLoaded() {
  if (started) return;
  started = true;
  void fetchUrgencyAnimationSettings().then((s) => {
    snapshot = s;
    emit();
  });
}

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  ensureLoaded();
  return () => {
    listeners.delete(onStoreChange);
  };
}

function getSnapshot() {
  return snapshot;
}

function getServerSnapshot() {
  return DEFAULT_URGENCY_ANIMATION;
}

/** One shared settings load for the whole feed — no per-card fetch/setState. */
export function useUrgencyAnimationSettings(): UrgencyAnimationSettings {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Call after admin save so open feed cards pick up new values. */
export function publishUrgencyAnimationSettings(next: UrgencyAnimationSettings) {
  snapshot = next;
  started = true;
  emit();
}
