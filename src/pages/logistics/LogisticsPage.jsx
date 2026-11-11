import { useCallback, useEffect, useRef, useState } from "react";
import { Search, Settings } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import AppLayout from "../../layouts/AppLayout";
import { useAuth } from "../../auth/AuthProvider";
import { ACTION_ACCESS } from "../../auth/roleAccess";
import PaginationControls from "../../components/ui/PaginationControls";
import { useListUrlState } from "../../hooks/useListUrlState";
import { usePaginatedResource } from "../../hooks/usePaginatedResource";
import { DEFAULT_LIMIT, PAGE_LIMITS } from "../../lib/pagination";
import { apiGet } from "../../lib/api";
import { peso, shortDate, statusClass } from "../../lib/format";
import { LogisticsNotice } from "./LogisticsStates";
import ExpandableTableRow from "../../components/ui/ExpandableTableRow";
import { TableSkeleton } from "../../components/ui/pageSkeletons";
import "./logistics.css";

const STATUS_TABS = [
  "All", "Order Created", "Picked Up", "Arrived at Branch", "Departed Branch",
  "Out for Delivery", "Delivery Failed", "Out for Return", "Delivered", "Returned", "Cancelled",
];

const COURIER_LOAD_CACHE_KEY = "linko.logistics.courier-load.v1";

function readCourierLoadCache() {
  try {
    if (typeof window === "undefined") return {};
    const parsed = JSON.parse(window.sessionStorage.getItem(COURIER_LOAD_CACHE_KEY) ?? "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};

    return Object.entries(parsed).reduce((cache, [key, value]) => {
      const courierId = Number(key);
      const activeParcelCount = Number(value?.active_parcel_count);
      if (
        !Number.isSafeInteger(courierId) || courierId < 1 || String(courierId) !== key
        || !value || typeof value !== "object" || Array.isArray(value)
        || Number(value.courier_id) !== courierId
        || typeof value.full_name !== "string" || !value.full_name.trim()
        || !Number.isSafeInteger(activeParcelCount) || activeParcelCount < 0
      ) return cache;

      const page = Number.isSafeInteger(value.page) && value.page > 0 ? value.page : 1;
      const limit = PAGE_LIMITS.includes(value.limit) ? value.limit : DEFAULT_LIMIT;
      cache[key] = { courier_id: courierId, full_name: value.full_name, active_parcel_count: activeParcelCount, page, limit };
      return cache;
    }, {});
  } catch {
    return {};
  }
}

function writeCourierLoadCache(cache) {
  try {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(COURIER_LOAD_CACHE_KEY, JSON.stringify(cache));
    }
  } catch {
    // Storage can be disabled or full; the in-memory selection still works.
  }
}

function useParcelPage(path) {
  const [reloadVersion, setReloadVersion] = useState(0);
  const [state, setState] = useState({ data: null, error: null, key: null });
  const key = `${path}:${reloadVersion}`;

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    apiGet(path, { signal: controller.signal })
      .then((data) => active && setState({ data, error: null, key }))
      .catch((error) => {
        if (active && error?.name !== "AbortError") {
          setState((previous) => ({ data: previous.data, error, key }));
        }
      });
    return () => { active = false; controller.abort(); };
  }, [key, path]);

  const current = state.key === key;
  return {
    data: current ? state.data : null,
    staleData: state.data,
    error: current ? state.error : null,
    loading: !current,
    reload: useCallback(() => setReloadVersion((version) => version + 1), []),
  };
}

