"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, Check, Loader2, Lock, Undo2, UserMinus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { ReviewAssignmentStatus } from "@/generated/prisma/enums";
import {
  MODERATION_SPREAD_THRESHOLD,
  isScorecardComplete,
  scoreCard,
  type Criterion,
  type ScoreEntry,
} from "@/domain/review/rubric";
import { callAction } from "@/lib/client-action";
import { cn } from "@/lib/utils";
import {
  recuseAction,
  reopenScorecardAction,
  saveScoresAction,
  submitScorecardAction,
} from "@/app/(admin)/admin/review-actions";

/**
 * One reviewer's marking card.
 *
 * The running total is computed with {@link scoreCard} — the same function the
 * server ranks the cohort with. A reviewer watching their own percentage move
 * as they mark is watching the real arithmetic, not an approximation of it,
 * which is the whole reason the rubric lives in `domain/`.
 *
 * Other panel members' marks are deliberately absent from the payload until
 * they commit, and even then only as totals. Anchoring is the failure mode
 * multiple reviewers exist to prevent.
 */

export interface PanelCard {
  assignmentId: string;
  reviewerId: string;
  reviewerName: string;
  status: ReviewAssignmentStatus;
  recusedReason: string | null;
  submittedAt: string | null;
  isMine: boolean;
  scores: Array<{ criterionId: string; value: number; comment: string | null }>;
}

export function ScorecardPanel({
  criteria,
  cards,
  aggregate,
}: {
  criteria: Criterion[];
  cards: PanelCard[];
  aggregate: {
    percentage: number | null;
    countedCards: number;
    pendingCards: number;
    spread: number | null;
    needsModeration: boolean;
  };
}) {
  const mine = cards.find((card) => card.isMine);
  const others = cards.filter((card) => !card.isMine);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Panel score</CardTitle>
            <CardDescription>
              Advisory only. The panel&rsquo;s decision is recorded separately and is not
              bound by this number.
            </CardDescription>
          </div>
          <AggregateBadge aggregate={aggregate} />
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-6">
        {aggregate.needsModeration && (
          <p
            className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm text-warning"
            role="status"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>
              Reviewers are {aggregate.spread} points apart, over the{" "}
              {MODERATION_SPREAD_THRESHOLD}-point moderation threshold. Worth a conversation
              before this result stands — a gap this wide usually means someone missed a
              section or an attachment.
            </span>
          </p>
        )}

        {mine ? (
          <MyScorecard criteria={criteria} card={mine} />
        ) : (
          <p className="text-sm text-muted-foreground">
            This entry is not allocated to you, so there is nothing for you to mark.
          </p>
        )}

        {others.length > 0 && <OtherCards cards={others} criteria={criteria} />}
      </CardContent>
    </Card>
  );
}

