import { PetVariant, Rarity } from "./DataUtil";

export const imgIcon = (src: string, size: number = 16, ml: number = 0, mr: number = 0) => {
  return (<img src={src} style={{ width: size, height: size, marginLeft: ml, marginRight: mr, verticalAlign: "middle" }} />)
}

export const getPercentStyle = (percent: number): React.CSSProperties => {
  if (percent === 100) {
    return { color: "#39ff14", fontWeight: "bold" };
  }
  const hue = Math.round((percent / 100) * 120);
  return { color: `hsl(${hue},100%,40%)` };
};

export function variantStyle(variant: PetVariant): string {
  return variant.toLowerCase().replace(" ", "-");
}