import { useState } from "react";
import { BadgeCheck, Handshake, MapPin, Store } from "lucide-react";
import { Link } from "react-router-dom";
import AppLayout from "../layouts/AppLayout";
import "./BecomeSupplierPage.css";

/* Field names mirror POST /api/suppliers (docs/API_CONTRACTS.md) so this
   form can submit to the real endpoint later without reshaping. */
const EMPTY_FORM = {
  business_name: "",
  contact_number: "",
  address_line: "",
  city: "",
  minimum_order_quantity: "",
  lead_time_days: "",
  delivery_terms: "",
};

const PERKS = [
  {
    Icon: Store,
    title: "Reach more buyers",
    desc: "Your catalog gets discovered by MSMEs and businesses across the Philippines.",
  },
  {
    Icon: MapPin,
    title: "Matched by proximity",
    desc: "LINKO ranks you for buyers near your location, so nearby demand finds you first.",
  },
  {
    Icon: Handshake,
    title: "Tools included",
    desc: "Inventory, orders, invoices, and wait lists come built in — no extra software.",
  },
];

export default function BecomeSupplierPage() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitted, setSubmitted] = useState(false);

  function setField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    setSubmitted(true); // swap for POST /api/suppliers later
  }

  return (
    <AppLayout>
      <div className="become-supplier-page">
        <div className="supplier-hero">
          <h1>Sell wholesale on LINKO</h1>
          <p>
            Register your business as a wholesaler and start receiving orders
            from buyers near you.
          </p>
        </div>

        <div className="supplier-columns">
          <div className="perks-col">
            {PERKS.map(({ Icon, title, desc }) => (
              <div className="perk-card" key={title}>
                <span className="perk-icon">
                  <Icon size={22} />
                </span>
                <div>
                  <h3>{title}</h3>
                  <p>{desc}</p>
                </div>
              </div>
            ))}
          </div>

          {submitted ? (
            <div className="form-card success-card">
              <BadgeCheck size={44} />
              <h2>Application received!</h2>
              <p>
                <strong>{form.business_name}</strong> is now pending
                verification. Our team reviews new wholesalers within 2–3
                business days and will reach out at{" "}
                <strong>{form.contact_number}</strong>.
              </p>
              <Link to="/" className="btn-primary">
                Back to marketplace
              </Link>
            </div>
          ) : (
            <form className="form-card" onSubmit={handleSubmit}>
              <h2>Wholesaler application</h2>

              <label>
                Business name
                <input
                  type="text"
                  required
                  placeholder="e.g. Global Metalworks Ltd"
                  value={form.business_name}
                  onChange={(e) => setField("business_name", e.target.value)}
                />
              </label>

              <label>
                Contact number
                <input
                  type="tel"
                  required
                  placeholder="+63 917 123 4567"
                  value={form.contact_number}
                  onChange={(e) => setField("contact_number", e.target.value)}
                />
              </label>

              <div className="field-row">
                <label>
                  Address line
                  <input
                    type="text"
                    required
                    placeholder="e.g. Industrial Zone B"
                    value={form.address_line}
                    onChange={(e) => setField("address_line", e.target.value)}
                  />
                </label>
                <label>
                  City
                  <input
                    type="text"
                    required
                    placeholder="e.g. Cebu"
                    value={form.city}
                    onChange={(e) => setField("city", e.target.value)}
                  />
                </label>
              </div>

              <div className="field-row">
                <label>
                  Minimum order quantity
                  <input
                    type="number"
                    min="1"
                    required
                    placeholder="e.g. 100"
                    value={form.minimum_order_quantity}
                    onChange={(e) =>
                      setField("minimum_order_quantity", e.target.value)
                    }
                  />
                </label>
                <label>
                  Lead time (days)
                  <input
                    type="number"
                    min="0"
                    required
                    placeholder="e.g. 10"
                    value={form.lead_time_days}
                    onChange={(e) => setField("lead_time_days", e.target.value)}
                  />
                </label>
              </div>

              <label>
                Delivery terms
                <input
                  type="text"
                  required
                  placeholder="e.g. CIF Cebu Port"
                  value={form.delivery_terms}
                  onChange={(e) => setField("delivery_terms", e.target.value)}
                />
              </label>

              <button type="submit" className="btn-primary">
                Submit application
              </button>
              <p className="form-note">
                New wholesalers start with a pending verification status until
                reviewed.
              </p>
            </form>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
