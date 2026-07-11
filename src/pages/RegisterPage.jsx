import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { defaultPathForSession, redirectPathForRoles } from "../auth/roleAccess";
import AuthVisualPanel from "../components/ui/AuthVisualPanel";
import "./LoginPage.css";

const INITIAL_FORM = {
  full_name: "",
  email: "",
  password: "",
  business_name: "",
  business_type: "buyer",
};

export default function RegisterPage() {
  const { user, register: authRegister, activeRoles } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(INITIAL_FORM);
  const [showPassword, setShowPassword] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (user) {
    const defaultPath = redirectPathForRoles(activeRoles, user.global_role === "platform_admin");
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
      const stored = window.localStorage.getItem("linko-active-business");
      const defaultPath = defaultPathForSession(payload, stored);
      navigate(defaultPath, { replace: true });
    } catch (error) {
      setSubmitError(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-form-panel">
          <div className="auth-topbar">
            <Link to="/" className="auth-back-link">Back</Link>
            <div className="auth-brand-mark">
              LINK<span>O</span>
            </div>
          </div>

          <div className="auth-form-body">
            <h1 className="auth-heading">Sign Up</h1>

            <form onSubmit={handleSubmit} noValidate>
              <label className="auth-field">
                <span className="sr-only">Full name</span>
                <input
                  type="text"
                  required
                  autoComplete="name"
                  placeholder="Full name"
                  value={form.full_name}
                  onChange={(event) => setField("full_name", event.target.value)}
                />
              </label>

              <label className="auth-field">
                <span className="sr-only">Email</span>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="Email"
                  value={form.email}
                  onChange={(event) => setField("email", event.target.value)}
                />
              </label>

              <label className="auth-field">
                <span className="sr-only">Password</span>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  placeholder="Password (at least 8 characters)"
                  value={form.password}
                  onChange={(event) => setField("password", event.target.value)}
                />
                <button
                  type="button"
                  className="auth-visibility-toggle"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </label>

              <label className="auth-field">
                <span className="sr-only">Business name</span>
                <input
                  type="text"
                  required
                  autoComplete="organization"
                  placeholder="Business name"
                  value={form.business_name}
                  onChange={(event) => setField("business_name", event.target.value)}
                />
              </label>

              <label className="auth-field">
                <span className="sr-only">Business type</span>
                <select
                  value={form.business_type}
                  onChange={(event) => setField("business_type", event.target.value)}
                >
                  <option value="buyer">Buyer</option>
                  <option value="wholesaler">Wholesaler</option>
                </select>
              </label>

              {submitError && <p className="auth-error">{submitError}</p>}

              <button type="submit" className="auth-submit" disabled={submitting}>
                {submitting ? "Creating account..." : "Sign Up"}
              </button>
            </form>

            <p className="auth-alt">
              Already have an account? <Link to="/login">Log in</Link>
            </p>
          </div>
        </div>

        <AuthVisualPanel />
      </div>
    </div>
  );
}
