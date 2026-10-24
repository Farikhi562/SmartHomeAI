"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { api, toApiError, type CitationDto, type ConversationDto, type PendingActionDto, type ReplyDto, type StoredMessageDto } from "@/client/api";
import { useAsync } from "@/client/useAsync";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { AlertTriangle, CheckCircle, Clock, MapPin, Plus, Send, Sparkles, Trash, User, WifiOff } from "@/components/ui/icons";
import { formatDateTime, formatRelativeTime, toDateTimeAttr, truncate } from "@/lib/format";
import { cx } from "@/lib/cx";

/**
 * AI memory assistant (DESIGN_SPEC §1.5, §4): grounded strictly in the user's
 * records, citations link back to the source entries, and every proposed write
 * is confirmed by the user first (FR-024). A `503 AI_UNAVAILABLE` renders a
 * degradation banner with deterministic fallback results and a Retry (FR-013) —
 * the rest of the app stays fully usable.
 *
 * Conversation selection uses `?c=<id>` rather than `/assistant/:id` (see the
 * deviations note): the assistant route stays a single page and the server
 * layer has no per-conversation page segment yet.
 */

const SUGGESTED_QUESTIONS = [
  "Where did I last put my motorcycle keys?",
  "What's in the bedroom drawer?",
  "I put my wallet in the bedroom drawer",
];

type ThreadEntry =
  | { kind: "user"; id: string; text: string; createdAt?: string }
  | { kind: "assistant"; id: string; reply: ReplyDto }
  | { kind: "error"; id: string; message: string; retry: () => void };

export default function AssistantPage() {
  return (
    <Suspense fallback={<AssistantSkeleton />}>
      <AssistantView />
    </Suspense>
  );
}

function AssistantSkeleton() {
  return (
    <>
      <PageHeader title="Assistant" />
      <div className="flex flex-col gap-3">
        <Skeleton className="h-20 w-2/3 self-end rounded-lg" />
        <Skeleton className="h-24 w-3/4 rounded-lg" />
        <Skeleton className="h-20 w-2/3 self-end rounded-lg" />
      </div>
      <span role="status" className="sr-only">
        Loading assistant
      </span>
    </>
  );
}

