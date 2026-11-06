import { useCallback, useEffect, useRef, useState } from "react";
import { Search, X, MapPin, Package, ArrowUpRight, Check, AlertCircle } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import AppLayout from "../../layouts/AppLayout";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import PaginationControls from "../../components/ui/PaginationControls";
import { useListUrlState } from "../../hooks/useListUrlState";
import { apiGet, apiSend } from "../../lib/api";
import { statusClass, shortDate } from "../../lib/format";
import { allowedNext, ONE_TAP_REMARKS, FAIL_REASONS, TRACKING_STATUSES, isReturning } from "../../lib/statusWorkflow";
import { LogisticsNotice } from "./LogisticsStates";
import { COURIER_EMPTY_COPY } from "./workflowHints";
import { CourierCardsSkeleton } from "../../components/ui/pageSkeletons";
import "./logistics.css";

const ASSIGNMENT_TABS = [
  { value: "available", label: "Available at my branch" },
  { value: "active", label: "My active parcels" },
  { value: "completed", label: "Completed" },
];

const ACTION_LABELS = {
  "Picked Up": "Confirm pickup",
  "Arrived at Branch": "Record branch arrival",
  "Departed Branch": "Record branch departure",
  "Out for Delivery": "Start delivery",
  "Delivery Failed": "Report delivery issue",
  "Out for Return": "Start return to sender",
  Delivered: "Mark delivered",
  Returned: "Confirm returned",
};

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
  const [failure, setFailure] = useState(null);
  const [pendingAction, setPendingAction] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchDraft, setSearchDraft] = useState({ query: list.q, value: list.q });
  const [confirm, setConfirm] = useState(null);
  const savingRef = useRef(false);
  const searchInputRef = useRef(null);
  const query = new URLSearchParams({ page: String(list.page), limit: String(list.limit), assignment });
  if (list.q) query.set("q", list.q);
  const resource = useAssignmentPage(`/api/parcels?${query.toString()}`);
  const searchTimerRef = useRef(null);
  const pageData = resource.data ?? resource.staleData;
  const parcels = pageData?.items ?? null;
  const pagination = pageData?.pagination ?? null;
  const counts = pageData?.facets?.assignment_counts ?? { available: 0, active: 0, completed: 0 };
  const searchVisible = searchOpen || !!list.q;

  if (searchDraft.query !== list.q) {
    setSearchDraft({ query: list.q, value: list.q });
  }

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

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
    setSearchDraft({ query: list.q, value: nextQuery });
    window.clearTimeout(searchTimerRef.current);
    searchTimerRef.current = window.setTimeout(() => list.setQuery(nextQuery), 300);
  }

  function changeAssignment(value) {
    window.clearTimeout(searchTimerRef.current);
    list.update({ q: searchDraft.value, filters: { assignment: value } });
  }

  function toggleSearch() {
    if (searchVisible) {
      window.clearTimeout(searchTimerRef.current);
      list.setQuery("");
      setSearchOpen(false);
    } else {
      setSearchOpen(true);
    }
  }

  function handleQuickActionClick(parcel, statusUpdate, remarks) {
    if (savingRef.current || resource.loading) return;
    const legal = allowedNext(parcel.current_status, parcel.return_triggered);
    if (!legal.includes(statusUpdate)) {
      setActionError({
        parcelId: parcel.parcel_id,
        message: `${statusUpdate} is not a legal next status from ${parcel.current_status ?? "this parcel"}.`,
      });
      return;
    }
    if (statusUpdate === "Delivery Failed" && remarks === undefined) {
      setFailure({ parcelId: parcel.parcel_id, reason: "" });
      setActionError(null);
      return;
    }
    if (statusUpdate === "Delivery Failed" && !FAIL_REASONS.includes(remarks)) return;
    const receiver = parcel.receiver?.business_name ?? "the receiver";
    if (statusUpdate === "Delivered" || statusUpdate === "Returned") {
      const returned = statusUpdate === "Returned";
      setConfirm({
        title: returned ? "Confirm return to sender?" : "Mark as delivered?",
        message: returned
          ? `Confirm parcel #${parcel.parcel_id} has been handed back to the sender? This closes the return and cannot be undone.`
          : `Mark parcel #${parcel.parcel_id} to ${receiver} as Delivered? This closes the delivery and cannot be undone.`,
        confirmLabel: ACTION_LABELS[statusUpdate],
        onConfirm: () => { void handleQuickAction(parcel.parcel_id, statusUpdate, remarks); },
      });
      return;
    }
    if (statusUpdate === "Delivery Failed") {
      setConfirm({
        title: "Record delivery failure?",
        message: `Record parcel #${parcel.parcel_id} to ${receiver} as Delivery Failed with reason "${remarks}"? This cannot be undone.`,
        confirmLabel: "Record failure",
        onConfirm: () => { void handleQuickAction(parcel.parcel_id, statusUpdate, remarks); },
      });
      return;
    }
    void handleQuickAction(parcel.parcel_id, statusUpdate, remarks);
  }

  async function handleQuickAction(parcelId, statusUpdate, remarks) {
    if (savingRef.current) return;
    savingRef.current = true;
    setActionError(null);
    setSuccessMessage("");
    setPendingAction({ parcelId, status: statusUpdate });

    const body = { status_update: statusUpdate };
    if (remarks ?? ONE_TAP_REMARKS[statusUpdate]) body.remarks = remarks ?? ONE_TAP_REMARKS[statusUpdate];

    try {
      await apiSend(`/api/parcels/${parcelId}/tracking`, { body });
      setFailure(null);
      setSuccessMessage(`Parcel #${parcelId} updated to ${statusUpdate}.`);
      resource.reload();
    } catch (error) {
      setActionError({ parcelId, message: error.message });
    } finally {
      savingRef.current = false;
      setPendingAction(null);
    }
  }

  function renderParcelCard(parcel) {
    const next = allowedNext(parcel.current_status, parcel.return_triggered);
    const cardError = actionError?.parcelId === parcel.parcel_id ? actionError.message : null;
    const pending = pendingAction?.parcelId === parcel.parcel_id;
    const disabled = !!pendingAction || resource.loading;
    const reportingFailure = failure?.parcelId === parcel.parcel_id;
    const unknownStatus = !TRACKING_STATUSES.includes(parcel.current_status);
    const returning = parcel.current_status === "Returned" || isReturning(parcel.current_status, parcel.return_triggered);
    return (
        <article key={parcel.parcel_id} className="parcel-card courier-parcel" aria-label={`Parcel #${parcel.parcel_id}`} aria-busy={pending}>
          <div className="parcel-card-header">
            <Link to={`/logistics/${parcel.parcel_id}`} className="courier-parcel-link">Parcel #{parcel.parcel_id}<ArrowUpRight size={16} aria-hidden="true" /></Link>
            <span className={`status ${statusClass(parcel.current_status)}`}>{parcel.current_status || "Status unavailable"}</span>
          </div>
          <div className="parcel-card-receiver"><MapPin size={18} className="parcel-card-icon" aria-hidden="true" /><div><span className="courier-destination-label">{returning ? "Return to sender" : "Deliver to"}</span><h2>{(returning ? parcel.sender : parcel.receiver)?.business_name ?? "See parcel details"}</h2></div></div>
          <div className="parcel-card-meta"><Package size={15} aria-hidden="true" /><span>{parcel.weight_kg} kg</span><span>ETA {shortDate(parcel.estimated_delivery_date)}</span></div>

          {reportingFailure ? (
            <form className="courier-failure" onSubmit={(event) => { event.preventDefault(); handleQuickActionClick(parcel, "Delivery Failed", failure.reason); }}>
              <label htmlFor={`failure-${parcel.parcel_id}`}>Delivery issue</label>
              <select id={`failure-${parcel.parcel_id}`} required autoFocus value={failure.reason} disabled={disabled} onChange={(event) => setFailure({ ...failure, reason: event.target.value })}>
                <option value="">Select a reason</option>
                {FAIL_REASONS.map((reason) => <option key={reason}>{reason}</option>)}
              </select>
              <div className="parcel-card-actions">
                <button className="courier-action-primary" type="submit" disabled={disabled || !failure.reason}>{pending ? "Saving…" : "Record issue"}</button>
                <button className="courier-action" type="button" disabled={disabled} onClick={() => { setFailure(null); requestAnimationFrame(() => document.getElementById(`issue-${parcel.parcel_id}`)?.focus()); }}>Cancel</button>
              </div>
            </form>
          ) : next.length > 0 ? (
            <div className="parcel-card-actions">
              {next.map((status) => (
                <button key={status} id={status === "Delivery Failed" ? `issue-${parcel.parcel_id}` : undefined} type="button" className={next.length === 1 || status === "Delivered" ? "courier-action-primary" : "courier-action"} disabled={disabled} onClick={() => handleQuickActionClick(parcel, status)}>
                  {status === "Delivered" && <Check size={17} aria-hidden="true" />}
                  {pendingAction?.parcelId === parcel.parcel_id && pendingAction.status === status ? "Saving…" : status === "Out for Delivery" && parcel.current_status === "Delivery Failed" ? "Retry delivery" : ACTION_LABELS[status]}
                </button>
              ))}
            </div>
          ) : unknownStatus ? (
            <p className="courier-status-notice"><AlertCircle size={17} aria-hidden="true" />Status needs review. Ask a logistics coordinator before updating.</p>
          ) : null}
          {cardError && <p className="form-error parcel-card-error" role="alert">{cardError}</p>}
        </article>
    );
  }

  return (
    <AppLayout>
      <div className="logistics-page courier-dashboard">
        <div className="page-head courier-page-head"><h1>Courier Dashboard</h1></div>

        <div className="courier-toolbar">
          <nav className="courier-view-nav" aria-label="Courier assignments">
            {ASSIGNMENT_TABS.map((tab) => (
              <button key={tab.value} type="button" aria-current={assignment === tab.value ? "page" : undefined} onClick={() => changeAssignment(tab.value)}>
                {tab.label} <span>{counts[tab.value] ?? 0}</span>
              </button>
            ))}
          </nav>
          <select className="courier-view-picker" aria-label="Parcel view" value={assignment} onChange={(event) => changeAssignment(event.target.value)}>
            {ASSIGNMENT_TABS.map((tab) => <option key={tab.value} value={tab.value}>{tab.label} ({counts[tab.value] ?? 0})</option>)}
          </select>
          <button className="courier-search-toggle" type="button" aria-label={searchVisible ? "Clear and close search" : "Search parcels"} aria-expanded={searchVisible} aria-controls="courier-search" onClick={toggleSearch}>
            {searchVisible ? <X size={20} aria-hidden="true" /> : <Search size={20} aria-hidden="true" />}
          </button>
          <div id="courier-search" className={`courier-search${searchVisible ? " is-open" : ""}`}>
            <Search size={18} aria-hidden="true" />
            <input ref={searchInputRef} type="search" aria-label="Search parcel number or receiver" placeholder="Parcel no. or receiver" value={searchDraft.value} onChange={(event) => queueSearch(event.target.value)} />
          </div>
        </div>

        <div className="courier-feedback" role="status">{successMessage && <><Check size={17} aria-hidden="true" />{successMessage}</>}</div>

        <section className="courier-list" aria-label="Parcels" aria-busy={resource.loading}>
          {actionError && !parcels?.some((parcel) => parcel.parcel_id === actionError.parcelId) && (
            <LogisticsNotice message={`Could not update parcel #${actionError.parcelId}: ${actionError.message}`} />
          )}
          {parcels === null && resource.loading ? (
            <CourierCardsSkeleton />
          ) : resource.error && !parcels?.length ? (
            <LogisticsNotice
              message={`Could not load assignments: ${resource.error.message}`}
              onRetry={resource.reload}
            />
          ) : (parcels?.length ?? 0) === 0 ? (
            <LogisticsNotice
              message={list.q ? "No assignments match your search." : COURIER_EMPTY_COPY[assignment]}
              onRetry={list.q ? () => list.setQuery("") : undefined}
              retryLabel="Clear search"
            />
          ) : (
            <>
              {resource.error && (
                <LogisticsNotice
                  message={`Could not refresh assignments: ${resource.error.message}`}
                  onRetry={resource.reload}
                />
              )}
              <div className="parcel-list-container">{parcels.map(renderParcelCard)}</div>
              <PaginationControls pagination={pagination} disabled={resource.loading} onPageChange={list.setPage} onLimitChange={list.setLimit} ariaLabel="Courier assignments pagination" />
            </>
          )}
        </section>
        <ConfirmDialog
          open={!!confirm}
          title={confirm?.title}
          message={confirm?.message}
          confirmLabel={confirm?.confirmLabel}
          onConfirm={() => { confirm?.onConfirm?.(); setConfirm(null); }}
          onCancel={() => setConfirm(null)}
        />
      </div>
    </AppLayout>
  );
}
