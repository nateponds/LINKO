import { useCallback, useEffect, useRef, useState } from "react";
import { Search, PackagePlus } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import AppLayout from "../../layouts/AppLayout";
import { useAuth } from "../../auth/AuthProvider";
import PaginationControls from "../../components/ui/PaginationControls";
import { useListUrlState } from "../../hooks/useListUrlState";
import { apiGet } from "../../lib/api";
import { peso, shortDate, statusClass } from "../../lib/format";
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
            <div className="page-empty">Loading parcels…</div>
          ) : resource.error && !parcels?.length ? (
            <div className="page-empty">Could not load parcels: {resource.error.message}</div>
          ) : (parcels?.length ?? 0) === 0 ? (
            <div className="page-empty">
              {list.q || statusFilter !== "All" ? "No parcels match these filters." : "No parcels are visible for this account yet."}
              {(list.q || statusFilter !== "All") && (
                <button className="clear-list-filters" type="button" onClick={() => list.update({ q: "", filters: { status: "" } })}>
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <>
              {resource.error && <div className="page-empty page-empty--inline">Could not refresh parcels: {resource.error.message}</div>}
              <div className="parcel-table-wrap">
                <table className="data-table">
                  <thead><tr><th>Parcel No.</th><th>Sender</th><th>Receiver</th><th>Tier</th><th>Weight</th><th>Shipping Fee</th><th>ETA</th><th>Status</th><th /></tr></thead>
                  <tbody>
                    {parcels.map((parcel) => (
                      <tr key={parcel.parcel_id}>
                        <td>#{parcel.parcel_id}</td>
                        <td><strong>{parcel.sender.business_name}</strong></td>
                        <td>{parcel.receiver.business_name}</td>
                        <td>{parcel.tier_name}</td>
                        <td>{parcel.weight_kg} kg</td>
                        <td>{peso(parcel.shipping_fee)}</td>
                        <td>{shortDate(parcel.estimated_delivery_date)}</td>
                        <td><span className={`status ${statusClass(parcel.current_status)}`}>{parcel.current_status ?? "—"}</span></td>
                        <td><Link className="track-link" to={`/logistics/${parcel.parcel_id}`}>Track</Link></td>
                      </tr>
                    ))}
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
