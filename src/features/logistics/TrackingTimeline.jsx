import { trackingLocationText } from "../../lib/trackingTimeline";
import "./TrackingTimeline.css";

/* Tracking history list shared by the operator parcel detail page and the
   buyer's read-only "Track parcel" modal. Newest first for display; the API
   sends the history oldest first. Display rules (handled-by branch, deliver-to
   destination address) live in lib/trackingTimeline.js — decision 6 in
   docs/delivery-status-logistics.md. */

const longDate = (iso) =>
  iso
    ? new Date(iso).toLocaleString("en-PH", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "—";

export default function TrackingTimeline({ parcel }) {
  const timeline = parcel?.tracking_history
    ? [...parcel.tracking_history].reverse()
    : [];

  return (
    <div className="timeline-block">
      <span className="timeline-heading">Tracking History</span>
      <ol className="timeline">
        {timeline.map((step, i) => {
          const locationText = trackingLocationText(step, parcel);

          return (
            <li
              key={step.scanned_at + step.status_update}
              className={`tl-step done ${i === 0 ? "current" : ""}`}
            >
              <span className="tl-dot" />
              <div className="tl-content">
                <span className="tl-title">{step.status_update}</span>
                <span className="tl-meta">
                  {longDate(step.scanned_at)}
                  {locationText ? ` - ${locationText}` : ""}
                  {step.courier_name ? ` - ${step.courier_name}` : ""}
                </span>
                {step.remarks && <span className="tl-remarks">{step.remarks}</span>}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
