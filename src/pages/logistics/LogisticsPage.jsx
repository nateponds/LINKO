import { useCallback, useEffect, useRef, useState } from "react";
import { Search, PackagePlus } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import AppLayout from "../../layouts/AppLayout";
import { useAuth } from "../../auth/AuthProvider";
import PaginationControls from "../../components/ui/PaginationControls";
import { useListUrlState } from "../../hooks/useListUrlState";
import { apiGet } from "../../lib/api";
import { peso, shortDate, statusClass } from "../../lib/format";
import { LogisticsNotice, LogisticsPlaceholder } from "./LogisticsStates";
import { formatNextStatuses, nextStatusesForRole } from "./workflowHints";
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
      <div className="logistics-page">
        <div className="page-head">
          <h1>Logistics</h1>
          <div className="logistics-head-actions">
            <div className="search-bar">
              <input
                type="search"
                placeholder="Search parcel no., sender, receiver"
                key={list.q}
                defaultValue={list.q}
                onChange={(event) => queueSearch(event.target.value)}
              />
              <button className="search-icon-btn" type="button" aria-label="Search parcels">
                <Search size={16} />
              </button>
            </div>
            {hasAnyRole(["logistics_coordinator", "platform_admin"]) && (
              <Link className="book-parcel-btn" to="/logistics/management">
                <PackagePlus size={16} /> Manage
              </Link>
            )}
          </div>
        </div>

        <div className="status-tabs" role="tablist" aria-label="Filter parcels by status">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab}
              role="tab"
              aria-selected={statusFilter === tab}
              className={statusFilter === tab ? "active" : ""}
              onClick={() => list.setFilters({ status: tab === "All" ? "" : tab })}
            >
              {tab}
            </button>
          ))}
        </div>

        <main className="table-card" aria-busy={resource.loading}>
          {parcels === null && resource.loading ? (
            <LogisticsPlaceholder label="parcels" />
          ) : resource.error && !parcels?.length ? (
            <LogisticsNotice
              message={`Could not load parcels: ${resource.error.message}`}
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
                  message={`Could not refresh parcels: ${resource.error.message}`}
                  onRetry={resource.reload}
                />
              )}
              <div className="parcel-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Parcel No.</th>
                      <th>Origin</th>
                      <th>Destination</th>
                      <th>Next status</th>
                      <th>Tier</th>
                      <th>Weight</th>
                      <th>Shipping Fee</th>
                      <th>ETA</th>
                      <th>Status</th>
                      {canAssign && <th>Assignment</th>}
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {parcels.map((parcel) => {
                      const next = nextStatusesForRole(parcel.current_status, parcel.return_triggered, canAssign);
                      return (
                        <tr key={parcel.parcel_id}>
                          <td>#{parcel.parcel_id}</td>
                          <td>
                            <strong>{parcel.sender.business_name}</strong>
                            <span className="route-party">Sender</span>
                          </td>
                          <td>
                            {parcel.receiver.business_name}
                            <span className="route-party">Receiver</span>
                          </td>
                          <td className="next-status-cell">{formatNextStatuses(next)}</td>
                          <td>{parcel.tier_name}</td>
                          <td>{parcel.weight_kg} kg</td>
                          <td>{peso(parcel.shipping_fee)}</td>
                          <td>{shortDate(parcel.estimated_delivery_date)}</td>
                          <td><span className={`status ${statusClass(parcel.current_status)}`}>{parcel.current_status ?? "—"}</span></td>
                          {canAssign && (
                            <td>{parcel.latest_courier_id ? "Courier assigned" : "Needs a courier"}</td>
                          )}
                          <td>
                            <Link className="track-link" to={`/logistics/${parcel.parcel_id}`}>
                              {canAssign ? "Assign" : "Track"}
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <PaginationControls pagination={pagination} disabled={resource.loading} onPageChange={list.setPage} onLimitChange={list.setLimit} ariaLabel="Parcels pagination" />
            </>
          )}
        </main>
      </div>
    </AppLayout>
  );
}
