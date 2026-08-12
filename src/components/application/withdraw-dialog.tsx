"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Undo2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { callAction } from "@/lib/client-action";
import { withdrawApplicationAction } from "@/app/(student)/application/actions";

/**
 * Withdrawing frees the team's slot for the challenge year, so it asks for a
 * reason and confirms explicitly rather than acting on a single click.
 */
export function WithdrawApplicationDialog({ applicationId }: { applicationId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const submit = () => {
    setError(null);

    startTransition(async () => {
      const result = await callAction(() =>
        withdrawApplicationAction({ applicationId, reason }),
      );

      if (!result.ok) {
        setError(result.fieldErrors?.form?.[0] ?? result.message);
        return;
      }

      toast.success("Your application has been withdrawn.");
      setOpen(false);
      setReason("");
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Undo2 className="size-4" aria-hidden />
          Withdraw application
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Withdraw your application?</DialogTitle>
          <DialogDescription>
            Your entry will be removed from the review queue for this challenge year. You can start
            a fresh application afterwards, but this one cannot be restored.
          </DialogDescription>
        </DialogHeader>

        <Field data-invalid={Boolean(error) || undefined}>
          <FieldLabel htmlFor="withdraw-reason">Reason for withdrawing</FieldLabel>
          <Textarea
            id="withdraw-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={4}
            placeholder="Tell the challenge office briefly why you are withdrawing."
            aria-invalid={Boolean(error) || undefined}
          />
          <FieldDescription>
            This is recorded with your application and visible to the challenge office.
          </FieldDescription>
          {error && <FieldError>{error}</FieldError>}
        </Field>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={isPending}>
              Keep my application
            </Button>
          </DialogClose>
          <Button variant="destructive" onClick={submit} disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Withdrawing…
              </>
            ) : (
              "Withdraw application"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
