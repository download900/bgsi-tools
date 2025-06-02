
import categoriesJson from "../data/categories.json";
import eggsJson from "../data/eggs.json";
import petsJson from "../data/pets.json";

export type PetData = {
  categories: Category[];
  categoryLookup: { [key: string]: Category };
  eggs: Egg[];
  eggLookup: { [key: string]: Egg };
  pets: Pet[];
  petLookup: { [key: string]: Pet };
}

export function loadData(): PetData {
  // load pets
  const petLookup: { [key: string]: Pet } = {};
  const pets: Pet[] = [];
  (petsJson as unknown as any).forEach((pet: Pet) => {
    petLookup[pet.name] = pet;
    pets.push(pet);
  });
  // load eggs
  const eggLookup: { [key: string]: Egg } = {};
  const eggs: Egg[] = [];
  (eggsJson as unknown as any).forEach((e: any) => {
    const egg: Egg = {
      ...e,
      pets: e.pets.map((petName: string) => petLookup[petName]),
    };
    eggLookup[egg.name] = egg;
    eggs.push(egg);
  });
  // load categories
  const categoryLookup: { [key: string]: Category } = {};
  const categories: Category[] = [];
  (categoriesJson as unknown as any).forEach((c: any) => {
    const subCats: Category[] = [];
    for (const sc of c.categories || []) {
      const subCat: Category = {
        ...sc,
        eggs: sc.eggs?.map((eggName: string) => eggLookup[eggName]) || [],
      };
      categoryLookup[subCat.name] = subCat;
      //categories.push(subCat);
      subCats.push(subCat);
    }
    const cat: Category = {
      ...c,
      eggs: c.eggs?.map((eggName: string) => eggLookup[eggName]) || [],
      categories: subCats.length > 0 ? subCats : undefined,
    };
    categoryLookup[cat.name] = cat;
    categories.push(cat);
  });

  // return the data
  return {
    categories: categories,
    categoryLookup: categoryLookup,
    eggs: eggs,
    eggLookup: eggLookup,
    pets: pets,
    petLookup: petLookup,
  };
}

// ~~~~~~~~~~ Types ~~~~~~~~~~

export type Rarity = "common" | "unique" | "rare" | "epic" | "legendary" | "secret";
export type PetVariant = "Normal" | "Shiny" | "Mythic" | "Shiny Mythic";
export const petVariants: PetVariant[] = ["Normal", "Shiny", "Mythic", "Shiny Mythic"];
export type CurrencyVariant = "coins" | "tickets" | "seashells";
export type PetStat = "bubbles" | "currency" | "gems";
export type Enchant = "bubbler" | "looter";

export interface Category { 
  name: string, 
  image: string,
  eggs: Egg[],
  categories: Category[],
}

export interface Egg { 
  name: string; 
  image: string; 
  pets: Pet[], 
  hatchCost: number;
  hatchCurrency: CurrencyVariant;
  world: string;
  zone: string;
  limited: boolean;
  available: boolean;
  luckIgnored: boolean; 
  infinityEgg: string;
  index: string;
  canSpawnAsRift: boolean;
  riftChance: number;
  secretBountyExcluded: boolean;
  // dateAdded: string;
  // dateRemoved: string;
}

export interface Pet { 
  name: string; 
  chance: number; 
  rarity: Rarity; 
  bubbles: number;
  currencyVariant: CurrencyVariant; 
  currency: number;
  gems: number; 
  hasMythic: boolean;
  tags: string[];
  limited: boolean;
  available: boolean;
  hatchable: boolean;
  obtainedFrom: string;
  obtainedFromImage: string;
  image: string[]; 
}

// for the pet stat list - to store an individual Normal/Shiny/Mythic variant of a pet.
export interface PetInstance { 
  name: string; 
  chance: number; 
  rarity: Rarity; 
  bubbles: number; 
  currencyVariant: CurrencyVariant; 
  currency: number; 
  gems: number; 
  variant: PetVariant; 
  hatchable: boolean;
  image: string; 
  obtainedFrom: string;
  obtainedFromImage: string;
}

// ~~~~~~~~~~ Data ~~~~~~~~~~

export const variantData: { [key in PetVariant]: { baseScale: number, levelScale: number, chanceMultiplier: number } } = { 
    Normal: { baseScale: 1, levelScale: 1.35, chanceMultiplier: 1 },
    Shiny: { baseScale: 1.5, levelScale: 1.233333, chanceMultiplier: 40 },
    Mythic: { baseScale: 1.75, levelScale: 1.2, chanceMultiplier: 100 },
    "Shiny Mythic": { baseScale: 2.25, levelScale: 1.1556, chanceMultiplier: 4000 },
};

export const currencyImages: { [key in CurrencyVariant]: string } = {
  coins: "https://static.wikia.nocookie.net/bgs-infinity/images/f/f0/Coins.png",
  tickets: "https://static.wikia.nocookie.net/bgs-infinity/images/1/14/Tickets.png",
  seashells: "https://static.wikia.nocookie.net/bgs-infinity/images/4/49/Seashells.png"
};

// ~~~~~~~~~~ Functions ~~~~~~~~~~

export const getPetChance = (pet: Pet, variant: PetVariant) => {
  const variantChance = pet.chance / variantData[variant].chanceMultiplier;
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