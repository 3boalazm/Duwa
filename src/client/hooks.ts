"use client";

import { useSyncExternalStore } from "react";
import { type Creds, loadCreds, subscribeCreds } from "./session";

const never = () => () => {};

/**
 * A value that only exists in the browser (URL, storage, a media query…).
 * `fallback` is used on the server and while hydrating, so the first client
 * render always matches the server HTML. `read` must return a primitive.
 */
export function useClientValue<T extends string | number | boolean | null>(read: () => T, fallback: T): T {
  return useSyncExternalStore(never, read, () => fallback);
}

/** This device's identity: null on the server, while hydrating, and when signed out. */
export function useCreds(): Creds | null {
  return useSyncExternalStore(subscribeCreds, loadCreds, () => null);
}

/* ------------------------------------------------------------------ */
/*  A shared 10 Hz clock for countdowns                                 */
/* ------------------------------------------------------------------ */
const tickListeners = new Set<() => void>();
let tickTimer: ReturnType<typeof setInterval> | undefined;
let tickValue = 0;
let idleTicks = 0;

function ensureTicking(): void {
  if (tickTimer) return;
  tickValue = Date.now();
  idleTicks = 0;
  tickTimer = setInterval(() => {
    // Nobody has been watching for a couple of seconds: stop the clock.
    if (tickListeners.size === 0 && ++idleTicks > 20) {
      clearInterval(tickTimer);
      tickTimer = undefined;
      return;
    }
    tickValue = Date.now();
    for (const fn of tickListeners) fn();
  }, 100);
}

function subscribeTick(fn: () => void): () => void {
  tickListeners.add(fn);
  ensureTicking();
  return () => {
    tickListeners.delete(fn);
  };
}

function readTick(): number {
  ensureTicking();
  return tickValue;
}

const zero = () => 0;

/**
 * Device time in epoch ms, refreshed about ten times a second.
 * Pass `false` while nothing is counting down: the component then stops re-rendering.
 */
export function useTick(active = true): number {
  return useSyncExternalStore(active ? subscribeTick : never, active ? readTick : zero, zero);
}
