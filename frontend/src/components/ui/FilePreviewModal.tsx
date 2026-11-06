import { useEffect, useState } from "react";
import { Download, ExternalLink, FileText, LoaderCircle, X } from "lucide-react";
import { api, ApiError } from "../../services/api";
import ModalPortal from "./ModalPortal";
import "./file-preview.css";

type FilePreviewModalProps = {
  documentId: number;
  fileName: string;
  title?: string;
  onClose: () => void;
};

const typesByExtension: Record<string, string> = { pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg" };

/** Shows an uploaded PDF or image inside the page, with an optional download. */
export default function FilePreviewModal({ documentId, fileName, title, onClose }: FilePreviewModalProps) {
  const [file, setFile] = useState<{ url: string; type: string } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let url = "";
    let cancelled = false;
    setFile(null);
    setError("");
    api.documentFile(documentId).then((blob) => {
      if (cancelled) return;
      const extension = fileName.split(".").pop()?.toLowerCase() || "";
      const type = typesByExtension[extension] || blob.type;
      url = URL.createObjectURL(blob.type === type ? blob : new Blob([blob], { type }));
      setFile({ url, type });
    }).catch((reason) => {
      if (!cancelled) setError(reason instanceof ApiError ? reason.message : "The file could not be opened.");
    });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [documentId, fileName]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <ModalPortal>
      <div className="file-preview-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
        <section className="file-preview-modal" role="dialog" aria-modal="true" aria-labelledby="file-preview-title">
          <header className="file-preview-heading">
            <span className="file-preview-icon"><FileText size={16} /></span>
            <div className="file-preview-title">
              <h2 id="file-preview-title">{title || fileName}</h2>
              {title && <p>{fileName}</p>}
            </div>
            <div className="file-preview-actions">
              {file && (
                <>
                  <a href={file.url} target="_blank" rel="noreferrer" aria-label="Open in new tab" title="Open in new tab"><ExternalLink size={15} /></a>
                  <a href={file.url} download={fileName} aria-label="Download file" title="Download"><Download size={15} /></a>
                </>
              )}
              <button type="button" onClick={onClose} aria-label="Close preview" title="Close"><X size={17} /></button>
            </div>
          </header>
          <div className="file-preview-body">
            {error ? (
              <div className="file-preview-message"><strong>Preview unavailable</strong><span>{error}</span></div>
            ) : !file ? (
              <div className="file-preview-message"><LoaderCircle className="file-preview-spinner" size={22} /><span>Loading preview…</span></div>
            ) : file.type.startsWith("image/") ? (
              <img src={file.url} alt={fileName} />
            ) : file.type === "application/pdf" ? (
              <iframe src={file.url} title={fileName} />
            ) : (
              <div className="file-preview-message"><strong>No preview for this file type</strong><span>Use the download button to save it.</span></div>
            )}
          </div>
        </section>
      </div>
    </ModalPortal>
  );
}