function AssistantView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const activeConversationId = searchParams.get("c");

  const [entries, setEntries] = useState<ThreadEntry[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [composerError, setComposerError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const threadRef = useRef<HTMLDivElement | null>(null);

  const conversationsState = useAsync(() => api.assistant.conversations({ limit: 30 }), []);
  const preferencesState = useAsync(() => api.preferences(), []);
  const showSuggestions = preferencesState.data?.showSuggestedQuestions ?? true;

  // Load history when a conversation is selected.
  const historyState = useAsync(
    () =>
      activeConversationId
        ? api.assistant.messages(activeConversationId, { limit: 100 })
        : Promise.resolve({ messages: [] as StoredMessageDto[] }),
    [activeConversationId],
  );

  useEffect(() => {
    if (!activeConversationId || !historyState.data) return;
    const loaded: ThreadEntry[] = [];
    for (const message of historyState.data.messages) {
      if (message.role === "USER") {
        loaded.push({ kind: "user", id: message.id, text: message.content, createdAt: message.createdAt });
      } else {
        loaded.push({
          kind: "assistant",
          id: message.id,
          reply: {
            id: message.id,
            role: "ASSISTANT",
            text: message.content,
            intent: message.intent ?? null,
            status: message.status ?? "COMPLETE",
            citations: message.citations ?? [],
            candidates: message.candidates ?? [],
            pendingAction: message.pendingAction ?? null,
          },
        });
      }
    }
    setEntries(loaded);
  }, [activeConversationId, historyState.data]);

  useEffect(() => {
    const node = threadRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [entries, pending]);

  const navigateToConversation = useCallback(
    (id: string | null) => {
      router.replace(id ? `/assistant?c=${id}` : "/assistant", { scroll: false });
    },
    [router],
  );

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || pending) return;
      setComposerError(null);
      setPending(true);
      setDraft("");

      const userEntry: ThreadEntry = {
        kind: "user",
        id: `local-user-${Date.now()}`,
        text: trimmed,
        createdAt: new Date().toISOString(),
      };
      setEntries((previous) => [...previous, userEntry]);

      try {
        const result = await api.assistant.sendMessage({
          conversationId: activeConversationId ?? undefined,
          message: trimmed,
        });
        if (result.conversationId && result.conversationId !== activeConversationId) {
          navigateToConversation(result.conversationId);
        }
        setEntries((previous) => [
          ...previous,
          { kind: "assistant", id: result.reply.id || `local-assistant-${Date.now()}`, reply: result.reply },
        ]);
        conversationsState.reload();
        // Clarification rounds are capped server-side by the pipeline (FR-009);
        // the client only renders whatever `candidates` come back.
      } catch (error) {
        const apiError = toApiError(error);
        if (apiError.code === "AI_UNAVAILABLE") {
          setEntries((previous) => [
            ...previous,
            {
              kind: "error",
              id: `local-error-${Date.now()}`,
              message: apiError.message,
              retry: () => void send(trimmed),
            },
          ]);
        } else if (apiError.code === "RATE_LIMITED") {
          setComposerError(
            `The assistant is rate limited — try again in ${apiError.retryAfterSec ?? 60}s.`,
          );
          setDraft(trimmed);
        } else {
          setComposerError(apiError.message);
          setDraft(trimmed);
        }
      } finally {
        setPending(false);
      }
    },
    [activeConversationId, navigateToConversation, conversationsState, pending],
  );

  const decide = async (action: PendingActionDto, decision: "confirm" | "cancel") => {
    try {
      const result = await api.assistant.decide(action.id, { decision });
      setEntries((previous) =>
        previous.map((entry) => {
          if (entry.kind !== "assistant" || entry.reply.pendingAction?.id !== action.id) return entry;
          return {
            ...entry,
            reply: {
              ...entry.reply,
              status: "COMPLETE",
              pendingAction: { ...action, consumedAt: new Date().toISOString() },
            },
          };
        }),
      );
      if (decision === "confirm") {
        toast({
          title: "Recorded",
          description: result.event ? `Location saved for ${result.event.item?.name ?? "the item"}.` : undefined,
          tone: "success",
        });
        if (result.item) {
          toast({ title: "Item created", description: result.item.name, tone: "success" });
        }
      } else {
        toast({ title: "Cancelled — nothing was saved", tone: "info" });
      }
      if (activeConversationId) historyState.reload();
    } catch (error) {
      const apiError = toApiError(error);
      if (apiError.code === "CONFLICT") {
        setEntries((previous) =>
          previous.map((entry) => {
            if (entry.kind !== "assistant" || entry.reply.pendingAction?.id !== action.id) return entry;
            return { ...entry, reply: { ...entry.reply, status: "ERROR" } };
          }),
        );
        toast({ title: "This proposal expired", description: "Ask again to get a fresh one.", tone: "error" });
        return;
      }
      toast({ title: apiError.message, tone: "error" });
    }
  };

  const deleteConversation = async () => {
    if (!activeConversationId) return;
    setDeleteBusy(true);
    try {
      await api.assistant.deleteConversation(activeConversationId);
      setDeleteOpen(false);
      setEntries([]);
      navigateToConversation(null);
      conversationsState.reload();
      toast({ title: "Conversation deleted", tone: "success" });
    } catch (error) {
      toast({ title: toApiError(error).message, tone: "error" });
    } finally {
      setDeleteBusy(false);
    }
  };

  const startNew = () => {
    setEntries([]);
    setDraft("");
    setComposerError(null);
    navigateToConversation(null);
  };

  const isEmpty = entries.length === 0 && !pending;

  return (
    <>
      <PageHeader
        title="Assistant"
        subtitle="Ask in plain language — answers come only from your records."
        actions={
          <>
            <Button variant="secondary" onClick={() => setListOpen(true)} className="lg:hidden">
              History
            </Button>
            <Button onClick={startNew} iconLeft={<Plus size={16} />}>
              New conversation
            </Button>
            {activeConversationId && (
              <Button variant="danger" onClick={() => setDeleteOpen(true)} iconLeft={<Trash size={16} />}>
                Delete
              </Button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        {/* Conversation list — persistent ≥ 1024 px, drawer below */}
        <aside className="hidden lg:block">
          <ConversationList
            conversations={conversationsState.data?.conversations ?? []}
            loading={conversationsState.loading}
            error={conversationsState.error}
            onRetry={conversationsState.reload}
            activeId={activeConversationId}
            onSelect={navigateToConversation}
            onNew={startNew}
          />
        </aside>

        {listOpen && (
          <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Conversations">
            <div className="absolute inset-0 bg-black/50" onMouseDown={() => setListOpen(false)} aria-hidden="true" />
            <div className="absolute inset-y-0 left-0 w-80 max-w-[85vw] bg-popover p-3 shadow-overlay">
              <div className="mb-2 flex justify-end">
                <Button variant="ghost" size="sm" onClick={() => setListOpen(false)}>
                  Close
                </Button>
              </div>
              <ConversationList
                conversations={conversationsState.data?.conversations ?? []}
                loading={conversationsState.loading}
                error={conversationsState.error}
                onRetry={conversationsState.reload}
                activeId={activeConversationId}
                onSelect={(id) => {
                  navigateToConversation(id);
                  setListOpen(false);
                }}
                onNew={() => {
                  startNew();
                  setListOpen(false);
                }}
              />
            </div>
          </div>
        )}

        {/* Thread + composer */}
        <div className="flex min-h-[60vh] flex-col rounded-lg border border-border bg-card shadow-subtle">
          <div
            ref={threadRef}
            className="flex-1 overflow-y-auto p-4"
            aria-live="polite"
            aria-label="Conversation"
          >
            {historyState.loading && (
              <div className="flex flex-col gap-3">
                <Skeleton className="h-16 w-2/3 self-end rounded-lg" />
                <Skeleton className="h-20 w-3/4 rounded-lg" />
                <span role="status" className="sr-only">
                  Loading conversation
                </span>
              </div>
            )}

            {!historyState.loading && historyState.error && (
              <ErrorState error={historyState.error} onRetry={historyState.reload} />
            )}

            {isEmpty && !historyState.loading && (
              <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                <Sparkles size={32} className="text-muted-foreground" />
                <div>
                  <p className="text-base font-semibold text-foreground">Ask where you left something</p>
                  <p className="mt-1 text-dense text-muted-foreground">
                    I answer only from your recorded locations — and I&apos;ll cite the entries I use.
                  </p>
                </div>
                {showSuggestions && (
                  <ul className="flex flex-wrap justify-center gap-2">
                    {SUGGESTED_QUESTIONS.map((question) => (
                      <li key={question}>
                        <button
                          type="button"
                          onClick={() => setDraft(question)}
                          className={cx(
                            "rounded-full border border-border bg-secondary px-3 py-1.5 text-dense text-secondary-foreground hover:bg-muted",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          )}
                        >
                          {question}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="flex flex-col gap-4">
              {entries.map((entry) => {
                if (entry.kind === "user") {
                  return (
                    <div key={entry.id} className="flex justify-end">
                      <div className="max-w-[85%] rounded-lg bg-accent px-3 py-2 text-dense text-accent-foreground">
                        <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide opacity-80">
                          <User size={12} />
                          You
                        </p>
                        <p className="whitespace-pre-wrap">{entry.text}</p>
                        {entry.createdAt && (
                          <time
                            dateTime={toDateTimeAttr(entry.createdAt)}
                            className="mt-1 block text-right text-xs opacity-70"
                          >
                            {formatRelativeTime(entry.createdAt)}
                          </time>
                        )}
                      </div>
                    </div>
                  );
                }
                if (entry.kind === "error") {
                  return (
                    <div key={entry.id} className="flex justify-start">
                      <div className="max-w-[85%] rounded-lg border border-destructive/40 bg-danger-surface px-3 py-2 text-dense">
                        <p className="flex items-center gap-1.5 font-semibold text-destructive">
                          <WifiOff size={14} />
                          The assistant is temporarily unavailable. Your records are safe.
                        </p>
                        <p className="mt-1 text-foreground">{entry.message}</p>
                        <Button size="sm" variant="secondary" onClick={entry.retry} className="mt-2">
                          Retry
                        </Button>
                      </div>
                    </div>
                  );
                }
                return (
                  <AssistantBubble
                    key={entry.id}
                    reply={entry.reply}
                    onDecide={(decision) => {
                      if (entry.reply.pendingAction) void decide(entry.reply.pendingAction, decision);
                    }}
                  />
                );
              })}

              {pending && (
                <div className="flex justify-start">
                  <div
                    className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-dense text-muted-foreground"
                    role="status"
                  >
                    <span className="flex gap-1">
                      <span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:0ms]" />
                      <span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:150ms]" />
                      <span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:300ms]" />
                    </span>
                    Assistant is thinking
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Composer */}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void send(draft);
            }}
            className="border-t border-border p-3"
          >
            {composerError && (
              <p
                role="alert"
                className="mb-2 rounded-md border border-destructive/40 bg-danger-surface p-2 text-dense text-destructive"
              >
                {composerError}
              </p>
            )}
            <div className="flex items-end gap-2">
              <Textarea
                aria-label="Message the assistant"
                placeholder="Where did I put…?"
                value={draft}
                maxLength={2000}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void send(draft);
                  }
                }}
                className="min-h-16"
              />
              <Button type="submit" disabled={pending || draft.trim().length === 0} iconLeft={<Send size={16} />}>
                Send
              </Button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Enter sends — Shift+Enter adds a new line. Nothing is written to your records without your
              confirmation.
            </p>
          </form>
        </div>
      </div>

      <Dialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete this conversation?"
        description="This permanently deletes the messages in this conversation. It cannot be undone."
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteOpen(false)} disabled={deleteBusy}>
              Cancel
            </Button>
            <Button variant="danger" loading={deleteBusy} onClick={() => void deleteConversation()}>
              Delete
            </Button>
          </>
        }
      />
    </>
  );
}

