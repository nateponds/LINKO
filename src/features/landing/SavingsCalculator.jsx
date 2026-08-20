import { useMemo, useState } from "react";
import confetti from "canvas-confetti";
import { motion } from "framer-motion";
import { ArrowUpRight, Sparkles } from "lucide-react";
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
  const [celebrated, setCelebrated] = useState(false);

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
  const linkoBarWidth = Math.round((savings.linkoCost / savings.annualSpend) * 100);

  function celebrateSavings() {
    setCelebrated(true);
    confetti({
      particleCount: 120,
      spread: 75,
      origin: { y: 0.72 },
      colors: ["#98d868", "#3050a0", "#d9e3fb"],
      disableForReducedMotion: true,
    });
  }

  return (
    <div className="savings-card">
      <div className="savings-controls">
        <div className="savings-heading-row">
          <div>
            <span className="eyebrow eyebrow--dark">ROI ESTIMATOR</span>
            <h3>See what smarter sourcing saves.</h3>
          </div>
          <div className="currency-toggle" aria-label="Select calculator currency">
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
            <span>{currency === "PHP" ? "₱50K" : "$862"}</span>
            <span>{currency === "PHP" ? "₱2M" : "$34.5K"}</span>
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

        <p className="calculator-note">
          Estimate based on representative wholesale tier improvements. Actual
          savings vary by product, location, and wholesaler.
        </p>
      </div>

      <div className="savings-result">
        <span className="result-kicker">YOUR ESTIMATED ANNUAL SAVINGS</span>
        <motion.strong
          key={`${currency}-${Math.round(displayAnnualSavings)}`}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="savings-total"
        >
          {formatCurrency(displayAnnualSavings, currency)}
        </motion.strong>
        <span className="savings-percent">
          <Sparkles size={16} aria-hidden="true" />
          {(savings.savingsRate * 100).toFixed(1)}% potential cost reduction
        </span>

        <div className="cost-bars" aria-label="Annual cost comparison">
          <div className="cost-row">
            <div>
              <span>Traditional sourcing</span>
              <strong>{formatCurrency(displayAnnualSpend, currency)}</strong>
            </div>
            <div className="cost-track">
              <motion.span
                className="cost-fill cost-fill--traditional"
                animate={{ width: "100%" }}
              />
            </div>
          </div>
          <div className="cost-row">
            <div>
              <span>With LINKO</span>
              <strong>{formatCurrency(displayLinkoCost, currency)}</strong>
            </div>
            <div className="cost-track">
              <motion.span
                className="cost-fill cost-fill--linko"
                animate={{ width: `${linkoBarWidth}%` }}
              />
            </div>
          </div>
        </div>

        <button type="button" className="claim-button" onClick={celebrateSavings}>
          {celebrated ? "Savings unlocked" : "Claim your savings"}
          <ArrowUpRight size={18} aria-hidden="true" />
        </button>
        <span className="sr-only" aria-live="polite">
          {celebrated ? "Your savings estimate is ready to claim." : ""}
        </span>
      </div>
    </div>
  );
}
