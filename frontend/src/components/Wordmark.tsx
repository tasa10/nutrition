type Props = {
  // Small label above the mark, e.g. "WELCOME" / "LV.1 スタート".
  eyebrow?: string;
  tagline?: string;
  align?: "left" | "center";
};

// The app's wordmark: Fraunces italic with a green full stop. Used on the login and onboarding screens.
export default function Wordmark({
  eyebrow,
  tagline = "Voice-first calorie coach",
  align = "left",
}: Props) {
  const centered = align === "center";
  return (
    <div className={`flex flex-col gap-2 ${centered ? "items-center text-center" : ""}`}>
      {eyebrow && (
        <div className="text-green-text font-mono text-xs tracking-[0.16em]">{eyebrow}</div>
      )}
      <h1
        className="font-display text-ink text-[64px] leading-none font-medium tracking-[-0.04em] italic"
        style={{ fontVariationSettings: '"SOFT" 100, "opsz" 144' }}
      >
        nutrition
        <span className="text-green not-italic">.</span>
      </h1>
      {tagline && (
        <div className="text-faint font-mono text-[11px] tracking-[0.18em] uppercase">
          {tagline}
        </div>
      )}
    </div>
  );
}
