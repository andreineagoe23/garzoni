const CHUNK_ERROR_KEY = "monevo-chunk-reloaded";

export const initChunkRecovery = () => {
  if (typeof window === "undefined") return;

  const handleChunkError = (errorEvent: any) => {
    const { error, message, target } = errorEvent || {};

    const isLinkTag = target?.tagName === "LINK";
    const source = target?.href || target?.src;
    const chunkLikeSource =
      typeof source === "string" && /chunk\.(css|js)/.test(source);

    const isChunkError =
      error?.name === "ChunkLoadError" ||
      (typeof message === "string" && message.includes("ChunkLoadError")) ||
      (typeof message === "string" && message.includes("Loading CSS chunk")) ||
      (isLinkTag && chunkLikeSource);

    if (!isChunkError) return;

    const hasReloaded = sessionStorage.getItem(CHUNK_ERROR_KEY);
    if (hasReloaded) {
      sessionStorage.removeItem(CHUNK_ERROR_KEY);
      return;
    }

    const triggerReload = () => {
      sessionStorage.setItem(CHUNK_ERROR_KEY, "true");
      window.location.reload();
    };

    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      const handleOnlineOnce = () => {
        window.removeEventListener("online", handleOnlineOnce);
        triggerReload();
      };
      window.addEventListener("online", handleOnlineOnce);
      return;
    }

    triggerReload();
  };

  window.addEventListener("error", handleChunkError);
  window.addEventListener(
    "unhandledrejection",
    (event: PromiseRejectionEvent) => {
      const reason = event?.reason as
        | { name?: string; message?: string }
        | undefined;
      if (
        reason?.name === "ChunkLoadError" ||
        (typeof reason?.message === "string" &&
          reason.message.includes("ChunkLoadError"))
      ) {
        handleChunkError({ error: reason, message: reason?.message });
      }
    }
  );

  sessionStorage.removeItem(CHUNK_ERROR_KEY);
};