function ConversationList({
  conversations,
  loading,
  error,
  onRetry,
  activeId,
  onSelect,
  onNew,
}: {
  conversations: ConversationDto[];
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-card shadow-subtle">
      <div className="border-b border-border p-3">
        <Button size="sm" onClick={onNew} iconLeft={<Plus size={14} />} className="w-full">
          New conversation
        </Button>
      </div>
      <div className="p-2">
        {loading && (
          <div className="flex flex-col gap-2" aria-hidden="true">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        )}
        {error ? <ErrorState error={error} onRetry={onRetry} /> : null}
        {!loading && !error && conversations.length === 0 && (
          <p className="p-2 text-dense text-muted-foreground">No conversations yet.</p>
        )}
        {!loading && !error && conversations.length > 0 && (
          <ul className="flex flex-col gap-1">
            {conversations.map((conversation) => {
              const isActive = conversation.id === activeId;
              const label =
                conversation.title ||
                (conversation.lastMessageAt
                  ? `Conversation from ${formatRelativeTime(conversation.lastMessageAt)}`
                  : "Conversation");
              return (
                <li key={conversation.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(conversation.id)}
                    aria-current={isActive ? "true" : undefined}
                    className={cx(
                      "w-full rounded-md px-2 py-2 text-left text-dense",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      isActive ? "bg-accent font-semibold text-accent-foreground" : "text-foreground hover:bg-muted/60",
                    )}
                  >
                    <span className="block truncate">{truncate(label, 40)}</span>
                    {conversation.lastMessageAt && (
                      <time
                        dateTime={toDateTimeAttr(conversation.lastMessageAt)}
                        className="block text-xs text-muted-foreground"
                      >
                        {formatRelativeTime(conversation.lastMessageAt)}
                      </time>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function AssistantBubble({
  reply,
  onDecide,
}: {
  reply: ReplyDto;
  onDecide: (decision: "confirm" | "cancel") => void;
}) {
  const isPendingAction = reply.status === "PENDING_ACTION" && reply.pendingAction !== null;
  const isFallback = reply.status === "FALLBACK";
  const isExpired = reply.status === "ERROR" && reply.pendingAction !== null;
  const hasCandidates = reply.candidates.length > 0;

  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] rounded-lg border-l-4 border-primary bg-muted px-3 py-2 text-dense">
        <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Sparkles size={12} />
          Assistant
        </p>

        {isFallback && (
          <p className="mb-2 flex items-center gap-1.5 rounded-md border border-warning/40 bg-warning-surface p-2 text-warning">
            <WifiOff size={14} />
            Using deterministic search — the assistant is degraded.
          </p>
        )}

        <p className="whitespace-pre-wrap text-foreground">{reply.text}</p>

        {/* Recorded fact marker (§4.6) */}
        {reply.citations.length > 0 && (
          <>
            <p className="mt-2 flex items-center gap-1.5 text-xs text-success">
              <CheckCircle size={12} />
              <Badge tone="success">Recorded</Badge>
              <span className="text-muted-foreground">
                Based on {reply.citations.length} recorded {reply.citations.length === 1 ? "entry" : "entries"}.
              </span>
            </p>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {reply.citations.map((citation, index) => (
                <li key={`${citation.id}-${index}`}>
                  <CitationChip citation={citation} />
                </li>
              ))}
            </ul>
          </>
        )}

        {/* Clarification candidates (FR-009) */}
        {hasCandidates && (
          <div className="mt-3 rounded-md border border-border bg-card p-2">
            <p className="mb-2 text-dense font-medium text-foreground">Which one did you mean?</p>
            <ul className="flex flex-wrap gap-2">
              {reply.candidates.map((candidate, index) => (
                <li key={`${candidate.id ?? candidate.name}-${index}`}>
                  <CandidateChip candidate={candidate} />
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Pending action confirmation (FR-024) */}
        {isPendingAction && reply.pendingAction && (
          <PendingActionCard action={reply.pendingAction} onDecide={onDecide} />
        )}

        {isExpired && reply.pendingAction && (
          <div className="mt-3 rounded-md border border-destructive/40 bg-danger-surface p-2">
            <p className="flex items-center gap-1.5 text-dense font-medium text-destructive">
              <AlertTriangle size={14} />
              This proposal expired
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Ask again to get a fresh one.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function CitationChip({ citation }: { citation: CitationDto }) {
  const label = citation.label ?? (citation.type === "item" ? "Item" : citation.type === "event" ? "Event" : "Location");
  const timeLabel = citation.occurredAt ? ` · ${formatRelativeTime(citation.occurredAt)}` : "";

  // Item citations link straight to the item. Event citations would need the
  // owning item's id to build an `/inventory/:itemId#event-<id>` anchor, but
  // CitationDto only carries the event id — TODO(T-055) once the assistant
  // endpoint includes itemId on event citations. Until then they render as a
  // non-link chip rather than a link that could point at the wrong record.
  if (citation.type === "item") {
    return (
      <Link
        href={`/inventory/${citation.id}`}
        className={cx(
          "inline-flex items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 text-xs text-foreground hover:bg-muted",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        <MapPin size={11} />
        {truncate(label, 32)}
        {timeLabel}
      </Link>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground">
      <MapPin size={11} />
      {truncate(label, 32)}
      {timeLabel}
    </span>
  );
}

function CandidateChip({ candidate }: { candidate: { id?: string; name: string; reason?: string | null } }) {
  if (candidate.id) {
    return (
      <Link
        href={`/inventory/${candidate.id}`}
        className={cx(
          "inline-flex items-center gap-1 rounded-full border border-primary/40 bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground hover:bg-muted",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        {candidate.name}
        {candidate.reason && <span className="opacity-70">— {candidate.reason}</span>}
      </Link>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2.5 py-1 text-xs text-muted-foreground">
      {candidate.name}
      {candidate.reason && <span className="opacity-70">— {candidate.reason}</span>}
    </span>
  );
}

function PendingActionCard({
  action,
  onDecide,
}: {
  action: PendingActionDto;
  onDecide: (decision: "confirm" | "cancel") => void;
}) {
  const [busy, setBusy] = useState<"confirm" | "cancel" | null>(null);
  const consumed = Boolean(action.consumedAt);
  const typeLabel =
    action.type === "record_location"
      ? "Record location"
      : action.type === "create_item"
        ? "Create item"
        : "Correct location";

  const itemName = action.payload.item?.name ?? action.payload.item?.existingId ?? "this item";
  const locationLabel = action.payload.location?.path ?? action.payload.location?.name ?? "a location";

  const act = async (decision: "confirm" | "cancel") => {
    setBusy(decision);
    try {
      await onDecide(decision);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mt-3 rounded-md border border-border bg-card p-3">
      <p className="flex items-center gap-1.5 text-dense font-semibold text-foreground">
        <Clock size={14} />
        {typeLabel}
      </p>
      <dl className="mt-2 space-y-1 text-xs text-muted-foreground">
        <div className="flex gap-2">
          <dt className="w-16 shrink-0">Item</dt>
          <dd className="text-foreground">{itemName}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-16 shrink-0">Location</dt>
          <dd className="text-foreground">{locationLabel}</dd>
        </div>
        {action.payload.occurredAt && (
          <div className="flex gap-2">
            <dt className="w-16 shrink-0">When</dt>
            <dd className="text-foreground">{formatDateTime(action.payload.occurredAt)}</dd>
          </div>
        )}
        {action.payload.note && (
          <div className="flex gap-2">
            <dt className="w-16 shrink-0">Note</dt>
            <dd className="text-foreground">{action.payload.note}</dd>
          </div>
        )}
      </dl>

      {consumed ? (
        <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-success">
          <CheckCircle size={12} />
          Done
        </p>
      ) : (
        <>
          <p className="mt-2 text-xs italic text-muted-foreground">Nothing has been saved yet.</p>
          <p className="text-xs text-muted-foreground">
            Expires {formatRelativeTime(action.expiresAt)} ({formatDateTime(action.expiresAt)}).
          </p>
          <div className="mt-2 flex gap-2">
            <Button size="sm" loading={busy === "confirm"} onClick={() => void act("confirm")}>
              Confirm
            </Button>
            <Button size="sm" variant="secondary" loading={busy === "cancel"} onClick={() => void act("cancel")}>
              Cancel
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
