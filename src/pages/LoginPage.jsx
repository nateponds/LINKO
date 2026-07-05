import { useMemo, useState } from "react";
import { Handshake, MapPin, ShieldCheck } from "lucide-react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import "./LoginPage.css";

const HIGHLIGHTS = [
  { Icon: MapPin, text: "Wholesalers matched to your location" },
  { Icon: Handshake, text: "Direct buyer-wholesaler connections" },
  { Icon: ShieldCheck, text: "Verified supplier profiles" },
];

export default function LoginPage() {
  const { user, login, hasAnyRole } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const redirectTo = useMemo(
    () => location.state?.from?.pathname || null,
    [location.state],
  );

  if (user) {
    const defaultPath = (hasAnyRole(["buyer"]) && !hasAnyRole(["wholesaler", "platform_admin", "logistics_coordinator", "courier"])) ? "/" : "/dashboard";
    return <Navigate to={redirectTo || defaultPath} replace />;
  }

  function setField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitError("");
    setSubmitting(true);

    try {
      const payload = await login({
        email: form.email.trim(),
        password: form.password,
      });
      const roles = payload.memberships?.map((m) => m.role) || [];
      const isBuyer = roles.includes("buyer");
      const hasOtherRoles = roles.some(r => r !== "buyer") || payload.user.global_role === "platform_admin";
      
      const defaultPath = (isBuyer && !hasOtherRoles) ? "/" : "/dashboard";
      navigate(redirectTo || defaultPath, { replace: true });
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
            <h1>Log in</h1>
            <p>Access your buyer or wholesaler workspace.</p>
          </div>

          <form onSubmit={handleSubmit}>
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
                autoComplete="current-password"
                placeholder="Your password"
                value={form.password}
                onChange={(event) => setField("password", event.target.value)}
              />
            </label>

            {submitError && <p className="auth-error">{submitError}</p>}

            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? "Logging in..." : "Log in"}
            </button>
          </form>

          <p className="auth-alt">
            New to LINKO? <Link to="/register">Create an account</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
