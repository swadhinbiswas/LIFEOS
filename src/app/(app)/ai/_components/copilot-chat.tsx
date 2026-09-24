"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithApprovalResponses } from "ai";
import type { UIMessage } from "ai";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

/**
 * The copilot chat (spec §8): streamed answers, tool-call cards, and one-key approval of writes.
 * Used by the `/ai` page, the Ctrl/Cmd+J slide-over and the contextual buttons.
 *
 * It renders text as plain pre-wrapped text (never HTML) and reads tool parts defensively, so a
 * model that returns something odd cannot turn into markup. Approvals are sent back through
 * `addToolApprovalResponse`, which the server re-validates against the signed request (ADR-076).
 */

interface ToolPartShape {
  type: string;
  toolName?: string;
  state: string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
  approval?: {
    id: string;
    approved?: boolean;
    isAutomatic?: boolean;
    requestReason?: string;
    reason?: string;
  };
}

function asToolPart(part: { type: string }): ToolPartShape | null {
  if (part.type === "dynamic-tool") return part as ToolPartShape;
  if (part.type.startsWith("tool-")) return part as ToolPartShape;
  return null;
}

const toolNameOf = (part: ToolPartShape): string =>
  part.toolName ?? part.type.replace(/^tool-/u, "");

const preview = (value: unknown): string => {
  try {
    const text = JSON.stringify(value);
    return text.length > 240 ? `${text.slice(0, 240)}…` : text;
  } catch {
    return "";
  }
};

export function CopilotChat({
  conversationId,
  initialMessages,
  prefill,
}: {
  conversationId?: string;
  initialMessages?: UIMessage[];
  prefill?: string;
}) {
  const t = useTranslations("Pages.Copilot");
  const transport = useMemo(() => new DefaultChatTransport({ api: "/api/ai/chat" }), []);
  const [input, setInput] = useState(prefill ?? "");
  const sentPrefill = useRef(false);
  const { messages, sendMessage, status, stop, regenerate, addToolApprovalResponse, error } =
    useChat({
      id: conversationId,
      messages: initialMessages,
      transport,
      sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
    });

  const busy = status === "submitted" || status === "streaming";

  const submit = () => {
    const text = input.trim();
    if (text === "" || busy) return;
    setInput("");
    void sendMessage({ text });
  };

  // Contextual entry points may open the chat with a prompt already written (spec §8).
  useEffect(() => {
    if (prefill && !sentPrefill.current) {
      sentPrefill.current = true;
      void sendMessage({ text: prefill });
    }
  }, [prefill, sendMessage]);

  const pending = useMemo(() => {
    const ids: Array<{ id: string }> = [];
    for (const message of messages) {
      for (const part of message.parts) {
        const tool = asToolPart(part);
        if (
          tool &&
          tool.state === "approval-requested" &&
          tool.approval &&
          !tool.approval.isAutomatic
        ) {
          ids.push({ id: tool.approval.id });
        }
      }
    }
    return ids;
  }, [messages]);

  // One-key approval (spec §8): y approves, n rejects, when exactly one write is waiting.
  useEffect(() => {
    if (pending.length !== 1) return;
    const id = pending[0]?.id;
    if (!id) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/u.test(target.tagName))
      ) {
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === "y") {
        event.preventDefault();
        addToolApprovalResponse({ id, approved: true });
      } else if (event.key === "n") {
        event.preventDefault();
        addToolApprovalResponse({ id, approved: false });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pending, addToolApprovalResponse]);

  return (
    <div className="flex flex-col gap-3" data-slot="copilot-chat">
      <div className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto" data-slot="copilot-log">
        {messages.length === 0 ? (
          <p className="font-mono text-xs text-muted-foreground">{t("empty")}</p>
        ) : null}

        {messages.map((message) => (
          <div key={message.id} className="flex flex-col gap-1 text-xs">
            <span className="font-mono text-[10px] text-muted-foreground uppercase">
              {message.role === "user" ? t("you") : t("assistant")}
            </span>
            {message.parts.map((part, index) => {
              if (part.type === "text") {
                return (
                  <p key={index} className="whitespace-pre-wrap font-mono text-xs">
                    {part.text}
                  </p>
                );
              }
              const tool = asToolPart(part);
              if (!tool) return null;
              const name = toolNameOf(tool);
              return (
                <div
                  key={index}
                  data-slot="copilot-tool"
                  data-tool={name}
                  data-state={tool.state}
                  className="border border-border bg-card px-2 py-1 font-mono text-[10px]"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-primary">{name}</span>
                    <span className="text-muted-foreground">
                      {tool.state === "output-available"
                        ? t("ran")
                        : tool.state === "output-error"
                          ? t("failed")
                          : tool.state === "output-denied"
                            ? t("denied")
                            : t("approvalRequested")}
                    </span>
                  </div>
                  {tool.state === "approval-requested" &&
                  tool.approval &&
                  !tool.approval.isAutomatic ? (
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span className="text-muted-foreground">{preview(tool.input)}</span>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() =>
                          addToolApprovalResponse({ id: tool.approval!.id, approved: true })
                        }
                        data-slot="copilot-approve"
                      >
                        {t("approve")}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          addToolApprovalResponse({ id: tool.approval!.id, approved: false })
                        }
                        data-slot="copilot-reject"
                      >
                        {t("reject")}
                      </Button>
                    </div>
                  ) : null}
                  {tool.state === "output-available" ? (
                    <p className="mt-1 truncate text-muted-foreground">{preview(tool.output)}</p>
                  ) : null}
                  {tool.state === "output-error" && tool.errorText ? (
                    <p className="mt-1 text-destructive">{tool.errorText}</p>
                  ) : null}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {error ? (
        <p role="alert" className="font-mono text-[10px] text-destructive">
          {error.message.includes("provider") ? t("noProvider") : `${t("error")}: ${error.message}`}
        </p>
      ) : null}

      <div className="flex items-end gap-2">
        <label className="sr-only" htmlFor="copilot-input">
          {t("placeholder")}
        </label>
        <input
          id="copilot-input"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
          placeholder={t("placeholder")}
          className="min-w-0 flex-1 border border-border bg-background px-2 py-1 font-mono text-xs outline-none placeholder:text-muted-foreground"
        />
        {busy ? (
          <Button type="button" size="sm" variant="outline" onClick={stop}>
            {t("stop")}
          </Button>
        ) : (
          <Button type="button" size="sm" onClick={submit} disabled={input.trim() === ""}>
            {t("send")}
          </Button>
        )}
        {!busy && messages.length > 0 ? (
          <Button type="button" size="sm" variant="ghost" onClick={() => void regenerate()}>
            {t("regenerate")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
