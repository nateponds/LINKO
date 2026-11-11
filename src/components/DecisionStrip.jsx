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
        const content = (
          <>
            <span className="decision-strip-value">{loading ? "…" : value}</span>
            <span className="decision-strip-label">{item.label}</span>
          </>
        );
        // No `to`: a plain count for a page this viewer cannot open.
        return item.to ? (
          <Link key={item.key} to={item.to} className="decision-strip-item">{content}</Link>
        ) : (
          <div key={item.key} className="decision-strip-item">{content}</div>
        );
      })}
    </section>
  );
}
