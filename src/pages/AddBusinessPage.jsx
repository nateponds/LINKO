import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { redirectPathForRoles } from "../auth/roleAccess";
import { apiSend } from "../lib/api";
import AuthVisualPanel from "../components/ui/AuthVisualPanel";
import "./LoginPage.css";

export default function AddBusinessPage() {
  const { refreshAuth } = useAuth();
  const navigate = useNavigate();
  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState("buyer");
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitError("");
    setSubmitting(true);
    try {
      const membership = await apiSend("/api/businesses", {
        body: { business_name: businessName.trim(), business_type: businessType },
      });
      const session = await refreshAuth(membership.business_id);
      if (!session) throw new Error("Business created. Log in again to select it.");
      navigate(redirectPathForRoles([membership.role]), { replace: true });
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
            <Link to="/" className="auth-back-link">Back to LINKO</Link>
            <div className="auth-brand-mark">LINK<span>O</span></div>
          </div>
          <div className="auth-form-body">
            <h1 className="auth-heading">Add a business</h1>
            <form onSubmit={handleSubmit}>
              <label className="auth-field">
                <span className="auth-label">Business name</span>
                <input type="text" required autoComplete="organization" placeholder="Business name"
                  value={businessName} onChange={(event) => setBusinessName(event.target.value)} />
              </label>
              <label className="auth-field">
                <span className="auth-label">Business type</span>
                <select value={businessType} onChange={(event) => setBusinessType(event.target.value)}>
                  <option value="buyer">Buyer</option>
                  <option value="wholesaler">Wholesaler</option>
                </select>
              </label>
              {submitError && <p className="auth-error" role="alert">{submitError}</p>}
              <button type="submit" className="auth-submit" disabled={submitting}>
                {submitting ? "Adding business..." : "Add a business"}
              </button>
            </form>
          </div>
        </div>
        <AuthVisualPanel />
      </div>
    </div>
  );
}
