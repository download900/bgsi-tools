
import petJson from "../assets/pets.json";

// ~~~~~~~~~~ Types ~~~~~~~~~~

export type Rarity = "Common" | "Unique" | "Rare" | "Epic" | "Legendary" | "Secret";
export type PetVariant = "Normal" | "Shiny" | "Mythic" | "Shiny Mythic";
export type CurrencyVariant = "Coins" | "Tickets" | "Seashells";
export type PetStat = "bubbles" | "currency" | "gems";
export type Enchant = "bubbler" | "looter";

export interface Category { 
  name: string, 
  image: string,
  eggs: Egg[]
}

export interface Egg { 
  name: string; 
  image: string; 
  pets: Pet[], 
  luckIgnored: boolean; 
  infinityEgg: string;
  index: string;
  limited: boolean;
  available: boolean;
}

export interface Pet { 
  name: string; 
  droprate: number; 
  rarity: Rarity; 
  bubbles: number;
  currencyVariant: CurrencyVariant; 
  currency: number;
  gems: number; 
  limited: boolean;
  available: boolean;
  obtainedFrom: string;
  obtainedFromImage: string;
  variants: PetVariant[]; 
  image: string[]; 
}

// for the pet stat list - to store an individual Normal/Shiny/Mythic variant of a pet.
export interface PetInstance { 
  name: string; 
  droprate: number; 
  rarity: Rarity; 
  bubbles: number; 
  currencyVariant: CurrencyVariant; 
  currency: number; 
  gems: number; 
  variant: PetVariant; 
  image: string; 
  //egg: Egg; 
  obtainedFrom: string;
  obtainedFromImage: string;
}

// ~~~~~~~~~~ Data ~~~~~~~~~~

export const petData = petJson as unknown as Category[];

export const variants: PetVariant[] = ["Normal", "Shiny", "Mythic", "Shiny Mythic"];

export const variantData: { [key in PetVariant]: { baseScale: number, levelScale: number, chanceMultiplier: number } } = { 
    Normal: { baseScale: 1, levelScale: 1.35, chanceMultiplier: 1 },
    Shiny: { baseScale: 1.5, levelScale: 1.233333, chanceMultiplier: 40 },
    Mythic: { baseScale: 1.75, levelScale: 1.2, chanceMultiplier: 100 },
    "Shiny Mythic": { baseScale: 2.25, levelScale: 1.1556, chanceMultiplier: 4000 },
};

export const currencyImages: { [key in CurrencyVariant]: string } = {
  Coins: "https://static.wikia.nocookie.net/bgs-infinity/images/f/f0/Coins.png",
  Tickets: "https://static.wikia.nocookie.net/bgs-infinity/images/1/14/Tickets.png",
  Seashells: "https://static.wikia.nocookie.net/bgs-infinity/images/4/49/Seashells.png"
};

// ~~~~~~~~~~ Functions ~~~~~~~~~~

export const getPetChance = (pet: Pet, variant: PetVariant) => {
  if (!(pet.droprate as number))
    return 1;
  // extract the base chance from the string. It will be like "1/1,000" and we want "1000".
  const variantChance = Number(pet.droprate) * variantData[variant].chanceMultiplier;
  return variantChance;
}

export const getPetImage = (pet: PetInstance, variantIndex: number) => {
  if (variantIndex === -1) {
    return pet.image[0]; // Fallback to the first image if the variant is not found
  }
  return pet.image[variantIndex];
}

export const getPetStat = (pet: Pet, variant: PetVariant, stat: PetStat, maxLevel: boolean, enchanted: boolean, enchantTeamSize: number, secondEnchant: Enchant) => {
  let scale = variantData[variant].baseScale;
  if (maxLevel) scale *= variantData[variant].levelScale;
  let baseStat = pet[stat];
  let multiplier = 1;
  if (enchanted) {
    if (variant === "Shiny" || variant === "Shiny Mythic") {
      if ((secondEnchant === "bubbler" && stat === "bubbles") || (secondEnchant === "looter" && stat === "currency")) {
        multiplier += 0.5;
      }
    }
    multiplier += (enchantTeamSize * 0.25);
  }
  return Math.floor(baseStat * scale * multiplier);
}