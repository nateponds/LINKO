import { useMemo, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { defaultPathForSession, redirectPathForRoles } from "../auth/roleAccess";
import AuthVisualPanel from "../components/ui/AuthVisualPanel";
import "./LoginPage.css";

export default function LoginPage() {
  const { user, login, activeRoles } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const redirectTo = useMemo(
    () => location.state?.from?.pathname || null,
    [location.state],
  );

  if (user) {
    const defaultPath = redirectPathForRoles(activeRoles, user.global_role === "platform_admin");
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
      const stored = window.localStorage.getItem("linko-active-business");
      const defaultPath = defaultPathForSession(payload, stored);
      navigate(redirectTo || defaultPath, { replace: true });
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
            <h1 className="auth-heading">Login</h1>

            <form onSubmit={handleSubmit} noValidate>
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
                  autoComplete="current-password"
                  placeholder="Password"
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

              {submitError && <p className="auth-error">{submitError}</p>}

              <button type="submit" className="auth-submit" disabled={submitting}>
                {submitting ? "Logging in..." : "Login"}
              </button>
            </form>

            <p className="auth-alt">
              Doesn&apos;t have an account? <Link to="/register">Sign Up</Link>
            </p>
          </div>
        </div>

        <AuthVisualPanel />
      </div>
    </div>
  );
}
