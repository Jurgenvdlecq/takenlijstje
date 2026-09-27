"use client";

import { Loader2, MessageCircle, SendHorizontal, ShoppingCart, Trash2 } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { MemberAvatar } from "@/components/member-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useHousehold } from "@/features/household/store";
import { guessCategory, parseShoppingInput } from "@/features/shopping/parse";
import { getBrowserClient } from "@/lib/supabase/client";
import { newId } from "@/lib/utils";
import { addCommentAction, deleteCommentAction } from "@/server/actions/tasks";
import type { CommentRow } from "@/types/database";

function timeAgo(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "zojuist";
  if (minutes < 60) return `${minutes} min geleden`;
  return new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

/** Notities bij een taak, bijv. "WC-reiniger is bijna op" → direct op de boodschappenlijst. */
export function TaskComments({ taskId }: { taskId: string }) {
  const { snapshot, run, mutate } = useHousehold();
  const [comments, setComments] = React.useState<CommentRow[] | null>(null);
  const [body, setBody] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const [reloadKey, setReloadKey] = React.useState(0);
  const reload = () => setReloadKey((k) => k + 1);

  // (Opnieuw) laden bij openen, na eigen wijzigingen en na realtime-verversing
  React.useEffect(() => {
    let cancelled = false;
    getBrowserClient()
      .from("task_comments")
      .select("*")
      .eq("task_id", taskId)
      .order("created_at")
      .then(({ data }) => {
        if (!cancelled) setComments((current) => (data as CommentRow[] | null) ?? current ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, [taskId, reloadKey, snapshot.loadedAt]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text) return;
    setBusy(true);
    const id = newId();
    const ok = await run(() => addCommentAction({ id, taskId, body: text }));
    setBusy(false);
    if (ok !== null) {
      setBody("");
      reload();
    }
  }

  async function toShoppingList(comment: CommentRow) {
    // "WC-reiniger is bijna op" → "WC-reiniger"
    const text = comment.body.replace(/\s+(is|zijn)\s+(bijna\s+)?(op|leeg)\.?$/i, "").slice(0, 80);
    const parsed = parseShoppingInput(text);
    const name = parsed.name || text;
    const ok = await mutate("shoppingAdd", {
      id: newId(),
      name,
      quantity: parsed.quantity,
      category: guessCategory(name),
      note: "Uit notitie bij taak",
    });
    if (ok) toast.success(`“${name}” op de boodschappenlijst gezet`);
  }

  return (
    <section className="grid gap-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <MessageCircle className="size-4 text-muted-foreground" /> Opmerkingen
      </h3>
      {comments === null ? (
        <div className="h-10 animate-pulse rounded-xl bg-muted" />
      ) : comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nog geen opmerkingen.</p>
      ) : (
        <ul className="grid gap-2">
          {comments.map((c) => {
            const author = snapshot.members.find((m) => m.id === c.member_id);
            const mine = c.member_id === snapshot.me.id;
            return (
              <li key={c.id} className="flex gap-2.5 rounded-2xl bg-muted/60 p-3">
                <MemberAvatar member={author} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{author?.display_name ?? "Onbekend"}</span> · {timeAgo(c.created_at)}
                  </p>
                  <p className="mt-0.5 text-sm break-words whitespace-pre-wrap">{c.body}</p>
                  <div className="mt-1.5 flex gap-1">
                    <Button type="button" variant="ghost" size="sm" className="h-8 px-2.5" onClick={() => void toShoppingList(c)}>
                      <ShoppingCart /> Toevoegen aan boodschappenlijst
                    </Button>
                    {(mine || snapshot.me.role === "admin") && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Opmerking verwijderen"
                        onClick={async () => {
                          await run(() => deleteCommentAction(c.id));
                          reload();
                        }}
                      >
                        <Trash2 />
                      </Button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <form onSubmit={submit} className="flex gap-2">
        <Input
          value={body}
          maxLength={1000}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Bijv. WC-reiniger is bijna op"
          aria-label="Nieuwe opmerking"
        />
        <Button type="submit" size="icon" disabled={busy || !body.trim()} aria-label="Plaatsen">
          {busy ? <Loader2 className="animate-spin" /> : <SendHorizontal />}
        </Button>
      </form>
    </section>
  );
}
