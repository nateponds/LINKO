import { useEffect, useState } from "react";
import AppLayout from "../layouts/AppLayout";
import { useAuth } from "../auth/AuthProvider";
import { apiGet, apiSend } from "../lib/api";

// Business location settings (Sprint 13 §9.1). Active-business scoped: a
// business switch remounts the routed subtree (ProtectedRoute key), so the
// form refetches against the new X-Active-Business automatically. Numeric
// coordinate inputs are the permanent accessible fallback — MapPicker lands
// on top of this form later (T12), it never replaces it.

const TEXT_FIELDS = [
  ["province", "Province"],
  ["city_municipality", "City / Municipality"],
  ["barangay", "Barangay"],
  ["street_address", "Street Address"],
  ["postal_code", "Postal Code"],
];

// Everything is kept as strings so dirty-comparison is trivial and inputs
// stay controlled; coordinates convert to numbers (or null) only on save.
function toForm(data) {
  const form = {};
  for (const [key] of TEXT_FIELDS) form[key] = data?.[key] ?? "";
  form.latitude = String(data?.latitude ?? "");
  form.longitude = String(data?.longitude ?? "");
  return form;
}

const formsEqual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export default function SettingsPage() {
  const { activeBusiness, refreshAuth } = useAuth();
  const isBuyer = activeBusiness?.roles?.includes("buyer") ?? false;

  const [form, setForm] = useState(toForm(null));
  const [savedForm, setSavedForm] = useState(toForm(null));
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
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
    return () => {
      cancelled = true;
    };
  }, []);

  const dirty = !formsEqual(form, savedForm);

  const update = (key) => (e) => {
    setForm((current) => ({ ...current, [key]: e.target.value }));
    setSaveSuccess(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaveError(null);
    setSaveSuccess(false);

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
      setSaveSuccess(true);
      // banner + membership has_coordinates re-derive from the session
      await refreshAuth();
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout>
      <div className="logistics-page" style={{ maxWidth: "560px", margin: "0 auto" }}>
        <h1 style={{ marginBottom: "0.5rem", textAlign: "center" }}>Business Location</h1>
        <p style={{ textAlign: "center", fontSize: "0.9rem", opacity: 0.75, marginBottom: "1.5rem" }}>
          {isBuyer
            ? <>This is the <strong>delivery location</strong> for {activeBusiness?.business_name} — orders you place are routed here, and ordering is blocked until it is pinned.</>
            : <>This is the <strong>pickup location</strong> for {activeBusiness?.business_name} — shipments you send are routed from here, and shipping is blocked until it is pinned.</>}
        </p>

        {loading ? (
          <p style={{ textAlign: "center" }}>Loading...</p>
        ) : loadError ? (
          <p style={{ color: "red", textAlign: "center" }}>{loadError}</p>
        ) : (
          <div className="logistics-form-card">
            <form onSubmit={handleSubmit}>
              {TEXT_FIELDS.map(([key, label]) => (
                <input
                  key={key}
                  type="text"
                  placeholder={label}
                  required
                  value={form[key]}
                  onChange={update(key)}
                />
              ))}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                <input type="number" step="any" min="-90" max="90" placeholder="Latitude"
                  value={form.latitude} onChange={update("latitude")} />
                <input type="number" step="any" min="-180" max="180" placeholder="Longitude"
                  value={form.longitude} onChange={update("longitude")} />
              </div>
              <p style={{ fontSize: "0.8rem", opacity: 0.7, margin: "0.5rem 0" }}>
                Enter coordinates directly (map picker coming soon) — both or
                neither. Clearing both unpins the business and re-enables the
                reminder.
              </p>
              <button type="submit" disabled={saving || !dirty}>
                {saving ? "Saving…" : "Save Location"}
              </button>
              {dirty && !saving && (
                <p style={{ fontSize: "0.8rem", opacity: 0.7, marginTop: "0.5rem" }}>
                  You have unsaved changes.
                </p>
              )}
              {saveSuccess && (
                <p style={{ color: "green", marginTop: "0.5rem" }}>Location saved.</p>
              )}
              {saveError && <p className="logistics-form-error">{saveError}</p>}
            </form>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
