"use client";
import { ReactNode, useEffect } from "react";
import { X } from "lucide-react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}

export default function Modal({ open, onClose, title, children, footer, wide }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] grid place-items-center p-5 animate-fade"
      style={{
        background: "rgba(4,6,9,0.62)",
        backdropFilter: "blur(6px)",
      }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="w-full bg-surface border border-border-strong rounded-xl shadow-card-lg animate-modal-in max-h-[90vh] overflow-auto"
        style={{ maxWidth: wide ? 680 : 560 }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex items-center justify-between px-[22px] py-[18px] border-b border-border">
          <h3 className="font-display font-semibold text-h3">{title}</h3>
          <button
            aria-label="Close"
            onClick={onClose}
            className="p-2 rounded-md bg-transparent text-muted hover:text-text hover:bg-surface-2 transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-[22px]">{children}</div>
        {footer && (
          <div className="flex items-center justify-between px-[22px] py-4 border-t border-border gap-2.5">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
