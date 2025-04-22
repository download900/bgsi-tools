import { PetVariant, Rarity } from "../App";

export const variants: PetVariant[] = ["Normal", "Shiny", "Mythic", "Shiny Mythic"];
export const rarityColorMap: Record<Rarity, string> = {
  Common: "#ffffff",
  Unique: "#fdc394",
  Rare: "#ff6161",
  Epic: "#d166fd",
  Legendary: "rainbow",
  Secret: "#ff9900"
};

export const getNameAndChanceStyle = (rarity: Rarity): React.CSSProperties => {
  const color = rarityColorMap[rarity];
  if (rarity === "Legendary") {
    return {
      background: "linear-gradient(90deg, #ff9999, #ffd699, #fffd99, #99ffb4, #99ffff, #99b3ff, #c599ff)",
      WebkitBackgroundClip: "text" as const,
      color: "transparent", fontWeight: "bold"
    };
  }
  if (rarity === "Secret") {
    return { color, fontWeight: "bold" };
  }
  return { color };
};

export const getPercentStyle = (percent: number): React.CSSProperties => {
  if (percent === 100) {
    return { color: "#39ff14", fontWeight: "bold" };
  }
  const hue = Math.round((percent / 100) * 120);
  return { color: `hsl(${hue},100%,40%)` };
};