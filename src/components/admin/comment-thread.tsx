"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, MessageSquare, Send } from "lucide-react";

import { EmptyState } from "@/components/layout/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CommentVisibility } from "@/generated/prisma/enums";
import type { CommentDto } from "@/domain/application/types";
import { callAction } from "@/lib/client-action";
import { addCommentAction } from "@/app/(admin)/admin/actions";

/**
 * Reviewer notes and shared feedback in one thread.
 *
 * The visibility toggle is deliberately prominent and defaults to *internal*:
 * the costly mistake is a candid panel note reaching the applicant, not the
 * reverse.
 */
export function CommentThread({
  applicationId,
  comments,
}: {
  applicationId: string;
  comments: CommentDto[];
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [visibility, setVisibility] = useState<"INTERNAL" | "SHARED">("INTERNAL");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await callAction(() =>
        addCommentAction({
          applicationId,
          values: { body, visibility },
        }),
      );

      if (!result.ok) {
        setError(result.fieldErrors?.body?.[0] ?? result.message);
        return;
      }

      toast.success(
        visibility === "SHARED" ? "Comment shared with the team." : "Internal note saved.",
      );
      setBody("");
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="space-y-3">
        <Tabs value={visibility} onValueChange={(value) => setVisibility(value as typeof visibility)}>
          <TabsList>
            <TabsTrigger value="INTERNAL">
              <EyeOff className="size-3.5" aria-hidden />
              Internal note
            </TabsTrigger>
            <TabsTrigger value="SHARED">
              <Eye className="size-3.5" aria-hidden />
              Share with team
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <Field data-invalid={Boolean(error) || undefined}>
          <FieldLabel htmlFor="comment-body" className="sr-only">
            {visibility === "SHARED" ? "Comment for the team" : "Internal note"}
          </FieldLabel>
          <Textarea
            id="comment-body"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={3}
            placeholder={
              visibility === "SHARED"
                ? "This will be visible to the team on their dashboard…"
                : "Only the review panel can see this…"
            }
            aria-invalid={Boolean(error) || undefined}
          />
          <FieldDescription>
            {visibility === "SHARED"
              ? "The team is notified by email and sees this on their dashboard."
              : "Never shown to the applicant."}
          </FieldDescription>
          {error && <FieldError>{error}</FieldError>}
        </Field>

        <Button type="submit" size="sm" disabled={isPending || body.trim().length < 2}>
          {isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Saving…
            </>
          ) : (
            <>
              <Send className="size-4" aria-hidden />
              {visibility === "SHARED" ? "Share comment" : "Save note"}
            </>
          )}
        </Button>
      </form>

      {comments.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="No comments yet"
          description="Notes you add here stay with the application."
        />
      ) : (
        <ul className="space-y-3">
          {comments.map((comment) => {
            const isShared = comment.visibility === CommentVisibility.SHARED;

            return (
              <li
                key={comment.id}
                className={`rounded-lg border p-3 ${isShared ? "border-info/30 bg-info/5" : "bg-muted/30"}`}
              >
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{comment.authorName}</span>
                  <Badge variant={isShared ? "secondary" : "outline"} className="gap-1">
                    {isShared ? (
                      <>
                        <Eye className="size-3" aria-hidden />
                        Shared with team
                      </>
                    ) : (
                      <>
                        <EyeOff className="size-3" aria-hidden />
                        Internal
                      </>
                    )}
                  </Badge>
                  <time
                    dateTime={comment.createdAt}
                    title={new Date(comment.createdAt).toLocaleString()}
                    className="text-xs text-muted-foreground"
                  >
                    {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                  </time>
                </div>
                <p className="text-pretty text-sm whitespace-pre-wrap">{comment.body}</p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
