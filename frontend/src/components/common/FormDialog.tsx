import type { FormEvent, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface FormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  submitLabel: string;
  submitting?: boolean;
  /** Pass react-hook-form's `handleSubmit(onValid)` here. */
  onSubmit: (event?: FormEvent) => unknown;
  /** Inline, form-level error (e.g. a backend rejection) shown above the buttons. */
  error?: string | null;
  children: ReactNode;
}

/** Dialog + <form> + Cancel/Submit footer: the shape of almost every create/edit screen. */
export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  submitLabel,
  submitting = false,
  onSubmit,
  error,
  children,
}: FormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {children}
          {error && (
            <p role="alert" className="rounded-md bg-danger/10 px-3 py-2 text-sm font-medium text-danger">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
