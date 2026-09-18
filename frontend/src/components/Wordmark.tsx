type Props = {
  // "lg": hero on the login / onboarding screens. "sm": centered header of the tab screens.
  size?: "lg" | "sm";
  // Small label above the mark, e.g. "WELCOME". Large size only.
  eyebrow?: string;
  // Large size only; pass "" to hide.
  tagline?: string;
};

// The app's wordmark: Fraunces italic with a green full stop.
export default function Wordmark({
  size = "lg",
  eyebrow,
  tagline = "Voice-first calorie coach",
}: Props) {
  const large = size === "lg";
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      {large && eyebrow && (
        <div className="text-green-text font-mono text-xs tracking-[0.16em]">{eyebrow}</div>
      )}
      <h1
        className={`font-display text-ink leading-none font-medium tracking-[-0.04em] italic ${
          large ? "text-[64px]" : "text-[30px]"
        }`}
        style={{ fontVariationSettings: '"SOFT" 100, "opsz" 144' }}
      >
        nutrition
        <span className="text-green not-italic">.</span>
      </h1>
      {large && tagline && (
        <div className="text-faint font-mono text-[11px] tracking-[0.18em] uppercase">
          {tagline}
        </div>
      )}
    </div>
  );
}
