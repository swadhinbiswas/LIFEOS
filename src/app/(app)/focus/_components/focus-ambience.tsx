"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

/**
 * Focus ambience (ADR-139): a self-hosted focus soundtrack and a landscape that follows the time
 * of day. There are no audio assets to ship — the sound is synthesised with the Web Audio API
 * (filtered brown noise), so it works offline and needs no CDN. The landscape is a CSS gradient
 * keyed to the hour. Both are purely client-side; the preference lives in localStorage.
 */

const STORAGE_KEY = "lifeos.focus.ambience";

function timeOfDay(hour: number): "dawn" | "day" | "dusk" | "night" {
  if (hour < 6) return "night";
  if (hour < 11) return "dawn";
  if (hour < 17) return "day";
  if (hour < 21) return "dusk";
  return "night";
}

const GRADIENTS: Record<ReturnType<typeof timeOfDay>, string> = {
  dawn: "linear-gradient(180deg, oklch(0.78 0.08 60) 0%, oklch(0.62 0.10 200) 100%)",
  day: "linear-gradient(180deg, oklch(0.82 0.06 220) 0%, oklch(0.70 0.08 200) 100%)",
  dusk: "linear-gradient(180deg, oklch(0.62 0.12 30) 0%, oklch(0.40 0.10 260) 100%)",
  night: "linear-gradient(180deg, oklch(0.22 0.06 260) 0%, oklch(0.14 0.04 260) 100%)",
};

function makeBrownNoiseBuffer(ctx: AudioContext): AudioBuffer {
  const seconds = 2;
  const sampleRate = ctx.sampleRate;
  const length = seconds * sampleRate;
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    data[i] = last * 3.5;
  }
  return buffer;
}

export function FocusAmbience() {
  const t = useTranslations("Pages.Focus");
  const [enabled, setEnabled] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { enabled?: boolean; landscape?: boolean };
        if (typeof parsed.enabled === "boolean") return parsed.enabled;
      }
    } catch {
      // localStorage can throw in private mode; the default is fine.
    }
    return false;
  });
  const [landscape, setLandscape] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { enabled?: boolean; landscape?: boolean };
        if (typeof parsed.landscape === "boolean") return parsed.landscape;
      }
    } catch {
      // ignore
    }
    return true;
  });

  const ctxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ enabled, landscape }));
    } catch {
      // ignore
    }
  }, [enabled, landscape]);

  const stop = useCallback(() => {
    const source = sourceRef.current;
    if (source) {
      try {
        source.stop();
      } catch {
        // already stopped
      }
      sourceRef.current = null;
    }
    const ctx = ctxRef.current;
    if (ctx && ctx.state !== "closed") {
      void ctx.close();
      ctxRef.current = null;
      gainRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      stop();
      return;
    }
    const ctx = new (
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    )();
    ctxRef.current = ctx;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 600;
    const gain = ctx.createGain();
    gain.gain.value = 0.18;
    gainRef.current = gain;
    const source = ctx.createBufferSource();
    source.buffer = makeBrownNoiseBuffer(ctx);
    source.loop = true;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    source.start();
    sourceRef.current = source;
    return () => stop();
  }, [enabled, stop]);

  const tod = timeOfDay(new Date().getHours());
  const gradient = GRADIENTS[tod];

  return (
    <div className="flex flex-col gap-2" data-slot="focus-ambience">
      <div
        className="relative h-24 w-full overflow-hidden rounded-[var(--radius)] border border-border"
        style={{ background: landscape ? gradient : "var(--card)" }}
        aria-hidden="true"
      >
        <span className="absolute bottom-2 left-3 font-mono text-[10px] text-white/80 drop-shadow">
          {t("landscape", { time: t(`time${tod.charAt(0).toUpperCase()}${tod.slice(1)}`) })}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant={enabled ? "default" : "outline"}
          onClick={() => setEnabled((value) => !value)}
        >
          {enabled ? t("soundOff") : t("soundOn")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setLandscape((value) => !value)}
        >
          {landscape ? t("hideLandscape") : t("showLandscape")}
        </Button>
        <span className="font-mono text-[10px] text-muted-foreground">{t("ambienceHint")}</span>
      </div>
    </div>
  );
}
