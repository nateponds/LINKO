import { Headset } from "lucide-react";
import "./SupportModal.css";

const SUPPORT_HOTLINE = "+63 2 8546-5674";

/* Shared "Contact Customer Service" modal. Hand-rolled to match the house
   modal-overlay idiom (see OrdersPage), but with its own class names and a
   higher z-index (3000) so it can layer over page-level modals at 2000. */
export default function SupportModal({ open, onClose }) {
  return (
    <div className={`support-modal-overlay${open ? " open" : ""}`}>
      {open && (
        <div className="support-modal-box">
          
          <div className="support-icon-wrapper">
            <Headset className="support-icon" />
          </div>

          <h2>Contact Customer Service</h2>
          <p className="support-hotline">
            <a href="tel:+63285465674">{SUPPORT_HOTLINE}</a>
          </p>
          <p className="support-blurb">
            Our support team can help you <strong>cancel a parcel</strong>,{" "}
            <strong>redirect a delivery</strong>, or{" "}
            <strong>correct a tracking status</strong>. Available{" "}
            <strong>Mon–Sat, 8AM–6PM PHT</strong>.
          </p>
          <div className="support-modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
