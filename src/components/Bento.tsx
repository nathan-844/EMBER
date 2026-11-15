import { useEffect, useRef, useState, type ReactNode } from "react";

type TileProps = {
  id: string;
  eyebrow: string;
  title: string;
  size?: "1x1" | "2x1" | "2x2";
  tone?: "answer" | "warn";
  onOpen: () => void;
  children: ReactNode;
};

/**
 * One box on the dashboard: a glanceable summary. The title is a real button whose hit area
 * stretches over the whole tile, so the tile is one keyboard stop and opens the detail dialog.
 * Tile bodies must not contain their own links or buttons.
 */
export function Tile({ id, eyebrow, title, size = "1x1", tone, onOpen, children }: TileProps) {
  return (
    <article className={`tile tile-${size}${tone ? ` tile-${tone}` : ""}`} aria-labelledby={`${id}-tile`}>
      <p className="tile-eyebrow">{eyebrow}</p>
      <h3 className="tile-title" id={`${id}-tile`}>
        <button type="button" className="tile-btn" onClick={onOpen} aria-haspopup="dialog">{title}</button>
      </h3>
      <div className="tile-body">{children}</div>
      <span className="tile-more" aria-hidden>Open details</span>
    </article>
  );
}

type DialogProps = { open: boolean; title: string; lede?: string; onClose: () => void; children: ReactNode };

/**
 * The larger view behind a tile. Children mount the first time it opens and then stay
 * mounted, so state inside (an AI result, an expanded row, a chosen table) survives closing.
 */
export function TileDialog({ open, title, lede, onClose, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const [mounted, setMounted] = useState(open);
  const titleId = useRef(`dlg-${Math.random().toString(36).slice(2, 8)}`).current;

  useEffect(() => {
    const d = ref.current;
    if (open) setMounted(true);
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="tile-dialog"
      aria-labelledby={titleId}
      onClose={onClose}
      // A click on the dialog element itself (not its content) is a click on the backdrop.
      onClick={(e) => { if (e.target === ref.current) ref.current.close(); }}
    >
      <div className="tile-dialog-inner">
        <header className="tile-dialog-head">
          <div>
            <h2 id={titleId}>{title}</h2>
            {lede && <p className="tile-dialog-lede">{lede}</p>}
          </div>
          <button type="button" className="icon-btn tile-close" onClick={() => ref.current?.close()} aria-label="Close">✕</button>
        </header>
        <div className="tile-dialog-body">{mounted && children}</div>
      </div>
    </dialog>
  );
}