export default function LogisticsPage() {
  const { hasAnyRole } = useAuth();
  const location = useLocation();
  const list = useListUrlState();
  const searchParams = new URLSearchParams(location.search);
  const statusFilter = searchParams.get("status") || "All";
  const requestedAssignment = searchParams.get("assignment");
  const assignmentFilter = ["available", "active", "completed"].includes(requestedAssignment) ? requestedAssignment : "";
  const agingFilter = searchParams.get("aging") === "true";
  const courierIdFilter = searchParams.get("courier_id") || "";
  const [courierCache, setCourierCache] = useState(readCourierLoadCache);
  const initialCachedCourier = courierCache[courierIdFilter];
  const query = new URLSearchParams({ page: String(list.page), limit: String(list.limit) });
  if (list.q) query.set("q", list.q);
  if (statusFilter !== "All") query.set("status", statusFilter);
  if (assignmentFilter) query.set("assignment", assignmentFilter);
  if (agingFilter) query.set("aging", "true");
  if (courierIdFilter) query.set("courier_id", courierIdFilter);
  const resource = useParcelPage(`/api/parcels?${query.toString()}`);
  const canAssign = hasAnyRole(ACTION_ACCESS.assignParcel);
  const [decisionState, setDecisionState] = useState({ unassignedCount: null, agingCount: null, error: null, loading: true });
  const [decisionReload, setDecisionReload] = useState(0);
  const [courierPage, setCourierPage] = useState(() => initialCachedCourier?.page ?? 1);
  const [courierLimit, setCourierLimit] = useState(() => initialCachedCourier?.limit ?? DEFAULT_LIMIT);
  const [courierLoadOpen, setCourierLoadOpen] = useState(false);
  const [selectedCourierId, setSelectedCourierId] = useState(courierIdFilter);
  const courierQuery = new URLSearchParams({ page: String(courierPage), limit: String(courierLimit) });
  const courierResource = usePaginatedResource(`/api/couriers?${courierQuery.toString()}`, { enabled: canAssign && courierLoadOpen });
  const searchTimerRef = useRef(null);
  const statusFilterDetailsRef = useRef(null);
  const hasParcelFilters = Boolean(list.q || statusFilter !== "All" || assignmentFilter || agingFilter || courierIdFilter);
  const selectedCourierFromPage = courierResource.items.find((courier) => String(courier.courier_id) === selectedCourierId);
  const selectedCourier = selectedCourierFromPage ?? courierCache[selectedCourierId] ?? null;
  const activeCourierFromPage = courierResource.items.find((courier) => String(courier.courier_id) === courierIdFilter);
  const activeCourier = activeCourierFromPage ?? courierCache[courierIdFilter] ?? null;
  const previousCourierFilter = useRef(courierIdFilter);

  useEffect(() => {
    setSelectedCourierId(courierIdFilter);
  }, [courierIdFilter]);

  useEffect(() => {
    if (previousCourierFilter.current !== courierIdFilter) {
      previousCourierFilter.current = courierIdFilter;
      const cachedCourier = courierCache[courierIdFilter];
      setCourierPage(cachedCourier?.page ?? 1);
      setCourierLimit(cachedCourier?.limit ?? DEFAULT_LIMIT);
    }
  }, [courierIdFilter, courierCache]);

  useEffect(() => {
    const returnedCouriers = [selectedCourierFromPage, activeCourierFromPage].filter(Boolean);
    if (returnedCouriers.length === 0) return;

    setCourierCache((previous) => {
      let changed = false;
      const next = { ...previous };
      for (const courier of returnedCouriers) {
        const key = String(courier.courier_id);
        const record = {
          courier_id: courier.courier_id,
          full_name: courier.full_name,
          active_parcel_count: courier.active_parcel_count,
          page: courierPage,
          limit: courierLimit,
        };
        const existing = previous[key];
        if (
          !existing
          || existing.full_name !== record.full_name
          || existing.active_parcel_count !== record.active_parcel_count
          || existing.page !== record.page
          || existing.limit !== record.limit
        ) {
          next[key] = record;
          changed = true;
        }
      }
      return changed ? next : previous;
    });
  }, [selectedCourierFromPage, activeCourierFromPage, courierPage, courierLimit]);

  useEffect(() => {
    writeCourierLoadCache(courierCache);
  }, [courierCache]);

  useEffect(() => {
    if (!canAssign) return undefined;

    const controller = new AbortController();
    apiGet("/api/logistics/decisions", { signal: controller.signal })
      .then((data) => setDecisionState({
        unassignedCount: data.unassignedParcels ?? 0,
        agingCount: data.agingPendingParcels ?? 0,
        error: null,
        loading: false,
      }))
      .catch((error) => {
        if (error?.name !== "AbortError") {
          setDecisionState((previous) => ({ ...previous, error, loading: false }));
        }
      });

    return () => controller.abort();
  }, [canAssign, decisionReload]);
  const pageData = resource.loading || resource.error ? null : resource.data ?? resource.staleData;
  const parcels = pageData?.items ?? null;
  const pagination = pageData?.pagination ?? null;

  useEffect(() => {
    return () => window.clearTimeout(searchTimerRef.current);
  }, []);

  useEffect(() => {
    const totalPages = resource.data?.pagination?.total_pages ?? 0;
    if (totalPages > 0 && list.page > totalPages) {
      list.update({ page: totalPages }, { replace: true });
    }
  }, [list, resource.data]);

  function queueSearch(nextQuery) {
    window.clearTimeout(searchTimerRef.current);
    searchTimerRef.current = window.setTimeout(() => list.setQuery(nextQuery), 300);
  }

  return (
    <AppLayout>
      <div className="logistics-page parcel-list-page">
        <div className="page-head">
          <div>
            <h1>Logistics</h1>

          </div>
          {canAssign && (
            <Link className="book-parcel-btn" to="/logistics/management">
              <Settings size={16} aria-hidden="true" /> Manage logistics
            </Link>
          )}
        </div>
        {canAssign && (
          <section className="logistics-summary-area" aria-label="Time-sensitive parcel workloads" aria-busy={decisionState.loading}>
            <div className="logistics-summary-grid">
              <article className={`logistics-summary-card unassigned-summary${decisionState.unassignedCount > 0 ? " is-urgent" : ""}`}>
                <div className="logistics-summary-copy">
                  <h2>Unassigned parcels</h2>
                  <p>
                    <strong className="logistics-summary-count">
                      {decisionState.unassignedCount ?? (decisionState.loading ? "Loading…" : "Unavailable")}
                    </strong>
                    {decisionState.unassignedCount === 0
                      ? " No parcels waiting for a courier."
                      : decisionState.unassignedCount !== null
                        ? " parcels need a courier."
                        : ""}
                  </p>
                </div>
                <Link className="logistics-summary-action" to="/logistics?assignment=available">
                  View unassigned parcels
                </Link>
              </article>

              <article className={`logistics-summary-card aging-summary${decisionState.agingCount > 0 ? " is-urgent" : ""}`}>
                <div className="logistics-summary-copy">
                  <h2>Aging pending parcels</h2>
                  <p>
                    <strong className="logistics-summary-count">
                      {decisionState.agingCount ?? (decisionState.loading ? "Loading…" : "Unavailable")}
                    </strong>
                    {decisionState.agingCount === 0
                      ? " No parcels have been pending for more than two days."
                      : decisionState.agingCount !== null
                        ? " parcels have been pending for more than two days."
                        : ""}
                  </p>
                </div>
                <Link className="logistics-summary-action" to="/logistics?status=Order%20Created&aging=true">
                  View aging parcels
                </Link>
              </article>

              <section className="logistics-summary-card courier-load-card" aria-busy={courierLoadOpen && courierResource.loading}>
                <details
                  className="courier-load-disclosure"
                  onToggle={(event) => setCourierLoadOpen(event.currentTarget.open)}
                >
                  <summary className="courier-load-summary">
                    <span>
                      <strong>Active courier load</strong>
                      <small>
                        {selectedCourier
                          ? `${selectedCourier.full_name} · ${selectedCourier.active_parcel_count} active ${selectedCourier.active_parcel_count === 1 ? "parcel" : "parcels"}`
                          : "Choose a courier to review their parcels"}
                      </small>
                    </span>
                  </summary>
                  <div className="courier-load-content">
                    {courierResource.loading && courierResource.items.length === 0 ? (
                      <p className="courier-load-state" role="status">Loading courier loads…</p>
                    ) : courierResource.error ? (
                      <p className="courier-load-state courier-load-error" role="alert">
                        Could not load couriers. <button type="button" onClick={courierResource.reload}>Retry</button>
                      </p>
                    ) : courierResource.items.length === 0 ? (
                      <p className="courier-load-state">No active couriers found.</p>
                    ) : (
                      <>
                        <label className="courier-load-select-label" htmlFor="active-courier-select">Courier</label>
                        <div className="courier-load-selection">
                          <select
                            id="active-courier-select"
                            value={selectedCourierFromPage ? selectedCourierId : ""}
                            onChange={(event) => {
                              const courierId = event.target.value;
                              const courier = courierResource.items.find((item) => String(item.courier_id) === courierId);
                              setSelectedCourierId(courierId);
                              if (courier) {
                                const key = String(courier.courier_id);
                                setCourierCache((previous) => ({
                                  ...previous,
                                  [key]: { ...courier, page: courierPage, limit: courierLimit },
                                }));
                              }
                            }}
                          >
                            <option value="">Choose a courier</option>
                            {courierResource.items.map((courier) => (
                              <option key={courier.courier_id} value={String(courier.courier_id)}>
                                {courier.full_name}
                              </option>
                            ))}
                          </select>
                          {selectedCourier ? (
                            <div className="courier-load-selected" aria-live="polite">
                              <span>
                                <strong>{selectedCourier.active_parcel_count}</strong> active {selectedCourier.active_parcel_count === 1 ? "parcel" : "parcels"}
                              </span>
                              <Link to={`/logistics?assignment=active&courier_id=${selectedCourier.courier_id}`}>
                                View parcels
                              </Link>
                            </div>
                          ) : (
                            <p className="courier-load-state">Select a courier to see their active parcel count.</p>
                          )}
                        </div>
                        <PaginationControls
                          pagination={courierResource.pagination}
                          disabled={courierResource.loading}
                          onPageChange={setCourierPage}
                          onLimitChange={(limit) => { setCourierLimit(limit); setCourierPage(1); }}
                          ariaLabel="Active courier load pagination"
                        />
                      </>
                    )}
                  </div>
                </details>
              </section>
            </div>
            {decisionState.error && (
              <p className="logistics-summary-error" role="alert">
                Could not load workload counts. <button type="button" onClick={() => {
                  setDecisionState((previous) => ({ ...previous, error: null, loading: true }));
                  setDecisionReload((version) => version + 1);
                }}>Retry</button>
              </p>
            )}
          </section>
        )}

        <div className="parcel-list-toolbar">
          <form
            className="search-bar"
            role="search"
            aria-label="Search parcels"
            onSubmit={(event) => {
              event.preventDefault();
              window.clearTimeout(searchTimerRef.current);
              list.setQuery(String(new FormData(event.currentTarget).get("q") ?? ""));
            }}
          >
            <input
              type="search"
              name="q"
              aria-label="Parcel number, sender, or receiver"
              placeholder="Search parcel number, sender, or receiver"
              key={list.q}
              defaultValue={list.q}
              onChange={(event) => queueSearch(event.target.value)}
            />
            <button className="search-icon-btn" type="submit" aria-label="Search parcels">
              <Search size={16} aria-hidden="true" />
            </button>
          </form>
          <div className="parcel-status-filter">
            <span>Status</span>
            <details className="parcel-status-picker" ref={statusFilterDetailsRef}>
              <summary aria-label={`Status filter: ${statusFilter === "All" ? "All statuses" : statusFilter}`}>
                <span>
                  {statusFilter === "All" ? "All statuses" : statusFilter}
                </span>
              </summary>
              <div className="parcel-status-options" role="group" aria-label="Choose parcel status">
                {STATUS_TABS.map((status) => (
                  <button
                    key={status}
                    type="button"
                    className="parcel-status-option"
                    aria-pressed={statusFilter === status}
                    onClick={() => {
                      list.setFilters({
                        status: status === "All" ? "" : status,
                        aging: status === "Order Created" && agingFilter ? "true" : "",
                      });
                      if (statusFilterDetailsRef.current) statusFilterDetailsRef.current.open = false;
                    }}
                  >
                    <span>
                      {status === "All" ? "All statuses" : status}
                    </span>
                  </button>
                ))}
              </div>
            </details>
          </div>
          {hasParcelFilters && (
            <button
              className="clear-list-filters"
              type="button"
              onClick={() => {
                window.clearTimeout(searchTimerRef.current);
                list.update({ q: "", filters: { status: "", assignment: "", aging: "", courier_id: "" } });
              }}
            >
              Clear filters
            </button>
          )}
        </div>
        {(assignmentFilter || agingFilter || courierIdFilter) && (
          <div className="parcel-active-filters" aria-label="Active parcel filters">
            {assignmentFilter && (
              <span className="parcel-active-filter">
                Assignment: <strong>{assignmentFilter === "available" ? "Unassigned parcels" : assignmentFilter === "active" ? "Active parcels" : "Completed parcels"}</strong>
              </span>
            )}
            {agingFilter && (
              <span className="parcel-active-filter">
                Age: <strong>Order Created over 2 days</strong>
              </span>
            )}
            {courierIdFilter && (
              <span className="parcel-active-filter">
                Courier: <strong>{activeCourier?.full_name ?? `Courier #${courierIdFilter}`}</strong>
              </span>
            )}
          </div>
        )}

        <section className="table-card" aria-label="Parcel results" aria-busy={resource.loading}>
          {parcels === null && resource.loading ? (
            <TableSkeleton columns={4} rows={8} label="Loading parcels" />
          ) : resource.error && !parcels?.length ? (
            <LogisticsNotice
              message="Could not load parcels."
              onRetry={resource.reload}
            />
          ) : (parcels?.length ?? 0) === 0 ? (
            <LogisticsNotice
              message={hasParcelFilters ? "No parcels match these filters." : "No parcels are visible for this account yet."}
            />
          ) : (
            <>
              {resource.error && (
                <LogisticsNotice
                  message="Could not refresh parcels. Showing previous results."
                  onRetry={resource.reload}
                />
              )}
              <div className="parcel-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th scope="col">Parcel</th>
                      <th scope="col">Route</th>
                      <th scope="col" className="table-status">Status</th>
                      <th scope="col">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parcels.map((parcel) => {

                      return (
                        <ExpandableTableRow
                          key={parcel.parcel_id}
                          label={parcel.parcel_id}
                          cells={[
                            {
                              key: "parcel",
                              className: "parcel-identity",
                              content: <>{parcel.parcel_id}<small><span className="sr-only">Estimated delivery </span>{shortDate(parcel.estimated_delivery_date)}</small></>,
                            },
                            {
                              key: "route",
                              className: "parcel-list-route",
                              content: <>
                                <span><small>From</small> {parcel.sender.business_name}</span>
                                <span><small>To</small> {parcel.receiver.business_name}</span>
                              </>,
                            },
                            { key: "status", className: "parcel-progress", content: <span className={`status ${statusClass(parcel.current_status)}`}>{parcel.current_status ?? "-"}</span> },
                            {
                              key: "actions",
                              className: "parcel-actions",
                              content: <>
                                <Link className="track-link" to={`/logistics/${parcel.parcel_id}`}>{canAssign ? "Open parcel" : "Track parcel"}</Link>
                                {canAssign && <small>{parcel.latest_courier_id ? "Courier assigned" : "Unassigned"}</small>}
                              </>,
                            },
                          ]}
                        >
                          <dl>
                            <div><dt>Service</dt><dd>{parcel.tier_name ?? "-"}</dd></div>
                            <div><dt>Weight</dt><dd>{parcel.weight_kg == null ? "-" : `${parcel.weight_kg} kg`}</dd></div>
                            <div><dt>Fee</dt><dd>{peso(parcel.shipping_fee)}</dd></div>
                          </dl>
                        </ExpandableTableRow>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <PaginationControls pagination={pagination} disabled={resource.loading} onPageChange={list.setPage} onLimitChange={list.setLimit} ariaLabel="Parcels pagination" />
            </>
          )}
        </section>
      </div>
    </AppLayout>
  );
}
