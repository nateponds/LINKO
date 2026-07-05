import { useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import AppLayout from "../layouts/AppLayout";
import { peso } from "../lib/format";
import "./LogisticsPage.css";

/* Book-a-parcel form (Sprint 2-CD). POSTs to /api/parcels; the database
   triggers compute the shipping fee, payment total, and commission. The
   fee preview here mirrors the trigger formula for instant feedback only —
   the stored value always comes from the database. */

export default function BookParcelPage() {
  const navigate = useNavigate();

  const [customers, setCustomers] = useState([]);
  const [tiers, setTiers] = useState([]);
  const [loadError, setLoadError] = useState(null);

  const [form, setForm] = useState({
    sender_id: "",
    receiver_id: "",
    tier_id: "",
    origin_address_id: "",
    destination_address_id: "",
    weight_kg: "",
    dimensions: "",
    declared_value: "",
    total_distance_km: "",
    payment_method: "COD",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      fetch("/api/customers").then((r) => (r.ok ? r.json() : Promise.reject(new Error(`customers: ${r.status}`)))),
      fetch("/api/service-tiers").then((r) => (r.ok ? r.json() : Promise.reject(new Error(`service tiers: ${r.status}`)))),
    ])
      .then(([customerData, tierData]) => {
        if (cancelled) return;
        setCustomers(customerData);
        setTiers(tierData);
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(err.message);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const sender = customers.find((c) => c.customer_id === Number(form.sender_id));
  const receiver = customers.find((c) => c.customer_id === Number(form.receiver_id));
  const tier = tiers.find((t) => t.tier_id === Number(form.tier_id));

  // Preview of what the database trigger will charge.
  const feePreview = useMemo(() => {
    if (!tier || !form.weight_kg) return null;
    return (
      tier.base_fee +
      Number(form.weight_kg) * tier.base_rate_per_kg +
      (Number(form.total_distance_km) || 0) * tier.rate_per_km
    );
  }, [tier, form.weight_kg, form.total_distance_km]);

  function setField(name, value) {
    setForm((f) => {
      const next = { ...f, [name]: value };
      // Address selects depend on the chosen customer; reset on change.
      if (name === "sender_id") next.origin_address_id = "";
      if (name === "receiver_id") next.destination_address_id = "";
      return next;
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch("/api/parcels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sender_id: Number(form.sender_id),
          receiver_id: Number(form.receiver_id),
          tier_id: Number(form.tier_id),
          origin_address_id: Number(form.origin_address_id),
          destination_address_id: Number(form.destination_address_id),
          weight_kg: Number(form.weight_kg),
          dimensions: form.dimensions || undefined,
          declared_value: form.declared_value === "" ? undefined : Number(form.declared_value),
          total_distance_km: form.total_distance_km === "" ? undefined : Number(form.total_distance_km),
          payment_method: form.payment_method,
        }),
      });
      const body = await res.json();

      if (!res.ok) {
        throw new Error(body.error?.message ?? `Server responded ${res.status}`);
      }

      navigate(`/logistics/${body.parcel_id}`);
    } catch (err) {
      setSubmitError(err.message);
      setSubmitting(false);
    }
  }

  const addressOption = (a) =>
    [a.street_address, a.barangay, a.city_municipality].filter(Boolean).join(", ");

  return (
    <AppLayout>
      <div className="logistics-page">
        <div className="parcel-subbar">
          <button className="back-btn" onClick={() => navigate(-1)}>
            <ArrowLeft size={15} /> Back
          </button>
        </div>

        <div className="page-head">
          <h1>Book a Parcel</h1>
        </div>

        {loadError ? (
          <div className="page-empty">
            Could not load booking data: {loadError}. Is the backend running?
          </div>
        ) : (
          <form className="book-form" onSubmit={handleSubmit}>
            <div className="book-grid">
              <fieldset className="parcel-card">
                <legend className="card-heading">Sender</legend>
                <label>
                  Customer
                  <select
                    required
                    value={form.sender_id}
                    onChange={(e) => setField("sender_id", e.target.value)}
                  >
                    <option value="">Select sender…</option>
                    {customers.map((c) => (
                      <option key={c.customer_id} value={c.customer_id}>
                        {c.full_name} ({c.customer_type})
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Origin address
                  <select
                    required
                    disabled={!sender}
                    value={form.origin_address_id}
                    onChange={(e) => setField("origin_address_id", e.target.value)}
                  >
                    <option value="">Select origin…</option>
                    {sender?.addresses.map((a) => (
                      <option key={a.address_id} value={a.address_id}>
                        {addressOption(a)}
                      </option>
                    ))}
                  </select>
                </label>
              </fieldset>

              <fieldset className="parcel-card">
                <legend className="card-heading">Receiver</legend>
                <label>
                  Customer
                  <select
                    required
                    value={form.receiver_id}
                    onChange={(e) => setField("receiver_id", e.target.value)}
                  >
                    <option value="">Select receiver…</option>
                    {customers.map((c) => (
                      <option key={c.customer_id} value={c.customer_id}>
                        {c.full_name} ({c.customer_type})
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Destination address
                  <select
                    required
                    disabled={!receiver}
                    value={form.destination_address_id}
                    onChange={(e) => setField("destination_address_id", e.target.value)}
                  >
                    <option value="">Select destination…</option>
                    {receiver?.addresses.map((a) => (
                      <option key={a.address_id} value={a.address_id}>
                        {addressOption(a)}
                      </option>
                    ))}
                  </select>
                </label>
              </fieldset>

              <fieldset className="parcel-card">
                <legend className="card-heading">Package</legend>
                <label>
                  Service tier
                  <select
                    required
                    value={form.tier_id}
                    onChange={(e) => setField("tier_id", e.target.value)}
                  >
                    <option value="">Select tier…</option>
                    {tiers.map((t) => (
                      <option key={t.tier_id} value={t.tier_id}>
                        {t.tier_name} — {t.estimated_days}d, {peso(t.base_fee)} + {peso(t.base_rate_per_kg)}/kg
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Weight (kg)
                  <input
                    required
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={form.weight_kg}
                    onChange={(e) => setField("weight_kg", e.target.value)}
                  />
                </label>
                <label>
                  Dimensions
                  <input
                    type="text"
                    placeholder="e.g. 30x20x15 cm"
                    value={form.dimensions}
                    onChange={(e) => setField("dimensions", e.target.value)}
                  />
                </label>
                <label>
                  Distance (km)
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={form.total_distance_km}
                    onChange={(e) => setField("total_distance_km", e.target.value)}
                  />
                </label>
              </fieldset>

              <fieldset className="parcel-card">
                <legend className="card-heading">Payment</legend>
                <label>
                  Declared value (₱)
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0 = undeclared"
                    value={form.declared_value}
                    onChange={(e) => setField("declared_value", e.target.value)}
                  />
                </label>
                <label>
                  Method
                  <select
                    value={form.payment_method}
                    onChange={(e) => setField("payment_method", e.target.value)}
                  >
                    <option>COD</option>
                    <option>Prepaid</option>
                    <option>Online</option>
                  </select>
                </label>
                <div className="fee-preview">
                  <span className="field-label">Estimated shipping fee</span>
                  <span className="fee-amount">{feePreview != null ? peso(feePreview) : "—"}</span>
                </div>
              </fieldset>
            </div>

            {submitError && <div className="form-error">{submitError}</div>}

            <div className="book-actions">
              <button className="book-submit" type="submit" disabled={submitting}>
                {submitting ? "Booking…" : "Book Parcel"}
              </button>
            </div>
          </form>
        )}
      </div>
    </AppLayout>
  );
}
