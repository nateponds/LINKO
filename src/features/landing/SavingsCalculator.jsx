import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { calculateSavings, convertFromPhp } from "./savings";

const USD_EXCHANGE_RATE = 58;

function formatCurrency(value, currency) {
  return new Intl.NumberFormat(currency === "PHP" ? "en-PH" : "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export default function SavingsCalculator() {
  const [monthlySpend, setMonthlySpend] = useState(450_000);
  const [orderVolume, setOrderVolume] = useState(420);
  const [currency, setCurrency] = useState("PHP");
  const reduceMotion = useReducedMotion();

  const savings = useMemo(
    () => calculateSavings(monthlySpend, orderVolume),
    [monthlySpend, orderVolume],
  );
  const displayAnnualSpend = convertFromPhp(
    savings.annualSpend,
    currency,
    USD_EXCHANGE_RATE,
  );
  const displayAnnualSavings = convertFromPhp(
    savings.annualSavings,
    currency,
    USD_EXCHANGE_RATE,
  );
  const displayLinkoCost = convertFromPhp(
    savings.linkoCost,
    currency,
    USD_EXCHANGE_RATE,
  );

  return (
    <div className="savings-card">
      <div className="savings-controls">
        <div className="savings-heading-row">
          <h3>Your numbers</h3>
          <div className="currency-toggle" role="group" aria-label="Select calculator currency">
            {["PHP", "USD"].map((option) => (
              <button
                key={option}
                type="button"
                className={currency === option ? "is-active" : ""}
                onClick={() => setCurrency(option)}
                aria-pressed={currency === option}
              >
                {option === "PHP" ? "₱ PHP" : "$ USD"}
              </button>
            ))}
          </div>
        </div>

        <label className="range-field">
          <span>
            Monthly inventory spend
            <strong>
              {formatCurrency(
                convertFromPhp(monthlySpend, currency, USD_EXCHANGE_RATE),
                currency,
              )}
            </strong>
          </span>
          <input
            type="range"
            min="50000"
            max="2000000"
            step="25000"
            value={monthlySpend}
            onChange={(event) => setMonthlySpend(Number(event.target.value))}
          />
          <small>
            <span>{currency === "PHP" ? "₱50,000" : "$862"}</span>
            <span>{currency === "PHP" ? "₱2,000,000" : "$34,483"}</span>
          </small>
        </label>

        <label className="range-field">
          <span>
            Average order volume
            <strong>{orderVolume.toLocaleString()} units</strong>
          </span>
          <input
            type="range"
            min="50"
            max="1000"
            step="10"
            value={orderVolume}
            onChange={(event) => setOrderVolume(Number(event.target.value))}
          />
          <small>
            <span>50 units</span>
            <span>1,000 units</span>
          </small>
        </label>
      </div>

      <div className="savings-result" aria-live="polite">
        <p className="result-label">Estimated annual savings</p>
        <motion.strong
          key={`${currency}-${Math.round(displayAnnualSavings)}`}
          initial={reduceMotion ? false : { opacity: 0.45 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="savings-total"
        >
          {formatCurrency(displayAnnualSavings, currency)}
        </motion.strong>
        <p className="savings-rate">
          Volume rate used: {(savings.savingsRate * 100).toFixed(1)}%. A larger order uses a higher rate, up to 32%.
        </p>

        <dl className="cost-pair">
          <div>
            <dt>Traditional sourcing, a year</dt>
            <dd>{formatCurrency(displayAnnualSpend, currency)}</dd>
          </div>
          <div>
            <dt>Same spend with the rate applied</dt>
            <dd>{formatCurrency(displayLinkoCost, currency)}</dd>
          </div>
        </dl>

        <p className="calculator-note">
          USD uses an illustrative rate of ₱58. Actual prices depend on the product, the place, and the wholesaler.
        </p>
      </div>
    </div>
  );
}
