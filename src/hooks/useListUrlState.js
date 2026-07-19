import { useCallback, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  listParamKeys,
  readListUrlState,
  updateListUrlState,
} from "../lib/pagination";

export function useListUrlState({ prefix = "", defaultLimit = 10 } = {}) {
  const location = useLocation();
  const navigate = useNavigate();
  const state = useMemo(
    () => readListUrlState(location.search, { prefix, defaultLimit }),
    [defaultLimit, location.search, prefix],
  );

  const update = useCallback((changes, { replace = false } = {}) => {
    const params = updateListUrlState(location.search, changes, { prefix, defaultLimit });
    const search = params.toString();
    navigate({ search: search ? `?${search}` : "" }, { replace });
  }, [defaultLimit, location.search, navigate, prefix]);

  return {
    ...state,
    keys: listParamKeys(prefix),
    update,
    setPage: (page) => update({ page }),
    setLimit: (limit) => update({ limit }),
    // Search typing should not add a browser-history entry for every keystroke.
    setQuery: (q) => update({ q }, { replace: true }),
    setFilters: (filters) => update({ filters }),
  };
}
