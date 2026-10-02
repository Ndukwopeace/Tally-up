/**
 * The Tally-Up logo: delivery truck carrying bread, and the "Tally-Up" wordmark.
 *
 * WHY:  Owner decision Q-45: use the logo from the wireframes. One component is
 *       used in every header and the sidebar, and draws from the same shape list
 *       as the app icons (scripts/generate-icons.mjs), so screen and installed
 *       icon always match.
 * HOW:  Renders each shape in src/assets/logo-shapes.json as SVG (no network
 *       request). The wordmark is real text: "Tally-" in brand blue (white on the
 *       dark sidebar) and "Up" in the orange accent, as in the wireframes.
 * WHEN: Portal headers, admin sidebar, start page.
 * SECURITY: Static markup only; shape data is a file in the repository, not user input.
 *       Note: the orange "Up" is below 4.5:1 on white. WCAG 1.4.3 exempts text
 *       that is part of a logo, and the accent colour is used nowhere else.
 */
import logo from "@/assets/logo-shapes.json";
import { cn } from "@/lib/cn";

type Shape = (typeof logo.shapes)[number];

// Turns one entry of the shape list into its SVG element.
function renderShape(shape: Shape, index: number) {
  switch (shape.type) {
    case "circle":
      return <circle key={index} cx={shape.cx} cy={shape.cy} r={shape.r} fill={shape.fill} />;
    case "roundRect":
      return (
        <rect
          key={index}
          x={shape.x}
          y={shape.y}
          width={shape.w}
          height={shape.h}
          rx={shape.r}
          fill={shape.fill}
        />
      );
    default:
      // "line": a stroke with round ends (the truck's speed lines).
      return (
        <line
          key={index}
          x1={shape.x1}
          y1={shape.y1}
          x2={shape.x2}
          y2={shape.y2}
          stroke={shape.fill}
          strokeWidth={shape.width}
          strokeLinecap="round"
        />
      );
  }
}

export function AppLogo({ tone = "onLight" }: { tone?: "onLight" | "onDark" }) {
  return (
    <span className="inline-flex items-center gap-2 text-xl font-extrabold tracking-tight">
      {/* Decorative: the wordmark next to it is the accessible name. */}
      <svg aria-hidden="true" viewBox={logo.viewBox} className="h-8 w-12 shrink-0">
        {logo.shapes.map(renderShape)}
      </svg>
      <span>
        <span className={cn(tone === "onLight" ? "text-brand" : "text-white")}>Tally-</span>
        <span className="text-accent">Up</span>
      </span>
    </span>
  );
}
