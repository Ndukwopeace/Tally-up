/**
 * Profile icon in the header that opens "Profile / My Account" and "Sign Out".
 *
 * WHY:  Q-47: the owner placed the account actions behind a profile icon at the
 *       top of the admin screens, next to the notifications bell.
 * HOW:  A disclosure: a button with aria-expanded/aria-controls that shows a
 *       small panel with two items. The panel closes when an item is chosen,
 *       on Escape (focus returns to the button), or on a tap outside it.
 *       A disclosure is used instead of an ARIA "menu" because it needs no
 *       arrow-key handling and screen readers read it as plain links/buttons.
 * WHEN: Admin header (all admin pages).
 * SECURITY: Until login exists (Milestone 2), Sign Out only returns to the start
 *       page. Milestone 2 makes it end the Supabase session before leaving.
 */
import { CircleUser, LogOut, UserRound } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";

import { en } from "@/i18n/en";

export interface AccountMenuProps {
  profileHref: string;
  signOutHref: string;
}

export function AccountMenu({ profileHref, signOutHref }: Readonly<AccountMenuProps>) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const navigate = useNavigate();

  // While open: close on Escape (and give focus back) or on a tap outside the menu.
  useEffect(() => {
    if (!open) {
      return undefined;
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  const itemClass =
    "flex min-h-12 w-full items-center gap-3 rounded-control px-3 text-left text-base font-medium text-ink hover:bg-canvas";

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-label={en.nav.account}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          setOpen((value) => !value);
        }}
        className="inline-flex size-12 items-center justify-center rounded-full text-ink hover:bg-canvas"
      >
        <CircleUser aria-hidden="true" className="size-6" />
      </button>
      {open ? (
        <div
          id={panelId}
          className="absolute right-0 top-full z-40 mt-1 w-60 rounded-card border border-line bg-surface p-1.5 shadow-lg"
        >
          <Link
            to={profileHref}
            className={itemClass}
            onClick={() => {
              setOpen(false);
            }}
          >
            <UserRound aria-hidden="true" className="size-5 text-ink-muted" />
            {en.nav.profileAccount}
          </Link>
          <button
            type="button"
            className={itemClass}
            onClick={() => {
              setOpen(false);
              void navigate(signOutHref);
            }}
          >
            <LogOut aria-hidden="true" className="size-5 text-ink-muted" />
            {en.nav.signOut}
          </button>
        </div>
      ) : null}
    </div>
  );
}
