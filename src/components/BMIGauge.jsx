import { useEffect, useState } from "react";

import { useLanguage } from "../context/LanguageContext.jsx";

// SVG geometry. The arc is drawn as a semicircle in the upper half of
// the viewBox, with the needle pivoting at (CX, CY).
const VIEW_W = 220;
const VIEW_H = 140;
const CX = 110;
const CY = 120;
const R = 88;
const STROKE = 14;

// BMI scale shown on the arc.
const MIN_BMI = 10;
const MAX_BMI = 40;

// Color zones along the arc (from low to high BMI). Boundaries follow
// the WHO categories: <18.5, 18.5–24.9, 25–29.9, ≥30.
const ZONES = [
  { from: 10, to: 18.5, color: "#3b82f6" }, // blue – underweight
  { from: 18.5, to: 25, color: "var(--accent-green)" }, // green – normal
  { from: 25, to: 30, color: "#f97316" },   // orange – overweight
  { from: 30, to: 40, color: "#ef4444" },   // red – obese
];

// Math angle (CCW from +x, degrees) for a given BMI value.
//   BMI 10 → 180° (left), BMI 25 → 90° (top), BMI 40 → 0° (right).
function bmiToAngle(bmi) {
  const clamped = Math.max(MIN_BMI, Math.min(MAX_BMI, Number(bmi)));
  const t = (clamped - MIN_BMI) / (MAX_BMI - MIN_BMI);
  return 180 - t * 180;
}

function polar(angleDeg, r = R) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: CX + r * Math.cos(rad), y: CY - r * Math.sin(rad) };
}

// SVG `A` arc going from `startAngle` to `endAngle` (math degrees) along
// the upper semicircle. We use sweep-flag = 1 because in SVG coordinates
// (y down) traversing 180°→0° via the top corresponds to *increasing*
// SVG-space angle.
function arcPath(startAngle, endAngle, r = R) {
  const a = polar(startAngle, r);
  const b = polar(endAngle, r);
  const largeArc = Math.abs(startAngle - endAngle) > 180 ? 1 : 0;
  return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
}

export default function BMIGauge({
  bmi,
  category,
  color = "var(--accent-green)",
  label,
}) {
  const { t } = useLanguage();
  const numericBmi = Number(bmi);
  const hasBmi = Number.isFinite(numericBmi);
  const targetBmi = hasBmi ? numericBmi : MIN_BMI;

  // Animate the needle from MIN_BMI on first render to the actual value.
  // Re-runs whenever the target changes so transitions chain smoothly.
  const [animatedBmi, setAnimatedBmi] = useState(MIN_BMI);
  useEffect(() => {
    const id = requestAnimationFrame(() => setAnimatedBmi(targetBmi));
    return () => cancelAnimationFrame(id);
  }, [targetBmi]);

  const needleAngle = bmiToAngle(animatedBmi);
  // CSS rotation for a needle initially drawn pointing up: rotating by
  // (90 - needleAngle) deg lines it up with the math angle on the arc.
  const needleRotate = 90 - needleAngle;

  const displayBmi = hasBmi ? numericBmi.toFixed(1) : "—";

  return (
    <div className="flex flex-col items-center">
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="w-full max-w-[320px]"
        role="img"
        aria-label={label || t("bmi.gaugeLabel", { bmi: displayBmi })}
      >
        <path
          d={arcPath(180, 0)}
          fill="none"
          stroke="var(--gauge-track)"
          strokeWidth={STROKE}
          strokeLinecap="round"
        />

        {ZONES.map((z) => (
          <path
            key={z.from}
            d={arcPath(bmiToAngle(z.from), bmiToAngle(z.to))}
            fill="none"
            stroke={z.color}
            strokeWidth={STROKE}
            strokeLinecap="butt"
          />
        ))}

        <text
          x={CX - R - 2}
          y={CY + 16}
          textAnchor="middle"
          fontSize="9"
          fill="var(--text-secondary)"
        >
          10
        </text>
        <text
          x={CX}
          y={CY - R - 8}
          textAnchor="middle"
          fontSize="9"
          fill="var(--text-secondary)"
        >
          25
        </text>
        <text
          x={CX + R + 2}
          y={CY + 16}
          textAnchor="middle"
          fontSize="9"
          fill="var(--text-secondary)"
        >
          40
        </text>

        <g
          style={{
            transform: `rotate(${needleRotate}deg)`,
            transformOrigin: `${CX}px ${CY}px`,
            transition: "transform 900ms cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        >
          <line
            x1={CX}
            y1={CY}
            x2={CX}
            y2={CY - (R - 8)}
            stroke="var(--text-primary)"
            strokeWidth={3}
            strokeLinecap="round"
          />
          <circle cx={CX} cy={CY} r={7} fill="var(--text-primary)" />
          <circle cx={CX} cy={CY} r={3} fill="var(--bg-primary)" />
        </g>
      </svg>

      <div className="mt-2 flex flex-col items-center">
        <span className="text-4xl font-bold tabular-nums text-[var(--text-primary)] sm:text-5xl">
          {displayBmi}
        </span>
        {category ? (
          <span
            className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] rtl:normal-case rtl:tracking-normal"
            style={{ color }}
          >
            {category}
          </span>
        ) : null}
      </div>
    </div>
  );
}
