import { Cookie, type LucideIcon, Moon, Sun, Sunrise } from "lucide-react";
import { type Slot } from "@/lib/nutrition";

const ICONS: Record<Slot, LucideIcon> = {
  breakfast: Sunrise,
  lunch: Sun,
  dinner: Moon,
  snack: Cookie,
};

// Saturated tint + dark ink of the same hue, one pair per slot.
export const SLOT_BG: Record<Slot, string> = {
  breakfast: "oklch(87.9% 0.169 91.605)",
  lunch: "oklch(87.1% 0.15 154.449)",
  dinner: "oklch(78.5% 0.115 274.713)",
  snack: "oklch(83.7% 0.128 66.29)",
};
export const SLOT_FG: Record<Slot, string> = {
  breakfast: "oklch(41.4% 0.112 45.904)",
  lunch: "oklch(39.3% 0.095 152.535)",
  dinner: "oklch(35.9% 0.144 278.697)",
  snack: "oklch(40.8% 0.123 38.172)",
};

type Props = {
  slot: Slot;
  // Muted grey when the slot has nothing recorded yet.
  active?: boolean;
  size?: number;
};

export default function SlotIcon({ slot, active = true, size = 38 }: Props) {
  const Icon = ICONS[slot];
  const style = active
    ? { background: SLOT_BG[slot], color: SLOT_FG[slot] }
    : { background: "var(--color-track)", color: "var(--color-faint)" };
  return (
    <div
      className="flex flex-none items-center justify-center rounded-xl"
      style={{ width: size, height: size, ...style }}
      aria-hidden
    >
      <Icon size={Math.round(size * 0.5)} strokeWidth={2} />
    </div>
  );
}
