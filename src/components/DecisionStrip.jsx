import { Link } from "react-router-dom";
import "./DecisionStrip.css";

export default function DecisionStrip({ label, items, loading = false, error = null }) {
  if (error) {
    return <p className="decision-strip-error">Could not load decisions: {error}</p>;
  }

  return (
    <section className="decision-strip" aria-label={label} aria-busy={loading}>
      {items.map((item) => {
        const value = Number(item.value ?? 0);
        const hint = !loading && value === 0 ? item.empty : item.hint;
        return (
          <Link key={item.key} to={item.to} className="decision-strip-item">
            <span className="decision-strip-value">{loading ? "…" : value}</span>
            <span className="decision-strip-label">{item.label}</span>
            <span className="decision-strip-hint">{hint}</span>
          </Link>
        );
      })}
    </section>
  );
}
