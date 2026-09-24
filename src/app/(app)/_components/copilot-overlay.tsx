"use client";

import { useTranslations } from "next-intl";

import { CopilotChat } from "@/app/(app)/ai/_components/copilot-chat";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * The copilot slide-over (spec §8): the same chat, available on every page via Ctrl/Cmd+J. Mounted
 * only while open so its `useChat` state is fresh each time and no page pays for it otherwise.
 */
export function CopilotOverlay({
  open,
  onOpenChange,
  prefill,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefill?: string;
}) {
  const t = useTranslations("Pages.Copilot");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("tagline")}</DialogDescription>
        </DialogHeader>
        <CopilotChat prefill={prefill} />
      </DialogContent>
    </Dialog>
  );
}
