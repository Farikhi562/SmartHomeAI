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
 * Copy is Bahasa Indonesia; touch targets ≥ 44 px for the elderly audience.
 */

const SUGGESTED_QUESTIONS = [
  "Di mana saya terakhir menyimpan kunci motor?",
  "Isi apa yang ada di laci kamar tidur?",
  "Saya menyimpan dompet di laci kamar tidur",
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
      <PageHeader title="Asisten" />
      <div className="flex flex-col gap-3">
        <Skeleton className="h-20 w-2/3 self-end rounded-lg" />
        <Skeleton className="h-24 w-3/4 rounded-lg" />
        <Skeleton className="h-20 w-2/3 self-end rounded-lg" />
      </div>
      <span role="status" className="sr-only">
        Memuat asisten…
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
            `Asisten sedang membatasi permintaan — coba lagi dalam ${apiError.retryAfterSec ?? 60} detik.`,
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
          title: "Tercatat",
          description: result.event ? `Lokasi tersimpan untuk ${result.event.item?.name ?? "barang ini"}.` : undefined,
          tone: "success",
        });
        if (result.item) {
          toast({ title: "Barang ditambahkan", description: result.item.name, tone: "success" });
        }
      } else {
        toast({ title: "Dibatalkan — tidak ada yang disimpan", tone: "info" });
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
        toast({ title: "Usulan ini sudah kedaluwarsa", description: "Tanyakan lagi untuk mendapatkan usulan baru.", tone: "error" });
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
      toast({ title: "Percakapan dihapus", tone: "success" });
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
        title="Asisten"
        subtitle="Tanya dengan bahasa sehari-hari — jawaban hanya dari catatan Anda sendiri."
        actions={
          <>
            <Button variant="secondary" className="min-h-11 text-lg lg:hidden" onClick={() => setListOpen(true)}>
              Riwayat
            </Button>
            <Button className="min-h-11 text-lg" onClick={startNew} iconLeft={<Plus size={16} aria-hidden="true" />}>
              Percakapan baru
            </Button>
            {activeConversationId && (
              <Button variant="danger" className="min-h-11 text-lg" onClick={() => setDeleteOpen(true)} iconLeft={<Trash size={16} aria-hidden="true" />}>
                Hapus
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
          <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Daftar percakapan">
            <div className="absolute inset-0 bg-black/50" onMouseDown={() => setListOpen(false)} aria-hidden="true" />
            <div className="absolute inset-y-0 left-0 w-80 max-w-[85vw] bg-popover p-3 shadow-overlay">
              <div className="mb-2 flex justify-end">
                <Button variant="ghost" className="min-h-11 text-lg" onClick={() => setListOpen(false)}>
                  Tutup
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
            aria-label="Isi percakapan"
          >
            {historyState.loading && (
              <div className="flex flex-col gap-3">
                <Skeleton className="h-16 w-2/3 self-end rounded-lg" />
                <Skeleton className="h-20 w-3/4 rounded-lg" />
                <span role="status" className="sr-only">
                  Memuat percakapan…
                </span>
              </div>
            )}

            {!historyState.loading && historyState.error && (
              <ErrorState error={historyState.error} onRetry={historyState.reload} />
            )}

            {isEmpty && !historyState.loading && (
              <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                <Sparkles size={32} className="text-muted-foreground" aria-hidden="true" />
                <div>
                  <p className="text-lg font-semibold text-foreground">Tanyakan di mana Anda meninggalkan sesuatu</p>
                  <p className="mt-1 text-base text-muted-foreground">
                    Jawaban hanya dari catatan lokasi yang Anda simpan — dan setiap jawaban menyertakan catatan yang dipakai.
                  </p>
                </div>
                {showSuggestions && (
                  <ul className="flex flex-wrap justify-center gap-3" aria-label="Pertanyaan saran">
                    {SUGGESTED_QUESTIONS.map((question) => (
                      <li key={question}>
                        <button
                          type="button"
                          onClick={() => setDraft(question)}
                          className={cx(
                            "min-h-11 rounded-full border border-border bg-secondary px-4 py-2 text-base text-secondary-foreground hover:bg-muted",
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
                      <div className="max-w-[85%] rounded-lg bg-accent px-3 py-2 text-base text-accent-foreground">
                        <p className="mb-1 flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide opacity-80">
                          <User size={12} aria-hidden="true" />
                          Anda
                        </p>
                        <p className="whitespace-pre-wrap">{entry.text}</p>
                        {entry.createdAt && (
                          <time
                            dateTime={toDateTimeAttr(entry.createdAt)}
                            className="mt-1 block text-right text-sm opacity-70"
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
                      <div className="max-w-[85%] rounded-lg border border-destructive/40 bg-danger-surface px-3 py-2 text-base">
                        <p className="flex items-center gap-1.5 font-semibold text-destructive">
                          <WifiOff size={14} aria-hidden="true" />
                          Asisten sedang tidak tersedia untuk sementara. Catatan Anda aman.
                        </p>
                        <p className="mt-1 text-foreground">{entry.message}</p>
                        <Button size="sm" variant="secondary" className="mt-2 min-h-11 text-lg" onClick={entry.retry}>
                          Coba lagi
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
                    className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-base text-muted-foreground"
                    role="status"
                  >
                    <span className="flex gap-1" aria-hidden="true">
                      <span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:0ms]" />
                      <span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:150ms]" />
                      <span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:300ms]" />
                    </span>
                    Asisten sedang berpikir…
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
                className="mb-2 rounded-md border border-destructive/40 bg-danger-surface p-2 text-base text-destructive"
              >
                {composerError}
              </p>
            )}
            <div className="flex items-end gap-3">
              <Textarea
                aria-label="Tulis pesan untuk asisten"
                placeholder="Di mana saya menyimpan…?"
                value={draft}
                maxLength={2000}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void send(draft);
                  }
                }}
                className="min-h-16 text-lg"
              />
              <Button
                type="submit"
                className="min-h-12 text-lg"
                disabled={pending || draft.trim().length === 0}
                iconLeft={<Send size={16} aria-hidden="true" />}
              >
                Kirim
              </Button>
            </div>
            <p className="mt-1 text-base text-muted-foreground">
              Enter untuk mengirim — Shift+Enter untuk baris baru. Tidak ada yang disimpan ke catatan
              Anda tanpa persetujuan Anda.
            </p>
          </form>
        </div>
      </div>

      <Dialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Hapus percakapan ini?"
        description="Semua pesan dalam percakapan ini akan dihapus permanen dan tidak bisa dibatalkan."
        footer={
          <>
            <Button variant="secondary" className="min-h-11 text-lg" onClick={() => setDeleteOpen(false)} disabled={deleteBusy}>
              Batal
            </Button>
            <Button variant="danger" className="min-h-11 text-lg" loading={deleteBusy} onClick={() => void deleteConversation()}>
              Hapus
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
        <Button onClick={onNew} className="w-full min-h-11 text-lg" iconLeft={<Plus size={14} aria-hidden="true" />}>
          Percakapan baru
        </Button>
      </div>
      <div className="p-2">
        {loading && (
          <div className="flex flex-col gap-2" aria-hidden="true">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        )}
        {error ? <ErrorState error={error} onRetry={onRetry} /> : null}
        {!loading && !error && conversations.length === 0 && (
          <p className="p-2 text-base text-muted-foreground">Belum ada percakapan.</p>
        )}
        {!loading && !error && conversations.length > 0 && (
          <ul className="flex flex-col gap-1">
            {conversations.map((conversation) => {
              const isActive = conversation.id === activeId;
              const label =
                conversation.title ||
                (conversation.lastMessageAt
                  ? `Percakapan dari ${formatRelativeTime(conversation.lastMessageAt)}`
                  : "Percakapan");
              return (
                <li key={conversation.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(conversation.id)}
                    aria-current={isActive ? "true" : undefined}
                    className={cx(
                      "min-h-11 w-full rounded-md px-2 py-2 text-left text-base",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      isActive ? "bg-accent font-semibold text-accent-foreground" : "text-foreground hover:bg-muted/60",
                    )}
                  >
                    <span className="block truncate">{truncate(label, 40)}</span>
                    {conversation.lastMessageAt && (
                      <time
                        dateTime={toDateTimeAttr(conversation.lastMessageAt)}
                        className="block text-sm text-muted-foreground"
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
      <div className="max-w-[85%] rounded-lg border-l-4 border-primary bg-muted px-3 py-2 text-base">
        <p className="mb-1 flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          <Sparkles size={12} aria-hidden="true" />
          Asisten
        </p>

        {isFallback && (
          <p className="mb-2 flex items-center gap-1.5 rounded-md border border-warning/40 bg-warning-surface p-2 text-warning">
            <WifiOff size={14} aria-hidden="true" />
            Memakai pencarian biasa — asisten sedang terganggu.
          </p>
        )}

        <p className="whitespace-pre-wrap text-foreground">{reply.text}</p>

        {/* Recorded fact marker (§4.6) */}
        {reply.citations.length > 0 && (
          <>
            <p className="mt-2 flex items-center gap-1.5 text-sm text-success">
              <CheckCircle size={12} aria-hidden="true" />
              <Badge tone="success">Tercatat</Badge>
              <span className="text-muted-foreground">
                Berdasarkan {reply.citations.length} catatan tersimpan.
              </span>
            </p>
            <ul className="mt-2 flex flex-wrap gap-2">
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
            <p className="mb-2 text-base font-medium text-foreground">Yang mana yang Anda maksud?</p>
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
            <p className="flex items-center gap-1.5 text-base font-medium text-destructive">
              <AlertTriangle size={14} aria-hidden="true" />
              Usulan ini sudah kedaluwarsa
            </p>
            <p className="mt-1 text-sm text-muted-foreground">Tanyakan lagi untuk mendapatkan usulan baru.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function CitationChip({ citation }: { citation: CitationDto }) {
  const label = citation.label ?? (citation.type === "item" ? "Barang" : citation.type === "event" ? "Catatan" : "Lokasi");
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
          "inline-flex items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 text-sm text-foreground hover:bg-muted",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        <MapPin size={11} aria-hidden="true" />
        {truncate(label, 32)}
        {timeLabel}
      </Link>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-sm text-muted-foreground">
      <MapPin size={11} aria-hidden="true" />
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
          "inline-flex items-center gap-1 rounded-full border border-primary/40 bg-accent px-2.5 py-1 text-sm font-medium text-accent-foreground hover:bg-muted",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        {candidate.name}
        {candidate.reason && <span className="opacity-70">— {candidate.reason}</span>}
      </Link>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2.5 py-1 text-sm text-muted-foreground">
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
      ? "Catat lokasi"
      : action.type === "create_item"
        ? "Tambah barang"
        : "Koreksi lokasi";

  const itemName = action.payload.item?.name ?? action.payload.item?.existingId ?? "barang ini";
  const locationLabel = action.payload.location?.path ?? action.payload.location?.name ?? "sebuah lokasi";

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
      <p className="flex items-center gap-1.5 text-base font-semibold text-foreground">
        <Clock size={14} aria-hidden="true" />
        {typeLabel}
      </p>
      <dl className="mt-2 space-y-1 text-sm text-muted-foreground">
        <div className="flex gap-2">
          <dt className="w-20 shrink-0">Barang</dt>
          <dd className="text-foreground">{itemName}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="w-20 shrink-0">Lokasi</dt>
          <dd className="text-foreground">{locationLabel}</dd>
        </div>
        {action.payload.occurredAt && (
          <div className="flex gap-2">
            <dt className="w-20 shrink-0">Kapan</dt>
            <dd className="text-foreground">{formatDateTime(action.payload.occurredAt)}</dd>
          </div>
        )}
        {action.payload.note && (
          <div className="flex gap-2">
            <dt className="w-20 shrink-0">Catatan</dt>
            <dd className="text-foreground">{action.payload.note}</dd>
          </div>
        )}
      </dl>

      {consumed ? (
        <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-success">
          <CheckCircle size={12} aria-hidden="true" />
          Selesai
        </p>
      ) : (
        <>
          <p className="mt-2 text-sm italic text-muted-foreground">Belum ada yang disimpan.</p>
          <p className="text-sm text-muted-foreground">
            Berlaku sampai {formatRelativeTime(action.expiresAt)} ({formatDateTime(action.expiresAt)}).
          </p>
          <div className="mt-2 flex gap-3">
            <Button size="sm" className="min-h-11 text-lg" loading={busy === "confirm"} onClick={() => void act("confirm")}>
              Konfirmasi
            </Button>
            <Button size="sm" variant="secondary" className="min-h-11 text-lg" loading={busy === "cancel"} onClick={() => void act("cancel")}>
              Batal
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
