import { useEffect, useRef, useState } from "react";
import { downloadText } from "../lib/brief";

type Props = { text: string; filename: string; onClose: () => void };

/** Shows the evidence brief with copy and download actions. Copy works where downloads are blocked. */
export function BriefDialog({ text, filename, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const [status, setStatus] = useState("");

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setStatus("Copied to clipboard");
    } catch {
      area.current?.select();
      setStatus("Text selected. Press Ctrl+C or ⌘C to copy.");
    }
  };

  return (
    <dialog ref={ref} className="brief-dialog" onClose={onClose} aria-labelledby="brief-title">
      <div className="brief-head">
        <h3 id="brief-title">Evidence brief (Markdown)</h3>
        <div className="brief-actions">
          <button className="btn btn-primary" onClick={copy}>Copy brief</button>
          <button className="btn" onClick={() => downloadText(filename, text)}>Download .md</button>
          <button className="btn" onClick={() => ref.current?.close()}>Close</button>
        </div>
      </div>
      <textarea id="brief-text" ref={area} readOnly value={text} aria-label="Evidence brief text" />
      <p className="brief-note small muted" role="status">{status || "Some browsers and embedded views block downloads; copying always works."}</p>
    </dialog>
  );
}
