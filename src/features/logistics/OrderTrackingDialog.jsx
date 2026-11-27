import { useEffect, useId, useRef, useState } from "react";
import { TrackingSkeleton } from "../../components/ui/pageSkeletons";
import { useDialogFocus } from "../../components/ui/useDialogFocus";
import { apiGet } from "../../lib/api";
import { lockBodyScroll } from "../../lib/bodyScrollLock";
import { statusClass } from "../../lib/format";
import TrackingTimeline from "./TrackingTimeline";

export default function OrderTrackingDialog({ order, onClose, onSupport }) {
  const { order_id: orderId, parcel_id: parcelId } = order;
  const [result, setResult] = useState(null);
  const titleId = useId();
  const dialogRef = useRef(null);
  const closeRef = useRef(null);

  useDialogFocus({ open: true, dialogRef, initialFocusRef: closeRef, onEscape: onClose });
  useEffect(() => lockBodyScroll(), []);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    apiGet(`/api/parcels/${encodeURIComponent(parcelId)}`, { signal }).then(
      (parcel) => { if (!signal.aborted) setResult({ parcel }); },
      (error) => { if (!signal.aborted) setResult({ error }); },
    );
    return () => controller.abort();
  }, [parcelId]);

  const parcel = result?.parcel;
  return (
    <div className="modal-overlay open">
      <div className="modal-box" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} ref={dialogRef}>
        <button className="modal-close" type="button" aria-label="Close tracking" ref={closeRef} onClick={onClose}>×</button>
        <h2 id={titleId}>Track order #{orderId}</h2>
        {!result ? (
          <TrackingSkeleton />
        ) : result.error ? (
          <p className="form-error" role="alert">Could not load tracking: {result.error.message}</p>
        ) : parcel ? (
          <>
            <p className="track-parcel-meta">
              Parcel #{parcel.parcel_id} ·{" "}
              <span className={`status ${statusClass(parcel.current_status)}`}>{parcel.current_status ?? "-"}</span>
            </p>
            <TrackingTimeline parcel={parcel} />
          </>
        ) : (
          <p className="form-note">No tracking available.</p>
        )}
        <button type="button" className="support-link-btn" onClick={onSupport}>Need help? Contact customer service</button>
      </div>
    </div>
  );
}
