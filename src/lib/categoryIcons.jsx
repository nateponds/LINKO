import {
  Beef,
  CupSoda,
  Croissant,
  Carrot,
  Drumstick,
  Fish,
  Ham,
  Milk,
  Package,
  Popcorn,
  Shell,
  Snowflake,
  Utensils,
} from "lucide-react";

/* Category name -> icon component. Falls back to a generic utensils glyph
   for any category not explicitly listed here. */
const CATEGORY_ICONS = {
  Pork: Ham,
  Beef: Beef,
  Chicken: Drumstick,
  Chips: Popcorn,
  Fish: Fish,
  Shellfish: Shell,
  Produce: Carrot,
  Bakery: Croissant,
  Dairy: Milk,
  Frozen: Snowflake,
  Packaging: Package,
  Beverages: CupSoda,
};

export function iconForCategory(name) {
  return CATEGORY_ICONS[name] ?? Utensils;
}
