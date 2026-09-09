"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, UserPlus } from "lucide-react";

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
import { Input } from "@/components/ui/input";
import { callAction } from "@/lib/client-action";
import { addPanelMemberAction } from "@/app/(admin)/admin/actions";

/**
 * Adds an assessor who will never sign in.
 *
 * The form is two fields because the account it creates has nothing else to
 * decide: a panel member is always a reviewer, and always active. Anything more
 * configurable would imply this is a general "create user" screen, which it is
 * deliberately not — people who can sign in arrive by signing in.
 */
export function AddPanelMember() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [isPending, startTransition] = useTransition();

  const reset = () => {
    setName("");
    setEmail("");
    setError(null);
    setFieldErrors({});
  };

  const submit = () => {
    setError(null);
    setFieldErrors({});

    startTransition(async () => {
      const result = await callAction(() => addPanelMemberAction({ name, email }));

      if (!result.ok) {
        setFieldErrors(result.fieldErrors ?? {});
        setError(result.fieldErrors?.form?.[0] ?? result.message);
        return;
      }

      // Say which address was recorded. When one was minted here, that is the
      // only place the administrator will ever see it, and it is what tells
      // this row apart from the next placeholder in the directory.
      toast.success(
        result.data.emailIsPlaceholder
          ? `${result.data.name} added to the panel, with no contact address (${result.data.email}).`
          : `${result.data.name} added to the panel.`,
      );

      setOpen(false);
      reset();
      router.refresh();
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <UserPlus className="size-4" aria-hidden="true" />
          Add panel member
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a panel member</DialogTitle>
          <DialogDescription>
            For an assessor who will not sign in — someone marking on paper, or a judge
            from outside the university. They are added as a reviewer so entries can be
            allocated to them, and the challenge office enters their marks.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="panel-member-name">Full name</FieldLabel>
            <Input
              id="panel-member-name"
              value={name}
              disabled={isPending}
              autoComplete="off"
              placeholder="Dr Anna Wamp"
              onChange={(event) => setName(event.target.value)}
            />
            <FieldDescription>
              As it should appear beside their marks on the panel.
            </FieldDescription>
            {fieldErrors.name?.[0] && <FieldError>{fieldErrors.name[0]}</FieldError>}
          </Field>

          <Field>
            <FieldLabel htmlFor="panel-member-email">Email (optional)</FieldLabel>
            <Input
              id="panel-member-email"
              type="email"
              value={email}
              disabled={isPending}
              autoComplete="off"
              placeholder="anna.wamp@example.org"
              onChange={(event) => setEmail(event.target.value)}
            />
            <FieldDescription>
              A university address lets them sign in later and see their own card. Any
              other address cannot sign in, which is usually what you want for a visiting
              judge. Leave it blank if you do not have one.
            </FieldDescription>
            {fieldErrors.email?.[0] && <FieldError>{fieldErrors.email[0]}</FieldError>}
          </Field>

          {error && !fieldErrors.name && !fieldErrors.email && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" disabled={isPending}>
              Cancel
            </Button>
          </DialogClose>
          <Button onClick={submit} disabled={isPending || name.trim().length < 2}>
            {isPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            Add to panel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
