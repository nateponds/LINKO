const MIN_ORDER_VOLUME = 50;
const MAX_ORDER_VOLUME = 1_000;
const MIN_SAVINGS_RATE = 0.15;
const MAX_SAVINGS_RATE = 0.32;

export function getSavingsRate(orderVolume) {
  const boundedVolume = Math.min(
    MAX_ORDER_VOLUME,
    Math.max(MIN_ORDER_VOLUME, Number(orderVolume) || 0),
  );
  const progress =
    (boundedVolume - MIN_ORDER_VOLUME) /
    (MAX_ORDER_VOLUME - MIN_ORDER_VOLUME);

  return Number(
    (MIN_SAVINGS_RATE + progress * (MAX_SAVINGS_RATE - MIN_SAVINGS_RATE)).toFixed(4),
  );
}

export function calculateSavings(monthlySpend, orderVolume) {
  const annualSpend = Math.max(0, Number(monthlySpend) || 0) * 12;
  const savingsRate = getSavingsRate(orderVolume);
  const annualSavings = Math.round(annualSpend * savingsRate);

  return {
    annualSpend,
    annualSavings,
    linkoCost: annualSpend - annualSavings,
    savingsRate,
  };
}

export function convertFromPhp(value, currency, exchangeRate = 58) {
  return currency === "USD" ? value / exchangeRate : value;
}
