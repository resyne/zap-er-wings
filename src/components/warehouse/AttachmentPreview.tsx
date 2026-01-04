import { useEffect, useMemo, useState } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import { pdfFirstPageToPngBlob } from "@/lib/pdfFirstPageToPng";
import { cn } from "@/lib/utils";

interface AttachmentPreviewProps {
  url: string;
  alt: string;
  className?: string;
}

type PreviewState =
  | { status: "loading" }
  | { status: "ready"; objectUrl: string }
  | { status: "error"; message: string };

function isPdfUrl(url: string) {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    return pathname.endsWith(".pdf");
  } catch {
    return url.toLowerCase().includes(".pdf");
  }
}

function fileNameFromUrl(url: string) {
  try {
    const pathname = new URL(url).pathname;
    const last = pathname.split("/").filter(Boolean).pop();
    return last || "documento";
  } catch {
    return "documento";
  }
}

export function AttachmentPreview({ url, alt, className }: AttachmentPreviewProps) {
  const [state, setState] = useState<PreviewState>({ status: "loading" });

  const isPdf = useMemo(() => isPdfUrl(url), [url]);

  useEffect(() => {
    let cancelled = false;
    let objectUrlToRevoke: string | null = null;

    async function run() {
      setState({ status: "loading" });
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const blob = await res.blob();

        if (cancelled) return;

        if (isPdf) {
          const name = fileNameFromUrl(url);
          const file = new File([blob], name.endsWith(".pdf") ? name : `${name}.pdf`, {
            type: blob.type || "application/pdf",
          });
          const pngBlob = await pdfFirstPageToPngBlob(file, { maxWidth: 1600, maxScale: 2 });
          if (cancelled) return;
          objectUrlToRevoke = URL.createObjectURL(pngBlob);
          setState({ status: "ready", objectUrl: objectUrlToRevoke });
          return;
        }

        objectUrlToRevoke = URL.createObjectURL(blob);
        setState({ status: "ready", objectUrl: objectUrlToRevoke });
      } catch (e) {
        const message =
          e instanceof Error
            ? e.message
            : "Impossibile caricare l'allegato";

        if (!cancelled) {
          setState({
            status: "error",
            message: `Anteprima non disponibile (${message}). Se usi AdBlock/estensioni privacy, prova a disattivarle o a mettere in whitelist *.supabase.co.`,
          });
        }
      }
    }

    run();

    return () => {
      cancelled = true;
      if (objectUrlToRevoke) URL.revokeObjectURL(objectUrlToRevoke);
    };
  }, [url, isPdf]);

  if (state.status === "loading") {
    return (
      <div className={cn("w-full h-full flex items-center justify-center", className)}>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className={cn("w-full h-full flex items-center justify-center p-6", className)}>
        <div className="max-w-md text-center space-y-3">
          <div className="mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center">
            <AlertCircle className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">{state.message}</p>
        </div>
      </div>
    );
  }

  return (
    <img
      src={state.objectUrl}
      alt={alt}
      className={cn("w-full h-full object-contain", className)}
      loading="lazy"
    />
  );
}
