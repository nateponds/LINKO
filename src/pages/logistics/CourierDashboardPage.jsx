import { useCallback, useEffect, useRef, useState } from "react";
import { Search, MapPin, Package } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import AppLayout from "../../layouts/AppLayout";
import PaginationControls from "../../components/ui/PaginationControls";
import { useListUrlState } from "../../hooks/useListUrlState";
import { apiGet, apiSend } from "../../lib/api";
import { statusClass, shortDate } from "../../lib/format";
import { allowedNext, ONE_TAP_REMARKS, FAIL_REASONS } from "../../lib/statusWorkflow";
import "./logistics.css";

const ASSIGNMENT_TABS = [
  { value: "available", label: "Available at my branch" },
  { value: "active", label: "My active parcels" },
  { value: "completed", label: "Completed" },
];

function useAssignmentPage(path) {
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

export default function CourierDashboardPage() {
  const location = useLocation();
  const list = useListUrlState();
  const requestedAssignment = new URLSearchParams(location.search).get("assignment");
  const assignment = ASSIGNMENT_TABS.some((tab) => tab.value === requestedAssignment)
    ? requestedAssignment
    : "available";
  const [failingParcelId, setFailingParcelId] = useState(null);
  const [actionError, setActionError] = useState(null);
  const query = new URLSearchParams({ page: String(list.page), limit: String(list.limit), assignment });
  if (list.q) query.set("q", list.q);
  const resource = useAssignmentPage(`/api/parcels?${query.toString()}`);
  const searchTimerRef = useRef(null);
  const pageData = resource.data ?? resource.staleData;
  const parcels = pageData?.items ?? null;
  const pagination = pageData?.pagination ?? null;
  const counts = pageData?.facets?.assignment_counts ?? { available: 0, active: 0, completed: 0 };

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

  async function handleQuickAction(parcelId, statusUpdate, event, remarks) {
    event.preventDefault();
    if (statusUpdate === "Delivery Failed" && remarks === undefined) {
      setFailingParcelId(parcelId);
      return;
    }
    setFailingParcelId(null);
    setActionError(null);

    const body = { status_update: statusUpdate };
    if (remarks ?? ONE_TAP_REMARKS[statusUpdate]) body.remarks = remarks ?? ONE_TAP_REMARKS[statusUpdate];

    try {
      await apiSend(`/api/parcels/${parcelId}/tracking`, { body });
      resource.reload();
    } catch (error) {
      setActionError(error.message);
    }
  }

  function renderParcelCard(parcel) {
    return (
      <Link to={`/logistics/${parcel.parcel_id}`} key={parcel.parcel_id} className="parcel-card-link">
        <div className="parcel-card">
          <div className="parcel-card-header">
            <strong className="parcel-card-id">#{parcel.parcel_id}</strong>
            <span className={`status ${statusClass(parcel.current_status)}`}>{parcel.current_status}</span>
          </div>
          <div className="parcel-card-receiver"><MapPin size={16} className="parcel-card-icon" /><div><strong>To:</strong> {parcel.receiver.business_name}</div></div>
          <div className="parcel-card-meta"><Package size={14} /><span>{parcel.weight_kg} kg · ETA: {shortDate(parcel.estimated_delivery_date)}</span></div>
          <div className="parcel-card-actions">
            {failingParcelId === parcel.parcel_id
              ? FAIL_REASONS.map((reason) => <button key={reason} className="courier-action" onClick={(event) => handleQuickAction(parcel.parcel_id, "Delivery Failed", event, reason)}>{reason}</button>)
              : allowedNext(parcel.current_status, parcel.return_triggered).map((status) => <button key={status} className={status === "Delivered" ? "courier-action-primary" : "courier-action"} onClick={(event) => handleQuickAction(parcel.parcel_id, status, event)}>{status}</button>)}
          </div>
        </div>
      </Link>
    );
  }

  return (
    <AppLayout>
      <div className="logistics-page">
        <div className="page-head courier-page-head">
          <div className="page-head-intro"><h1>Courier Dashboard</h1><p className="page-head-subtitle">Manage pickups, delivery progress, and returns</p></div>
          <div className="search-bar courier-search-bar">
            <input key={list.q} type="search" placeholder="Search parcel no. or receiver" defaultValue={list.q} onChange={(event) => queueSearch(event.target.value)} />
            <button className="search-icon-btn" type="button" aria-label="Search assignments"><Search size={16} /></button>
          </div>
        </div>

        <div className="courier-tabs" role="tablist" aria-label="Courier assignments">
          {ASSIGNMENT_TABS.map((tab) => (
            <button key={tab.value} role="tab" aria-selected={assignment === tab.value} className={assignment === tab.value ? "active" : ""} onClick={() => list.setFilters({ assignment: tab.value })}>
              {tab.label} <span aria-label={`${counts[tab.value] ?? 0} assignments`}>{counts[tab.value] ?? 0}</span>
            </button>
          ))}
        </div>

        <main className="courier-list" aria-busy={resource.loading}>
          {actionError && <div className="page-empty page-empty--inline">Could not update parcel: {actionError}</div>}
          {parcels === null && resource.loading ? (
            <div className="page-empty">Loading assignments...</div>
          ) : resource.error && !parcels?.length ? (
            <div className="page-empty">Could not load assignments: {resource.error.message}</div>
          ) : (parcels?.length ?? 0) === 0 ? (
            <div className="page-empty">
              {list.q ? "No assignments match your search." : "No assignments in this group."}
              {list.q && <button className="clear-list-filters" type="button" onClick={() => list.setQuery("")}>Clear search</button>}
            </div>
          ) : (
            <>
              {resource.error && <div className="page-empty page-empty--inline">Could not refresh assignments: {resource.error.message}</div>}
              <div className="parcel-list-container">{parcels.map(renderParcelCard)}</div>
              <PaginationControls pagination={pagination} disabled={resource.loading} onPageChange={list.setPage} onLimitChange={list.setLimit} ariaLabel="Courier assignments pagination" />
            </>
          )}
        </main>
      </div>
    </AppLayout>
  );
}
