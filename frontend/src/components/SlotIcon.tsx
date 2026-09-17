import { Cookie, type LucideIcon, Moon, Sun, Sunrise } from "lucide-react";
import { type Slot, SLOT_HUE } from "@/lib/nutrition";

const ICONS: Record<Slot, LucideIcon> = {
  breakfast: Sunrise,
  lunch: Sun,
  dinner: Moon,
  snack: Cookie,
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
    ? {
        background: `oklch(0.94 0.04 ${SLOT_HUE[slot]})`,
        color: `oklch(0.44 0.1 ${SLOT_HUE[slot]})`,
      }
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
