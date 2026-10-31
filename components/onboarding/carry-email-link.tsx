"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

/**
 * CarryEmailLink: a link between login modes (Forgot password?, Email me a sign-in link, Create your
 * aviary) that takes the address already typed with it, so the breeder never types it twice. The href
 * carries any address the server already knows; on tap, the live value of the email field wins.
 * Without JavaScript it is an ordinary link.
 */
export function CarryEmailLink({
  href,
  emailFieldId = "email",
  className,
  children
}: {
  href: string;
  emailFieldId?: string;
  className?: string;
  children: ReactNode;
}) {
  const router = useRouter();

  return (
    <Link
      href={href}
      prefetch={false}
      className={className}
      onClick={(event) => {
        const field = document.getElementById(emailFieldId) as HTMLInputElement | null;
        const typed = field?.value.trim() ?? "";
        if (!typed || event.metaKey || event.ctrlKey || event.shiftKey) return;
        event.preventDefault();
        const url = new URL(href, window.location.origin);
        url.searchParams.set("email", typed);
        router.push(`${url.pathname}?${url.searchParams}`);
      }}
    >
      {children}
    </Link>
  );
}
