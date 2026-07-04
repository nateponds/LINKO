import { useState } from "react";
import { Handshake, MapPin, ShieldCheck } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import "./LoginPage.css";

/* Standalone auth screen (no AppLayout shell). Mock only — submit just
   routes back into the app; swap for a real auth call later. */

const HIGHLIGHTS = [
  { Icon: MapPin, text: "Wholesalers matched to your location" },
  { Icon: Handshake, text: "Direct buyer–wholesaler connections" },
  { Icon: ShieldCheck, text: "Verified supplier profiles" },
];

export default function LoginPage() {
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const navigate = useNavigate();

  function handleSubmit(e) {
    e.preventDefault();
    navigate("/"); // swap for real auth later
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
          <div className="auth-tabs" role="tablist" aria-label="Authentication mode">
            <button
              role="tab"
              aria-selected={mode === "login"}
              className={mode === "login" ? "active" : ""}
              onClick={() => setMode("login")}
            >
              Log in
            </button>
            <button
              role="tab"
              aria-selected={mode === "signup"}
              className={mode === "signup" ? "active" : ""}
              onClick={() => setMode("signup")}
            >
              Sign up
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            {mode === "signup" && (
              <label>
                Business name
                <input type="text" required placeholder="e.g. Linko Trading Co." />
              </label>
            )}

            <label>
              Email
              <input type="email" required placeholder="you@business.com" />
            </label>

            <label>
              Password
              <input
                type="password"
                required
                minLength={8}
                placeholder={mode === "signup" ? "At least 8 characters" : "Your password"}
              />
            </label>

            {mode === "login" && (
              <a href="#" className="forgot-link">
                Forgot password?
              </a>
            )}

            <button type="submit" className="btn-primary">
              {mode === "login" ? "Log in" : "Create account"}
            </button>
          </form>

          <p className="auth-alt">
            {mode === "login" ? (
              <>
                New to LINKO?{" "}
                <button type="button" onClick={() => setMode("signup")}>
                  Create an account
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button type="button" onClick={() => setMode("login")}>
                  Log in
                </button>
              </>
            )}
          </p>

          <Link to="/" className="guest-link">
            Continue as guest →
          </Link>
        </div>
      </div>
    </div>
  );
}
