"use client";

import { ReactNode, useCallback, useEffect, useSyncExternalStore } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/*
 * Pending state for a submit button that lives OUTSIDE its form (the sticky mobile save bar targets the form
 * through the HTML5 `form=` attribute). useFormStatus only reports the nearest parent form, so on its own that
 * button would never see the submission. FormPendingBridge, rendered inside the form, publishes the form's
 * pending state under the form id; SubmitButton form="…" subscribes to it.
 */
const pendingByForm = new Map<string, boolean>();
const listenersByForm = new Map<string, Set<() => void>>();

function publishPending(form: string, pending: boolean) {
  if ((pendingByForm.get(form) ?? false) === pending) return;
  pendingByForm.set(form, pending);
  listenersByForm.get(form)?.forEach((listener) => listener());
}

function useExternalFormPending(form?: string) {
  const subscribe = useCallback(
    (listener: () => void) => {
      if (!form) return () => {};
      const listeners = listenersByForm.get(form) ?? new Set<() => void>();
      listeners.add(listener);
      listenersByForm.set(form, listeners);
      return () => {
        listeners.delete(listener);
      };
    },
    [form]
  );
  const getSnapshot = useCallback(() => (form ? (pendingByForm.get(form) ?? false) : false), [form]);
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

/**
 * FormPendingBridge — render once inside a form whose submit button sits outside it (sticky save bar).
 */
export function FormPendingBridge({ form }: { form: string }) {
  const { pending } = useFormStatus();
  useEffect(() => {
    publishPending(form, pending);
    return () => {
      publishPending(form, false);
    };
  }, [form, pending]);
  return null;
}

/**
 * SubmitButton — form submit button with instant pending feedback.
 * Uses useFormStatus so the user sees a spinner the moment they click,
 * instead of a frozen page while the server action runs (Doherty threshold:
 * perceived responsiveness matters as much as actual latency).
 * Disabling while pending is also the double-submit guard: a second tap on a slow
 * connection must never create a second sale, payment or bird.
 */
export function SubmitButton({
  children,
  pendingText = "Please wait…",
  variant = "default",
  size = "default",
  className,
  disabled = false,
  form
}: {
  children: ReactNode;
  pendingText?: string;
  variant?: "default" | "secondary" | "outline" | "destructive" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  disabled?: boolean;
  /** Submit a form this button is not nested in (HTML5 `form=` attribute). Pair with FormPendingBridge. */
  form?: string;
}) {
  const status = useFormStatus();
  const externalPending = useExternalFormPending(form);
  const pending = status.pending || externalPending;

  return (
    <Button
      type="submit"
      form={form}
      variant={variant}
      size={size}
      disabled={disabled || pending}
      className={cn(className)}
      aria-busy={pending}
    >
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" /> {pendingText}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
