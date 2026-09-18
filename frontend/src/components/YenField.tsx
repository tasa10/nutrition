type Props = {
  // Digits only; "" means not entered. Parse with parseYen().
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  placeholder?: string;
  disabled?: boolean;
  // "lg" matches the full-width form fields on the onboarding screen.
  size?: "md" | "lg";
  // Layout only (width / flex); the look comes from `size`.
  className?: string;
};

// A yen amount input with the ¥ sign inside the field.
export default function YenField({
  value,
  onChange,
  ariaLabel,
  placeholder = "0",
  disabled,
  size = "md",
  className = "",
}: Props) {
  const large = size === "lg";
  return (
    <div
      className={`border-line bg-field focus-within:border-green flex items-center gap-1 border ${
        large ? "h-12 rounded-[14px] px-3.5" : "min-h-11 rounded-[13px] px-3"
      } ${className}`}
    >
      <span className={`text-faint font-mono ${large ? "text-[17px]" : "text-sm"}`}>¥</span>
      <input
        type="text"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, "").slice(0, 8))}
        placeholder={placeholder}
        aria-label={ariaLabel}
        disabled={disabled}
        className={`text-ink placeholder:text-dim w-full min-w-0 bg-transparent font-mono outline-none ${
          large ? "text-[17px]" : "text-right text-sm"
        }`}
      />
    </div>
  );
}
