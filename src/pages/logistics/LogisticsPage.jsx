import { useCallback, useEffect, useRef, useState } from "react";
import { Search, Settings } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import AppLayout from "../../layouts/AppLayout";
import { useAuth } from "../../auth/AuthProvider";
import PaginationControls from "../../components/ui/PaginationControls";
import { useListUrlState } from "../../hooks/useListUrlState";
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
  const statusFilter = new URLSearchParams(location.search).get("status") || "All";
  const query = new URLSearchParams({ page: String(list.page), limit: String(list.limit) });
  if (list.q) query.set("q", list.q);
  if (statusFilter !== "All") query.set("status", statusFilter);
  const resource = useParcelPage(`/api/parcels?${query.toString()}`);
  const canAssign = hasAnyRole(["logistics_coordinator", "platform_admin"]);
  const searchTimerRef = useRef(null);
  const pageData = resource.data ?? resource.staleData;
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
          <label className="parcel-status-filter">
            <span>Status</span>
            <select value={statusFilter} onChange={(event) => {
              const status = event.target.value;
              list.setFilters({ status: status === "All" ? "" : status });
            }}>
              {!STATUS_TABS.includes(statusFilter) && <option>{statusFilter}</option>}
              {STATUS_TABS.map((status) => (
                <option key={status} value={status}>{status === "All" ? "All statuses" : status}</option>
              ))}
            </select>
          </label>
        </div>

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
              message={list.q || statusFilter !== "All" ? "No parcels match these filters." : "No parcels are visible for this account yet."}
              onRetry={list.q || statusFilter !== "All" ? () => list.update({ q: "", filters: { status: "" } }) : undefined}
              retryLabel="Clear filters"
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
                            { key: "status", className: "parcel-progress", content: <span className={`status ${statusClass(parcel.current_status)}`}>{parcel.current_status ?? "—"}</span> },
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
                            <div><dt>Service</dt><dd>{parcel.tier_name ?? "—"}</dd></div>
                            <div><dt>Weight</dt><dd>{parcel.weight_kg == null ? "—" : `${parcel.weight_kg} kg`}</dd></div>
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