function AggregateBadge({
  aggregate,
}: {
  aggregate: { percentage: number | null; countedCards: number };
}) {
  if (aggregate.percentage === null) {
    return (
      <Badge variant="outline" className="text-muted-foreground">
        Not yet scored
      </Badge>
    );
  }

  return (
    <div className="text-right">
      <div className="font-mono text-2xl font-semibold tabular-nums">
        {aggregate.percentage}%
      </div>
      <div className="text-xs text-muted-foreground">
        {aggregate.countedCards} {aggregate.countedCards === 1 ? "reviewer" : "reviewers"}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The signed-in reviewer's own card
// ---------------------------------------------------------------------------

function MyScorecard({ criteria, card }: { criteria: Criterion[]; card: PanelCard }) {
  const router = useRouter();
  const [values, setValues] = useState<Map<string, number>>(
    () => new Map(card.scores.map((score) => [score.criterionId, score.value])),
  );
  const [comments, setComments] = useState<Map<string, string>>(
    () => new Map(card.scores.map((score) => [score.criterionId, score.comment ?? ""])),
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [recusing, setRecusing] = useState(false);
  const [recuseReason, setRecuseReason] = useState("");

  const locked = card.status === ReviewAssignmentStatus.SUBMITTED;
  const recused = card.status === ReviewAssignmentStatus.RECUSED;

  // The same arithmetic the server ranks with.
  const entries: ScoreEntry[] = useMemo(
    () =>
      [...values.entries()].map(([criterionId, value]) => ({
        criterionId,
        value,
        comment: comments.get(criterionId) ?? null,
      })),
    [values, comments],
  );

  const running = useMemo(
    () =>
      scoreCard(criteria, {
        assignmentId: card.assignmentId,
        reviewerId: card.reviewerId,
        reviewerName: card.reviewerName,
        status: card.status,
        scores: entries,
      }),
    [criteria, card, entries],
  );

  const complete = isScorecardComplete(criteria, entries);

  const persist = (next: Map<string, number>, nextComments: Map<string, string>) => {
    const payload = [...next.entries()].map(([criterionId, value]) => ({
      criterionId,
      value,
      comment: nextComments.get(criterionId)?.trim() || null,
    }));

    if (payload.length === 0) return;

    startTransition(async () => {
      const result = await callAction(() =>
        saveScoresAction({ assignmentId: card.assignmentId, scores: payload }),
      );
      if (!result.ok) setError(result.message);
      else setError(null);
    });
  };

  const setMark = (criterionId: string, value: number) => {
    const next = new Map(values).set(criterionId, value);
    setValues(next);
    persist(next, comments);
  };

  const setComment = (criterionId: string, value: string) => {
    const next = new Map(comments).set(criterionId, value);
    setComments(next);
  };

  const submit = () => {
    startTransition(async () => {
      const result = await callAction(() =>
        submitScorecardAction({ assignmentId: card.assignmentId }),
      );
      if (!result.ok) {
        setError(result.message);
        return;
      }
      toast.success("Scorecard submitted. It now counts towards the ranking.");
      router.refresh();
    });
  };

  const reopen = () => {
    startTransition(async () => {
      const result = await callAction(() =>
        reopenScorecardAction({ assignmentId: card.assignmentId }),
      );
      if (!result.ok) {
        setError(result.message);
        return;
      }
      toast.success("Scorecard reopened. It no longer counts until you submit it again.");
      router.refresh();
    });
  };

  const recuse = () => {
    startTransition(async () => {
      const result = await callAction(() =>
        recuseAction({ assignmentId: card.assignmentId, reason: recuseReason }),
      );
      if (!result.ok) {
        setError(result.fieldErrors?.reason?.[0] ?? result.message);
        return;
      }
      toast.success("You have stepped away from this entry.");
      setRecusing(false);
      router.refresh();
    });
  };

  if (recused) {
    return (
      <div className="rounded-md border border-dashed p-4 text-sm">
        <p className="flex items-center gap-2 font-medium">
          <UserMinus className="size-4" aria-hidden="true" />
          You stepped away from this entry
        </p>
        <p className="mt-1 text-muted-foreground">{card.recusedReason}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Your marks</h3>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {isPending && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
          <span className="font-mono tabular-nums">
            {running.scoredCount}/{running.criterionCount} · {running.percentage}%
          </span>
          {locked && (
            <Badge variant="outline" className="gap-1">
              <Lock className="size-3" aria-hidden="true" />
              Submitted
            </Badge>
          )}
        </div>
      </div>

      <ul className="flex flex-col gap-4">
        {criteria.map((criterion) => (
          <li key={criterion.id} className="flex flex-col gap-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-sm font-medium">{criterion.name}</span>
              <span className="font-mono text-xs text-muted-foreground tabular-nums">
                weight {criterion.weight} · out of {criterion.maxValue}
              </span>
            </div>

            {criterion.description && (
              <p className="text-xs text-muted-foreground">{criterion.description}</p>
            )}

            <MarkSelector
              criterion={criterion}
              value={values.get(criterion.id)}
              disabled={locked || isPending}
              onChange={(value) => setMark(criterion.id, value)}
            />

            <Textarea
              rows={2}
              placeholder="Why this mark? (optional, but valuable at the top and bottom of the scale)"
              value={comments.get(criterion.id) ?? ""}
              disabled={locked}
              onChange={(event) => setComment(criterion.id, event.target.value)}
              onBlur={() => persist(values, comments)}
              className="text-sm"
            />
          </li>
        ))}
      </ul>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {locked ? (
          <Button variant="outline" onClick={reopen} disabled={isPending}>
            <Undo2 className="size-4" aria-hidden="true" />
            Reopen and change my marks
          </Button>
        ) : (
          <Button onClick={submit} disabled={!complete || isPending}>
            <Check className="size-4" aria-hidden="true" />
            Submit scorecard
          </Button>
        )}

        {!locked && !recusing && (
          <Button variant="ghost" onClick={() => setRecusing(true)} disabled={isPending}>
            <UserMinus className="size-4" aria-hidden="true" />
            Step away
          </Button>
        )}
      </div>

      {!complete && !locked && (
        <p className="text-xs text-muted-foreground">
          Mark every line before submitting. {running.criterionCount - running.scoredCount} left.
        </p>
      )}

      {recusing && (
        <Field className="rounded-md border p-3">
          <FieldLabel htmlFor="recuse-reason">
            Why are you stepping away from this entry?
          </FieldLabel>
          <Textarea
            id="recuse-reason"
            rows={2}
            value={recuseReason}
            onChange={(event) => setRecuseReason(event.target.value)}
            placeholder="You supervise the team, taught the members, or have another conflict."
          />
          <FieldError>
            This goes on the record, and any marks you have already made are discarded.
          </FieldError>
          <div className="flex gap-2">
            <Button
              variant="destructive"
              size="sm"
              onClick={recuse}
              disabled={isPending || recuseReason.trim().length < 5}
            >
              Step away
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setRecusing(false)}>
              Cancel
            </Button>
          </div>
        </Field>
      )}
    </div>
  );
}

/**
 * Marks are picked from a row of buttons rather than typed.
 *
 * A five-point scale has five answers; a number input invites a sixth, and
 * every one of those has to be rejected somewhere. Radio semantics because that
 * is what this is — one choice from a small fixed set — which also gives
 * keyboard users arrow-key navigation for free.
 */
function MarkSelector({
  criterion,
  value,
  disabled,
  onChange,
}: {
  criterion: Criterion;
  value: number | undefined;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  const options = Array.from({ length: criterion.maxValue + 1 }, (_, index) => index);

  return (
    <div
      role="radiogroup"
      aria-label={`Mark for ${criterion.name}, out of ${criterion.maxValue}`}
      className="flex flex-wrap gap-1.5"
    >
      {options.map((option) => {
        const selected = value === option;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(option)}
            className={cn(
              "size-9 rounded-md border font-mono text-sm tabular-nums transition-colors",
              "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
              "disabled:cursor-not-allowed disabled:opacity-50",
              selected
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input hover:bg-accent hover:text-accent-foreground",
            )}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Everyone else
// ---------------------------------------------------------------------------

function OtherCards({ cards, criteria }: { cards: PanelCard[]; criteria: Criterion[] }) {
  return (
    <div className="flex flex-col gap-2 border-t pt-4">
      <h3 className="text-sm font-semibold">Other reviewers</h3>
      <ul className="flex flex-col gap-1.5">
        {cards.map((card) => (
          <li
            key={card.assignmentId}
            className="flex flex-wrap items-center justify-between gap-2 text-sm"
          >
            <span>{card.reviewerName}</span>
            <OtherCardState card={card} criteria={criteria} />
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        Another reviewer&rsquo;s individual marks stay hidden until they submit, so the panel
        does not anchor on each other.
      </p>
    </div>
  );
}

function OtherCardState({ card, criteria }: { card: PanelCard; criteria: Criterion[] }) {
  if (card.status === ReviewAssignmentStatus.RECUSED) {
    return (
      <Badge variant="outline" className="gap-1 text-muted-foreground">
        <UserMinus className="size-3" aria-hidden="true" />
        Stepped away
      </Badge>
    );
  }

  if (card.status !== ReviewAssignmentStatus.SUBMITTED) {
    return (
      <Badge variant="outline" className="text-muted-foreground">
        In progress
      </Badge>
    );
  }

  // Committed, so the total is visible. `scores` is empty for other reviewers,
  // so this reads the aggregate the server already computed rather than
  // recomputing from marks the client was deliberately not sent.
  const result = scoreCard(criteria, {
    assignmentId: card.assignmentId,
    reviewerId: card.reviewerId,
    reviewerName: card.reviewerName,
    status: card.status,
    scores: card.scores,
  });

  return (
    <span className="font-mono text-sm tabular-nums">
      {card.scores.length > 0 ? `${result.percentage}%` : "Submitted"}
    </span>
  );
}
