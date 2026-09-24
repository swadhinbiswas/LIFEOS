"use client";

import { Button } from "@/components/ui/button";

/**
 * A contextual copilot entry point (spec §8 "contextual buttons"). It dispatches the shell's
 * `lifeos:copilot` event with a prompt, so the slide-over opens prefilled without the page needing
 * to own the copilot state.
 */
export function CopilotQuickAction({ label, prompt }: { label: string; prompt: string }) {
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={() =>
        window.dispatchEvent(new CustomEvent("lifeos:copilot", { detail: { prompt } }))
      }
    >
      {label}
    </Button>
  );
}
