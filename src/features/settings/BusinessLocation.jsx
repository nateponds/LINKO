import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthProvider";
import { apiGet } from "../../lib/api";
import LocationModal from "./LocationModal";
import { CheckCircle2, AlertCircle } from "lucide-react";

// Join the filled parts of an address into one line, most specific first.
function formatAddress(loc) {
  return [
    loc.street_address,
    loc.barangay,
    loc.city_municipality,
    loc.province,
    loc.postal_code,
  ]
    .filter((part) => part && part.trim())
    .join(", ");
}

export default function BusinessLocation() {
  const { activeBusiness, activeBusinessId } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [location, setLocation] = useState(null);

  const isBuyer = activeBusiness?.roles?.includes("buyer") ?? false;
  // Coordinate presence is the pin gate: NULL coords => unpinned => blocked.
  const hasCoordinates = location?.has_coordinates ?? activeBusiness?.has_coordinates ?? false;

  const locationType = isBuyer ? "delivery location" : "pickup location";
  const blockedAction = isBuyer ? "ordering is blocked" : "shipping is blocked";

  // Reusable fetch for after-save refresh; setState runs after the await so it
  // never fires synchronously in an effect body.
  const loadLocation = useCallback(async () => {
    try {
      const data = await apiGet("/api/settings/location");
      setLocation(data);
    } catch {
      setLocation(null);
    }
  }, []);

  // Refetch on mount and whenever the active business changes, guarded so a
  // stale response from a previous business can't overwrite the current one.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await apiGet("/api/settings/location");
        if (active) setLocation(data);
      } catch {
        if (active) setLocation(null);
      }
    })();
    return () => { active = false; };
  }, [activeBusinessId]);

  const address = location ? formatAddress(location) : "";

  const handleLocationSaved = () => {
    setSaveSuccess(true);
    setModalOpen(false);
    loadLocation();
  };

  return (
    <div className="settings-section">
      <div className="settings-section-header">
        <h2>Business Location</h2>
        <p>Manage the physical location of your business.</p>
      </div>

      {saveSuccess && (
        <div role="status" aria-live="polite" className="settings-alert settings-alert-success">
          Location updated successfully.
        </div>
      )}

      <div className="settings-card">
        <div className="settings-card-body">
          <div className="location-summary-header">
            <div>
              <h3>{activeBusiness?.business_name}</h3>
              {hasCoordinates && address ? (
                <p className="location-context">
                  Your <strong>{locationType}</strong>: {address}
                </p>
              ) : (
                <p className="location-context">
                  This is your <strong>{locationType}</strong> — {blockedAction} until it is pinned.
                </p>
              )}
            </div>
            <div className="location-status-pill">
              {hasCoordinates ? (
                <span className="pill pill-success">
                  <CheckCircle2 size={16} /> Configured
                </span>
              ) : (
                <span className="pill pill-warning">
                  <AlertCircle size={16} /> Missing Location
                </span>
              )}
            </div>
          </div>
          
          <div className="location-actions">
            <button 
              className="settings-btn settings-btn-primary"
              onClick={() => {
                setSaveSuccess(false);
                setModalOpen(true);
              }}
            >
              {hasCoordinates ? "Edit Business Location" : "Add Business Location"}
            </button>
          </div>
        </div>
      </div>

      {modalOpen && (
        <LocationModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          onSaved={handleLocationSaved}
        />
      )}
    </div>
  );
}
