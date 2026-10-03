export const MEAL_IDS = ["breakfast", "lunch", "dinner", "snack"];

const MEAL_LABEL = {
  breakfast: "tracker.mealBreakfast",
  lunch: "tracker.mealLunch",
  dinner: "tracker.mealDinner",
  snack: "tracker.mealSnack",
};

export function mealLabelKey(id) {
  return MEAL_LABEL[id] || "tracker.mealOther";
}

/** Call from an event handler. Picks a meal from the current hour. */
export function mealForNow() {
  const hour = new Date().getHours();
  if (hour < 11) return "breakfast";
  if (hour < 16) return "lunch";
  if (hour < 21) return "dinner";
  return "snack";
}

export { MEAL_LABEL };
