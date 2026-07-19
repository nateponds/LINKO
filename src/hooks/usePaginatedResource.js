import { useCallback, useEffect, useRef, useState } from "react";
import { apiGet } from "../lib/api";

export function usePaginatedResource(path, { enabled = Boolean(path), request = apiGet } = {}) {
  const [reloadVersion, setReloadVersion] = useState(0);
  const [state, setState] = useState({ data: null, error: null, key: null });
  const latestRequest = useRef(0);
  const requestKey = `${path ?? ""}:${reloadVersion}`;

  useEffect(() => {
    const requestId = ++latestRequest.current;
    if (!enabled) {
      return undefined;
    }

    const controller = new AbortController();
    request(path, { signal: controller.signal })
      .then((data) => {
        if (latestRequest.current === requestId) {
          setState({ data, error: null, key: requestKey });
        }
      })
      .catch((error) => {
        if (error?.name !== "AbortError" && latestRequest.current === requestId) {
          setState({ data: null, error, key: requestKey });
        }
      });

    return () => controller.abort();
  }, [enabled, path, request, requestKey]);

  const isCurrent = enabled && state.key === requestKey;
  const data = isCurrent ? state.data : null;

  return {
    ...state,
    data,
    error: isCurrent ? state.error : null,
    loading: enabled && !isCurrent,
    items: data?.items ?? [],
    pagination: data?.pagination ?? null,
    reload: useCallback(() => setReloadVersion((version) => version + 1), []),
  };
}
