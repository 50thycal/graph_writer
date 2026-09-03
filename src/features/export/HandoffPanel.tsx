import { useEffect, useState } from "react";
import { downloadHandoffFile, textFile, type HandoffBundle } from "./handoff";

interface HandoffPanelProps {
  bundle: HandoffBundle | null;
  error: string | null;
  onClose: () => void;
}

type Feedback = "ready" | "copied" | "shared" | "share-unavailable" | "error";

export function HandoffPanel({ bundle, error, onClose }: HandoffPanelProps) {
  const [feedback, setFeedback] = useState<Feedback>("ready");
  const shareNavigator = navigator as unknown as { share?: Navigator["share"]; canShare?: Navigator["canShare"] };

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  const files = bundle ? [
    new File([bundle.image], `${bundle.baseName}-design.png`, { type: "image/png" }),
    new File([bundle.json], `${bundle.baseName}-design.json`, { type: "application/json" }),
    new File([bundle.markdown], `${bundle.baseName}-handoff.md`, { type: "text/markdown" }),
  ] : [];

  const canShareFiles = Boolean(bundle && shareNavigator.share && (!shareNavigator.canShare || shareNavigator.canShare({ files })));

  const copyHandoff = async () => {
    if (!bundle) return;
    try {
      await navigator.clipboard.writeText(bundle.copyText);
      setFeedback("copied");
    } catch {
      setFeedback("error");
    }
  };

  const shareHandoff = async () => {
    if (!bundle || !canShareFiles) {
      setFeedback("share-unavailable");
      return;
    }
    try {
      // Supplying both `text` and a Markdown file makes iOS create a redundant
      // text.txt attachment. The brief already travels as the .md file.
      await shareNavigator.share?.({ title: `${bundle.document.name} design handoff`, files });
      setFeedback("shared");
    } catch (shareError) {
      if (shareError instanceof DOMException && shareError.name === "AbortError") return;
      setFeedback("error");
    }
  };

  return <aside className="handoff-panel" aria-label="Design handoff">
    <div className="inspector-heading">
      <div><p>AI-ready export</p><h2>Design handoff</h2></div>
      <button type="button" className="icon-button" aria-label="Close design handoff" onClick={onClose}>×</button>
    </div>
    {!bundle && !error ? <div className="handoff-loading" role="status"><span />Preparing screenshot and context…</div> : null}
    {error ? <div className="handoff-error" role="alert"><strong>Handoff failed</strong><span>{error}</span></div> : null}
    {bundle ? <>
      <div className="handoff-summary">
        <div><strong>{bundle.document.elements.length}</strong><span>objects</span></div>
        <div><strong>{bundle.document.connections.length}</strong><span>connections</span></div>
        <div><strong>{bundle.imageWidth}×{bundle.imageHeight}</strong><span>PNG</span></div>
      </div>
      <p className="handoff-explanation">The screenshot carries the visual layout. JSON carries exact coordinates, sizes, properties, hidden intent, and directed connections.</p>
      <button type="button" className="button primary handoff-copy" onClick={() => void copyHandoff()}>Copy AI handoff</button>
      <button type="button" className="button secondary handoff-share" disabled={!canShareFiles} onClick={() => void shareHandoff()}>Share all three files</button>
      <div className="handoff-downloads" aria-label="Download handoff files">
        <button type="button" onClick={() => downloadHandoffFile(bundle.image, `${bundle.baseName}-design.png`)}>PNG</button>
        <button type="button" onClick={() => downloadHandoffFile(textFile(bundle.json, "application/json"), `${bundle.baseName}-design.json`)}>JSON</button>
        <button type="button" onClick={() => downloadHandoffFile(textFile(bundle.markdown, "text/markdown"), `${bundle.baseName}-handoff.md`)}>Markdown</button>
      </div>
      <p className="handoff-feedback" aria-live="polite">{
        feedback === "copied" ? "Markdown and semantic JSON copied." :
          feedback === "shared" ? "Handoff shared." :
            feedback === "share-unavailable" ? "File sharing is not supported here; use the downloads instead." :
              feedback === "error" ? "That action failed. The individual downloads are still available." :
                "Ready to hand off."
      }</p>
      <details className="handoff-preview"><summary>Preview Markdown brief</summary><pre>{bundle.markdown}</pre></details>
    </> : null}
  </aside>;
}
