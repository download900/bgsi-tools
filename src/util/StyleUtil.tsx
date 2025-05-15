import { PetVariant, Rarity } from "./PetUtil";

export const rarityColorMap: Record<Rarity, string> = {
  Common: "#ffffff",
  Unique: "#fec394",
  Rare: "#ff6161",
  Epic: "#d166fd",
  Legendary: "rainbow",
  //'Legendary Tier II': "rainbow",
  //'Legendary Tier III': "rainbow",
  Secret: "#ff9900"
};

export const variantStyles: { [key in PetVariant]: React.CSSProperties } = {
  Normal: { color: "#ffffff" },
  Shiny: { color: "#feffd4" },
  Mythic: { color: "#d674b7" },
  "Shiny Mythic": { color: "#9b74d6" },
};

export const imgIcon = (src: string, size: number = 16, ml: number = 0, mr: number = 0) => {
  return (<img src={src} style={{ width: size, height: size, marginLeft: ml, marginRight: mr, verticalAlign: "middle" }} />)
}

export const getRarityStyle = (rarity: Rarity): React.CSSProperties => {
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