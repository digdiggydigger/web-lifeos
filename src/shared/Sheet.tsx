import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

interface SheetProps {
  readonly open: boolean;
  readonly title: string;
  readonly onClose: () => void;
  readonly children: ReactNode;
  /** Header trailing control (a Save button, say). */
  readonly trailing?: ReactNode;
}

/** A native dialog: bottom sheet on phone widths, centred on desktop. Escape and the Close button both dismiss. */
export function Sheet({ open, title, onClose, children, trailing }: SheetProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-sheet-title`;

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      onClose={onClose}
      className="fixed inset-x-0 bottom-0 m-0 w-full max-w-none rounded-t-card bg-card-surface p-0 text-label-primary backdrop:bg-scrim md:inset-0 md:m-auto md:max-w-md md:rounded-card"
    >
      {open ? (
        <div className="flex flex-col gap-4 p-4">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="min-h-11 text-sm font-medium text-accent"
            >
              Close
            </button>
            <h2 id={titleId} className="text-base font-bold">
              {title}
            </h2>
            {trailing ?? <span aria-hidden="true" className="w-11" />}
          </div>
          {children}
        </div>
      ) : null}
    </dialog>
  );
}

interface ConfirmProps {
  readonly open: boolean;
  readonly title: string;
  readonly message: string;
  readonly confirmLabel: string;
  readonly destructive?: boolean;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

/** The iOS alert: a title, a message, Cancel and one confirming action. */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmProps) {
  return (
    <Sheet open={open} title={title} onClose={onCancel}>
      <p role="alertdialog" aria-label={title} className="text-sm text-label-secondary">
        {message}
      </p>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="spring min-h-11 rounded-card border border-card-border px-4 text-sm font-medium"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className={`spring min-h-11 rounded-card px-4 text-sm font-semibold ${destructive ? 'bg-state-risk text-on-state-warn' : 'bg-accent text-on-area-work'}`}
        >
          {confirmLabel}
        </button>
      </div>
    </Sheet>
  );
}
