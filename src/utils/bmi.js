// BMI math, unit conversions, and id generation helpers.

const LBS_PER_KG = 2.2046226218487757;
const CM_PER_INCH = 2.54;

const round1 = (n) => Math.round(n * 10) / 10;

/**
 * Calculate BMI from height (cm) and weight (kg).
 * Returns the BMI rounded to 1 decimal place.
 */
export function calculateBMI(heightCm, weightKg) {
  const h = Number(heightCm);
  const w = Number(weightKg);
  if (!Number.isFinite(h) || h <= 0) {
    throw new Error("heightCm must be a positive number.");
  }
  if (!Number.isFinite(w) || w <= 0) {
    throw new Error("weightKg must be a positive number.");
  }
  const meters = h / 100;
  return round1(w / (meters * meters));
}

// WHO BMI categories and their accent colors (matches our design tokens
// where applicable; "Obese" uses Tailwind red-500 since the spec calls
// for red and we don't have a red brand token).
export const BMI_CATEGORIES = Object.freeze({
  underweight: {
    category: "Underweight",
    color: "#3b82f6", // accent-blue
    description:
      "BMI below 18.5. Consider adding nutrient-dense, calorie-rich foods to support healthy weight gain.",
  },
  normal: {
    category: "Normal",
    color: "var(--accent-green)", // accent-green
    description:
      "BMI between 18.5 and 24.9. You're in a healthy range — keep building consistent habits.",
  },
  overweight: {
    category: "Overweight",
    color: "#f97316", // accent-orange
    description:
      "BMI between 25 and 29.9. Small daily changes in nutrition and movement add up over time.",
  },
  obese: {
    category: "Obese",
    color: "#ef4444", // red-500
    description:
      "BMI 30 or higher. Talk to a healthcare provider and focus on sustainable lifestyle changes.",
  },
});

export const BMI_THRESHOLDS = Object.freeze({
  underweight: 18.5,
  normal: 25,
  overweight: 30,
});

/**
 * Returns the category descriptor for a given BMI value:
 *   { category, color, description }
 */
export function getBMICategory(bmi) {
  const value = Number(bmi);
  if (!Number.isFinite(value)) {
    throw new Error("bmi must be a finite number.");
  }
  if (value < BMI_THRESHOLDS.underweight) return BMI_CATEGORIES.underweight;
  if (value < BMI_THRESHOLDS.normal) return BMI_CATEGORIES.normal;
  if (value < BMI_THRESHOLDS.overweight) return BMI_CATEGORIES.overweight;
  return BMI_CATEGORIES.obese;
}

/**
 * Convert centimeters to { feet, inches }, rounded to whole inches.
 * Carries the rollover when 12in rounds up to a full foot.
 */
export function cmToFeetInches(cm) {
  const value = Number(cm);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error("cm must be a non-negative number.");
  }
  const totalInches = value / CM_PER_INCH;
  let feet = Math.floor(totalInches / 12);
  let inches = Math.round(totalInches - feet * 12);
  if (inches === 12) {
    feet += 1;
    inches = 0;
  }
  return { feet, inches };
}

/**
 * Convert { feet, inches } to centimeters, rounded to 1 decimal place.
 */
export function feetInchesToCm(feet, inches) {
  const f = Number(feet) || 0;
  const i = Number(inches) || 0;
  if (f < 0 || i < 0) {
    throw new Error("feet and inches must be non-negative.");
  }
  const totalInches = f * 12 + i;
  return round1(totalInches * CM_PER_INCH);
}

/**
 * Convert pounds → kilograms, rounded to 1 decimal place.
 */
export function lbsToKg(lbs) {
  const value = Number(lbs);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error("lbs must be a non-negative number.");
  }
  return round1(value / LBS_PER_KG);
}

/**
 * Convert kilograms → pounds, rounded to 1 decimal place.
 */
export function kgToLbs(kg) {
  const value = Number(kg);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error("kg must be a non-negative number.");
  }
  return round1(value * LBS_PER_KG);
}

/**
 * Short, collision-resistant id (timestamp + 6 random base-36 chars).
 * e.g. "lq8z3t4-7mh2pe"
 */
export function generateId() {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8).padEnd(6, "0");
  return `${ts}-${rand}`;
}
