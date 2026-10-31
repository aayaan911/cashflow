import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The message a server action sends back through the URL (?message=&tone=), as the banner the
 * customer forms use: an alert when it is an error, a quiet green note otherwise. Renders nothing
 * without a message, so a page can pass a message it has already shown next to a field as undefined.
 */
export function FormMessage({ message, tone }: { message?: string; tone?: string }) {
  if (!message) return null;
  const isError = tone === "error";
  return (
    <div
      role={isError ? "alert" : undefined}
      className={cn(
        "flex items-start gap-2 rounded-xl border p-3.5 text-[13px]",
        isError
          ? "border-[hsl(var(--destructive))]/30 bg-[hsl(var(--destructive-soft))]/40 text-[hsl(var(--destructive))]"
          : "border-[hsl(var(--primary))]/30 bg-[hsl(var(--primary-soft))]/40 text-[hsl(var(--primary-dark))]"
      )}
    >
      <Info className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

/** The same message, placed under the field it is about. Pair with aria-invalid and aria-describedby on the control. */
export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="text-[12px] font-medium text-[hsl(var(--destructive))]">
      {message}
    </p>
  );
}
