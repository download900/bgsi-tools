
import categoriesJson from "../data/categories.json";
import eggsJson from "../data/eggs.json";
import petsJson from "../data/pets.json";

// --------------------------
//           Types
// --------------------------

export type Rarity = "common" | "unique" | "rare" | "epic" | "legendary" | "secret" | "infinity";
export type PetVariant = "Normal" | "Shiny" | "Mythic" | "Shiny Mythic";
export const petVariants: PetVariant[] = ["Normal", "Shiny", "Mythic", "Shiny Mythic"];
export type CurrencyVariant = "coins" | "tickets";
export type PetStat = "bubbles" | "currency" | "gems";
export type Enchant = "bubbler" | "looter" | "teamUpV";

export type PetData = {
  categories: Category[];
  categoryLookup: { [key: string]: Category };
  eggs: Egg[];
  eggLookup: { [key: string]: Egg };
  pets: Pet[];
  petLookup: { [key: string]: Pet };
}

export interface Category { 
  name: string, 
  image: string,
  egg?: Egg,
  pets?: Pet[],
  categories: Category[],
  reverseTabs?: boolean;
}

export interface Egg { 
  name: string; 
  image: string; 
  pets: Pet[], 
  luckIgnored: boolean; 
  infinityEgg: string;
  index: string;
  canSpawnAsRift: boolean;
  secretBountyRotation: boolean;
  dateAdded: string;
  dateRemoved: string;
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
  hatchable: boolean;
  obtainedFrom: string;
  obtainedFromImage: string;
  obtainedFromInfo: string;
  image: string[]; 
  dateAdded: string;
  dateRemoved: string;
}

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

// --------------------------
//           Data
// --------------------------

export const variantData: { [key in PetVariant]: { baseScale: number, chanceMultiplier: number } } = { 
    Normal: { baseScale: 1, chanceMultiplier: 1 },
    Shiny: { baseScale: 1.5, chanceMultiplier: 40 },
    Mythic: { baseScale: 1.75, chanceMultiplier: 100 },
    "Shiny Mythic": { baseScale: 2.25, chanceMultiplier: 4000 },
};

export const currencyImages: { [key in CurrencyVariant]: string } = {
  coins: "https://static.wikia.nocookie.net/bgs-infinity/images/f/f0/Coins.png",
  tickets: "https://static.wikia.nocookie.net/bgs-infinity/images/1/14/Tickets.png",
};

const PLACEHOLDER_IMAGE = "https://static.wikia.nocookie.net/bgs-infinity/images/2/2a/Pet_Placeholder.png";

// --------------------------
//         Functions
// --------------------------

export function isAvailable(dateRemoved: string | undefined): boolean {
  if (!dateRemoved) return true;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const removedDate = new Date(dateRemoved);
  removedDate.setHours(0, 0, 0, 0);
  return removedDate > today;
}

export const getPetChance = (pet: Pet, variant: PetVariant) => {
  const variantChance = pet.chance / variantData[variant].chanceMultiplier;
  return variantChance;
}

export const getPetImage = (pet: PetInstance, variantIndex: number) => {
  if (variantIndex === -1) {
    return PLACEHOLDER_IMAGE; 
  }
  return pet.image[variantIndex] || PLACEHOLDER_IMAGE;
}

export const getPetStat = (pet: Pet, variant: PetVariant, stat: PetStat, maxLevel: boolean, enchanted: boolean, enchantTeamSize: number, secondEnchant: Enchant) => {
  let scale = variantData[variant].baseScale;
  if (maxLevel) scale += 0.35;
  let baseStat = pet[stat];
  let multiplier = 1;
  if (enchanted) {
    if (variant === "Shiny" || variant === "Shiny Mythic") {
      if ((secondEnchant === "bubbler" && stat === "bubbles") || (secondEnchant === "looter" && stat === "currency")) {
        multiplier += 0.5;
      }
    }
    let teamUpMultiplier = 0;
    if (pet.rarity === 'secret' || pet.rarity === 'infinity') {
      teamUpMultiplier = 0.5;
      if ((variant === "Shiny" || variant === "Shiny Mythic") && (secondEnchant === "teamUpV")) {
        teamUpMultiplier += 0.25;
      }
    } else {
      teamUpMultiplier = 0.25;
    }
    multiplier += (enchantTeamSize * teamUpMultiplier);
  }
  return Math.floor(baseStat * scale * multiplier);
}

export let PET_DATA: PetData | undefined = undefined;

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
    }
    eggLookup[egg.name] = egg;
    eggs.push(egg);
  });
  // load categories
  const categoryLookup: { [key: string]: Category } = {};
  const categories: Category[] = [];
  function processCategory(cat: any) {
    if (cat.pets) {
      cat.pets = cat.pets.map((petName: string) => petLookup[petName]);
    }
    if (cat.egg) {
      cat.egg = eggLookup[cat.egg];
      if (cat.egg) {
        cat.pets = cat.pets || [];
        for (let i = cat.egg.pets.length - 1; i >= 0; i--) {
          const pet = cat.egg.pets[i];
          if (!cat.pets.some((p: Pet) => p.name === pet.name)) {
            cat.pets.unshift(pet);
          }
        }
      }
    }
    if (cat.categories) {
      cat.categories = cat.categories.map((subCat: any) => {
        if (subCat?.egg === 'Inferno Egg') return undefined;
        processCategory(subCat);
        return subCat;
      }).filter((subCat: any) => subCat !== undefined);
    }
    if (!cat.name) {
      cat.name = cat.egg?.name || "Unknown Category";
    }
    if (!cat.image) {
      cat.image = cat.egg?.image || PLACEHOLDER_IMAGE;
    }
    return cat;
  }
  (categoriesJson as unknown as any).forEach((c: Category) => {
    const cat: Category = processCategory(c) as any as Category;
    categoryLookup[cat.name] = cat;
    categories.push(cat);
  });

  PET_DATA = {
    categories: categories,
    categoryLookup: categoryLookup,
    eggs: eggs,
    eggLookup: eggLookup,
    pets: pets,
    petLookup: petLookup,
  };

  return PET_DATA;
}