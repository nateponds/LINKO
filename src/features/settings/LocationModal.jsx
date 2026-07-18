import { useEffect, useState, useRef, useCallback } from "react";
import { useAuth } from "../../auth/AuthProvider";
import { apiGet, apiSend } from "../../lib/api";
import MapPicker from "../../components/ui/MapPicker";
import { X, AlertTriangle } from "lucide-react";

const TEXT_FIELDS = [
  { key: "province", label: "Province" },
  { key: "city_municipality", label: "City / Municipality" },
  { key: "barangay", label: "Barangay" },
  { key: "street_address", label: "Street Address" },
  { key: "postal_code", label: "Postal Code" },
];

function toForm(data) {
  const form = {};
  for (const { key } of TEXT_FIELDS) form[key] = data?.[key] ?? "";
  form.latitude = String(data?.latitude ?? "");
  form.longitude = String(data?.longitude ?? "");
  return form;
}

const formsEqual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export default function LocationModal({ open, onClose, onSaved }) {
  const { activeBusiness, refreshAuth } = useAuth();
  const isBuyer = activeBusiness?.roles?.includes("buyer") ?? false;
  
  const [form, setForm] = useState(toForm(null));
  const [savedForm, setSavedForm] = useState(toForm(null));
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  
  const [mapStatus, setMapStatus] = useState(import.meta.env.VITE_MAPBOX_TOKEN ? "loading" : "no-token");
  const [confirmClose, setConfirmClose] = useState(false);

  const modalRef = useRef(null);
  const previousFocus = useRef(null);

  useEffect(() => {
    if (open) {
      previousFocus.current = document.activeElement;
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
      if (previousFocus.current) {
        previousFocus.current.focus();
      }
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    
    let cancelled = false;
    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const data = await apiGet("/api/settings/location");
        if (cancelled) return;
        const initial = toForm(data);
        setForm(initial);
        setSavedForm(initial);
      } catch (err) {
        if (!cancelled) setLoadError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [open]);

  const dirty = !formsEqual(form, savedForm);

  const requestClose = useCallback(() => {
    if (dirty) {
      setConfirmClose(true);
    } else {
      onClose();
    }
  }, [dirty, onClose]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        requestClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, requestClose]);

  const update = (key) => (e) => {
    setForm((current) => ({ ...current, [key]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaveError(null);

    const lat = form.latitude.trim();
    const lng = form.longitude.trim();
    if ((lat === "") !== (lng === "")) {
      setSaveError("Provide both latitude and longitude, or neither");
      return;
    }

    setSaving(true);
    try {
      const saved = await apiSend("/api/settings/location", {
        method: "PUT",
        body: {
          province: form.province,
          city_municipality: form.city_municipality,
          barangay: form.barangay,
          street_address: form.street_address,
          postal_code: form.postal_code,
          latitude: lat === "" ? null : Number(lat),
          longitude: lng === "" ? null : Number(lng),
        },
      });
      const next = toForm(saved);
      setForm(next);
      setSavedForm(next);
      await refreshAuth();
      onSaved(saved);
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleClearPin = () => {
    setForm(current => ({ ...current, latitude: "", longitude: "" }));
  };

  if (!open) return null;

  return (
    <div className="settings-modal-backdrop" onClick={(e) => {
      if (e.target === e.currentTarget) requestClose();
    }}>
      <div 
        className="settings-modal-dialog" 
        role="dialog" 
        aria-modal="true" 
        aria-labelledby="location-modal-title"
        ref={modalRef}
        tabIndex="-1"
      >
        <div className="settings-modal-header">
          <div className="settings-modal-title-group">
            <h2 id="location-modal-title" className="settings-modal-title">Business Location</h2>
            <p className="settings-modal-subtitle">
              {isBuyer
                ? <>Delivery location for {activeBusiness?.business_name}</>
                : <>Pickup location for {activeBusiness?.business_name}</>}
            </p>
          </div>
          <button className="settings-modal-close" onClick={requestClose} aria-label="Close modal">
            <X size={20} />
          </button>
        </div>

        {confirmClose ? (
          <div className="settings-modal-body settings-modal-confirm">
            <AlertTriangle size={48} color="#f59f00" />
            <h3>Discard unsaved changes?</h3>
            <p>You have made changes to your location that haven't been saved.</p>
            <div className="settings-modal-confirm-actions">
              <button className="settings-btn settings-btn-outline" onClick={() => setConfirmClose(false)}>
                Keep editing
              </button>
              <button className="settings-btn settings-btn-danger" onClick={() => {
                setConfirmClose(false);
                onClose();
              }}>
                Discard changes
              </button>
            </div>
          </div>
        ) : loading ? (
          <div className="settings-modal-body settings-modal-loading">
            <p>Loading location details...</p>
          </div>
        ) : loadError ? (
          <div className="settings-modal-body settings-modal-error">
            <p>{loadError}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="settings-modal-form logistics-form-card modal-form-override">
            <div className="settings-modal-layout">
              <div className="settings-modal-fields">
                {TEXT_FIELDS.map(({ key, label }) => (
                  <div key={key} className="settings-field-group">
                    <label htmlFor={`field-${key}`}>{label}</label>
                    <input
                      id={`field-${key}`}
                      type="text"
                      placeholder={label}
                      required
                      value={form[key]}
                      onChange={update(key)}
                    />
                  </div>
                ))}
              </div>
              
              <div className="settings-modal-map">
                <div className="settings-field-group">
                  <label>Map Pin</label>
                  <div className="map-picker-container">
                    <MapPicker
                      latitude={form.latitude}
                      longitude={form.longitude}
                      onChange={({ latitude, longitude }) => {
                        setForm((current) => ({
                          ...current,
                          latitude: String(latitude),
                          longitude: String(longitude),
                        }));
                      }}
                      onStatusChange={setMapStatus}
                    />
                  </div>
                </div>

                {mapStatus !== "ready" && (
                  <>
                    <div className="settings-modal-coords">
                      <div className="settings-field-group">
                        <label>Latitude</label>
                        <input type="number" step="any" min="-90" max="90" placeholder="Latitude"
                          value={form.latitude} onChange={update("latitude")} />
                      </div>
                      <div className="settings-field-group">
                        <label>Longitude</label>
                        <input type="number" step="any" min="-180" max="180" placeholder="Longitude"
                          value={form.longitude} onChange={update("longitude")} />
                      </div>
                    </div>
                    <p className="settings-modal-hint">
                      Pick on the map or enter coordinates directly — both or
                      neither. Clearing both unpins the business and re-enables the
                      reminder.
                    </p>
                  </>
                )}
              </div>
            </div>

            {saveError && <div className="settings-modal-alert error">{saveError}</div>}
            
            <div className="settings-modal-footer">
              <div className="settings-modal-footer-start">
                {mapStatus === "ready" && (
                  <button
                    type="button"
                    onClick={handleClearPin}
                    className="settings-btn settings-btn-danger"
                    disabled={
                      (form.latitude === "" && form.longitude === "") ||
                      (form.latitude === savedForm.latitude && form.longitude === savedForm.longitude)
                    }
                  >
                    Clear Pin
                  </button>
                )}
              </div>
              <div className="settings-modal-footer-end">
                <button type="button" className="settings-btn settings-btn-outline" onClick={requestClose}>
                  Cancel
                </button>
                <button type="submit" className="settings-btn settings-btn-primary" disabled={saving || !dirty}>
                  {saving ? "Saving…" : "Save Location"}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
