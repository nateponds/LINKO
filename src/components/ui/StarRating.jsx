import { Star } from "lucide-react";

const STAR_YELLOW = "#fbbf24";
const STAR_EMPTY = "#c8cdd8";

/**
 * Five-star rating row. Filled stars are yellow; the rest stay as
 * muted outlines. Pass showValue to append the numeric rating.
 */
function StarRating({ rating, outOf = 5, size = 16, showValue = false }) {
  const filled = Math.round(rating);

  return (
    <span
      className="star-rating"
      role="img"
      aria-label={`Rated ${rating} out of ${outOf} stars`}
    >
      {Array.from({ length: outOf }, (_, i) => (
        <Star
          key={i}
          size={size}
          color={i < filled ? STAR_YELLOW : STAR_EMPTY}
          fill={i < filled ? STAR_YELLOW : "none"}
          strokeWidth={1.5}
        />
      ))}
      {showValue && (
        <span className="star-rating__value">{Number(rating).toFixed(1)}</span>
      )}
    </span>
  );
}

export default StarRating;
