"use client";

import { useSyncExternalStore } from "react";
import { Eye, EyeOff } from "lucide-react";

const key = "noholdr:thumbnails";
const preferenceEvent = "noholdr:thumbnail-preference";
let sessionPreference: boolean | undefined;

function readPreference() {
  if (sessionPreference !== undefined) return sessionPreference;
  try {
    return localStorage.getItem(key) !== "off";
  } catch {
    return true;
  }
}

function subscribe(notify: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === key || event.key === null) notify();
  };
  window.addEventListener(preferenceEvent, notify);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(preferenceEvent, notify);
    window.removeEventListener("storage", onStorage);
  };
}

export function useThumbnails() {
  return useSyncExternalStore(subscribe, readPreference, () => false);
}

export function ThumbnailToggle() {
  const enabled = useThumbnails();
  const Icon = enabled ? Eye : EyeOff;

  function toggle() {
    try {
      localStorage.setItem(key, enabled ? "off" : "on");
      sessionPreference = undefined;
    } catch {
      sessionPreference = !enabled;
    }
    window.dispatchEvent(new Event(preferenceEvent));
  }

  return (
    <button type="button" role="switch" aria-label="File thumbnails" aria-checked={enabled}
      className="studio-thumbnail-toggle" onClick={toggle}>
      <Icon size={17} aria-hidden="true" />
      <span>Thumbnails <strong>{enabled ? "on" : "off"}</strong></span>
    </button>
  );
}
