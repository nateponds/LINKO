import { useState } from "react";
import { Handshake, MapPin, ShieldCheck } from "lucide-react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import "./LoginPage.css";

const HIGHLIGHTS = [
  { Icon: MapPin, text: "Wholesalers matched to your location" },
  { Icon: Handshake, text: "Direct buyer-wholesaler connections" },
  { Icon: ShieldCheck, text: "Verified supplier profiles" },
];

const INITIAL_FORM = {
  full_name: "",
  email: "",
  password: "",
  business_name: "",
  business_type: "buyer",
};

export default function RegisterPage() {
  const { user, register: authRegister, hasAnyRole } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(INITIAL_FORM);
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (user) {
    const defaultPath = (hasAnyRole(["buyer"]) && !hasAnyRole(["wholesaler", "platform_admin", "logistics_coordinator", "courier"])) ? "/" : "/dashboard";
    return <Navigate to={defaultPath} replace />;
  }

  function setField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitError("");
    setSubmitting(true);

    try {
      const payload = await authRegister({
        email: form.email.trim(),
        password: form.password,
        full_name: form.full_name.trim(),
        business_name: form.business_name.trim(),
        business_type: form.business_type,
      });
      const roles = payload.memberships?.map((m) => m.role) || [];
      const isBuyer = roles.includes("buyer");
      const hasOtherRoles = roles.some(r => r !== "buyer") || payload.user.global_role === "platform_admin";
      
      const defaultPath = (isBuyer && !hasOtherRoles) ? "/" : "/dashboard";
      navigate(defaultPath, { replace: true });
    } catch (error) {
      setSubmitError(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <div className="logo">
            LINK<span className="logo-accent">O</span>
          </div>
          <p className="brand-tagline">
            The marketplace connecting MSMEs with trusted wholesalers.
          </p>
          <ul className="brand-points">
            {HIGHLIGHTS.map(({ Icon, text }) => (
              <li key={text}>
                <Icon size={16} /> {text}
              </li>
            ))}
          </ul>
        </div>

        <div className="login-form-side">
          <div className="auth-page-header">
            <h1>Create account</h1>
            <p>Set up your buyer, wholesaler, or hybrid workspace.</p>
          </div>

          <form onSubmit={handleSubmit}>
            <label>
              Full name
              <input
                type="text"
                required
                autoComplete="name"
                placeholder="Your full name"
                value={form.full_name}
                onChange={(event) => setField("full_name", event.target.value)}
              />
            </label>

            <label>
              Email
              <input
                type="email"
                required
                autoComplete="email"
                placeholder="you@business.com"
                value={form.email}
                onChange={(event) => setField("email", event.target.value)}
              />
            </label>

            <label>
              Password
              <input
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                placeholder="At least 8 characters"
                value={form.password}
                onChange={(event) => setField("password", event.target.value)}
              />
            </label>

            <label>
              Business name
              <input
                type="text"
                required
                autoComplete="organization"
                placeholder="e.g. Linko Trading Co."
                value={form.business_name}
                onChange={(event) => setField("business_name", event.target.value)}
              />
            </label>

            <label>
              Business type
              <select
                value={form.business_type}
                onChange={(event) => setField("business_type", event.target.value)}
              >
                <option value="buyer">Buyer</option>
                <option value="wholesaler">Wholesaler</option>
                <option value="both">Both (Buyer &amp; Wholesaler)</option>
              </select>
            </label>

            {submitError && <p className="auth-error">{submitError}</p>}

            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? "Creating account..." : "Create account"}
            </button>
          </form>

          <p className="auth-alt">
            Already have an account? <Link to="/login">Log in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
