import Decimal from "decimal.js";
import { Egg, Pet, PET_DATA, PetData } from "./DataUtil";
import { get } from "http";

// Buff data
export type LuckyPotion = 0 | 10 | 20 | 30 | 65 | 150 | 400 | 600;
export type MythicPotion = 0 | 10 | 20 | 30 | 75 | 150 | 250 | 375;
export type SpeedPotion = 0 | 10 | 15 | 20 | 25 | 40 | 100 | 150;
export type RiftMultiplier = 0 | 5 | 10 | 15 | 20 | 25;
export type LuckyStreak = 0 | 20 | 30;
export type LuckDayBonus = "None" | "Free" | "Premium";
export type HatchDayBonus = "None" | "Free" | "Premium";

export interface CalculatorSettings {
    // egg settings
    selectedEgg: string,
    riftMultiplier: RiftMultiplier;
    // secret bounty
    secretsBountyPet: string;
    secretsBountyEgg: string;
    // luck buffs
    luckyPotion: LuckyPotion;
    mythicPotion: MythicPotion;
    infinityElixir: boolean;
    secretElixir: boolean;
    doubleLuckGamepass: boolean;
    normalIndex: string[];
    shinyIndex: string[];
    luckyStreak: LuckyStreak;
    highRoller: number;
    secretHunter: number;
    ultraRoller: number;
    shinySeeker: number;
    friendBoost: number;
    boardGameLuckBoost: boolean;
    // speed buffs
    speedPotion: SpeedPotion;
    fastHatchGamepass: boolean;
    fastHatchMastery: boolean;
    eggsPerHatch: number;
    // events
    doubleLuckEvent: boolean;
    fastHatchEvent: boolean;
    doubleSecretEvent: boolean;
    // bubble shrine
    bubbleShrineLevel: number; // 1-50
    // daily perks
    premiumDailyPerks: boolean;
    // milestones
    hatchingTier: number; // 1-10
}

export interface CalculatorResults {
    luckyBuff: number;
    secretBuff: number;
    shinyChance: number;
    mythicChance: number;
    shinyMythicChance: number;
    speed: number;
    hatchesPerSecond: number;
    petResults: PetResult[];
}

export interface PetResult {
    pet: Pet;
    normalChance: number;
    shinyChance: number;
    mythicChance: number;
    shinyMythicChance: number;
    normalDroptime: number;
    shinyDroptime: number;
    mythicDroptime: number;
    shinyMythicDroptime: number;
}

export interface InfinityEgg {
    name: string;
    pets: Pet[];
}

export function getBubbleShrineStat(stat: string, level: number): number {
    const buffData: Record<string, { level: number; stat: number }[]> = {
        luck: [{ level: 1, stat: 15 }, { level: 50, stat: 150 }],
        hatchSpeed: [{ level: 20, stat: 5 }, { level: 50, stat: 25 }],
    };

    const data = buffData[stat];
    if (level < data[0].level) return 0;

    // interpolate between min buff and max buff based on level
    const min = data[0].stat;
    const max = data[1].stat;
    const minLevel = data[0].level;
    const maxLevel = data[1].level;
    const buff = min + (max - min) * (level - minLevel) / (maxLevel - minLevel);
    
    return buff;
}

export function getHatchingTierBuff (hatchingTier: number, buffType: "luck" | "speed"): number {
    const buffData: Record<string, number[]> = {
        luck: [5, 5, 10, 15, 20, 25, 35, 50, 75, 150],
        speed: [0, 5, 5, 10, 15, 15, 20, 25, 30, 35]
    };

    if (hatchingTier < 1 || hatchingTier > 10) return 0;
    return buffData[buffType][hatchingTier - 1];
}

const BuffDays: { [key: string]: { day: number; bonus: (premium: boolean) => number; offDays: () => number } } = {
    Luck: {
        day: 6, // Saturday
        bonus: (premium: boolean) => premium ? 450 : 300,
        offDays: () => 100,
    },
    Hatch: {
        day: 2, // Tuesday
        bonus: (premium: boolean) => premium ? 30 : 15,
        offDays: () => 0
    }
};

export function isBuffDay(buff: string): boolean {
    const day = new Date().getUTCDay();
    if (BuffDays[buff]) {
        return BuffDays[buff].day === day;
    }
    return false; // No buff for this day
}

export function getBuffDayBonus(buff: string, premium: boolean): number {
    const day = new Date().getUTCDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    if (BuffDays[buff]) {
        if (BuffDays[buff].day === day) return BuffDays[buff].bonus(premium);
        return BuffDays[buff].offDays();
    }
    return 0; // No bonus for this buff on this day
}

export function calculateChance(baseChance:number, buff: number) {
    // Calculate base drop chance
    // (baseChance) * (1 + (buff / 100))
    const n = Decimal(1).plus(buff / 100);
    const dropRate = n.times(baseChance);
    return dropRate as unknown as any;
}

export function calculate(egg: Egg, calculatorSettings: CalculatorSettings, selectedEgg: Egg) : CalculatorResults {
    let luckyBuff = 0;

    // Calculate Lucky buff:
    // Add Raw buffs:
    luckyBuff = 100 // base 100% luck (invisible) 
        + calculatorSettings.luckyPotion 
        + calculatorSettings.luckyStreak 
        + (calculatorSettings.normalIndex.includes(egg.index) ? 50 : 0) 
        + (calculatorSettings.highRoller * 10)
        + (calculatorSettings.ultraRoller * 25)
        + getBuffDayBonus("Luck", calculatorSettings.premiumDailyPerks)
        + getBubbleShrineStat("luck", calculatorSettings.bubbleShrineLevel)
        + getHatchingTierBuff(calculatorSettings.hatchingTier, "luck");
    // Luck multipliers:
    let luckMultiplier = 0;
    if (calculatorSettings.doubleLuckGamepass) luckMultiplier += 2;
    if (calculatorSettings.infinityElixir) luckMultiplier += 2;
    if (calculatorSettings.doubleLuckEvent) luckMultiplier += 2;
    if (luckMultiplier > 0) luckyBuff *= luckMultiplier;
    // Add External buffs:
    luckyBuff += calculatorSettings.friendBoost * 10;
    if (calculatorSettings.boardGameLuckBoost) luckyBuff += 200;
    if (selectedEgg?.canSpawnAsRift && calculatorSettings.riftMultiplier > 0) luckyBuff += calculatorSettings.riftMultiplier * 100;
    luckyBuff -= 100; // remove base 100% luck

    // Calculate Secret Buff:
    let secretBuff = 100;
    if (calculatorSettings.secretHunter) secretBuff += 5; // (currently bugged, doesn't stack) calculatorSettings.secretHunter * 5;
    let secretMultiplier = 0;
    if (calculatorSettings.infinityElixir) secretMultiplier += 2;
    if (calculatorSettings.secretElixir) secretMultiplier += 2;
    if (secretMultiplier > 0) secretBuff *= secretMultiplier;
    secretBuff -= 100; // remove base 100% luck

    // Calculate Shiny rate:
    let shinyChance = 2.5; // 1/40 base rate
    shinyChance += calculatorSettings.shinySeeker * 0.2;
    let shinyBuff = 100;
    if (calculatorSettings.normalIndex.includes(egg.index)) shinyBuff += 50;
    let shinyMultiplier = 0;
    if (calculatorSettings.infinityElixir) shinyMultiplier += 2;
    if (shinyMultiplier > 0) shinyBuff *= shinyMultiplier;
    shinyBuff -= 100; // remove base 100% luck
    shinyChance = calculateChance(shinyChance, shinyBuff) / 100;

    // Calculate Mythic rate:
    let mythicChance = 1; // 1/100 base rate
    let mythicBuff = 100;
    mythicBuff += calculatorSettings.mythicPotion;
    if (calculatorSettings.shinyIndex.includes(egg.index)) mythicBuff += 50;
    let mythicMultiplier = 0;
    if (calculatorSettings.secretElixir) mythicMultiplier = 0.2;
    else if (calculatorSettings.infinityElixir) mythicMultiplier += 2;
    if (mythicMultiplier > 0) mythicBuff *= mythicMultiplier;
    mythicBuff -= 100; // remove base 100% luck
    mythicChance = calculateChance(mythicChance, mythicBuff) / 100;

    // Calculate speed:
    let speed = 100 + calculatorSettings.speedPotion;
    if (calculatorSettings.fastHatchMastery) speed += 10;
    if (calculatorSettings.infinityElixir) speed *= 2;
    if (calculatorSettings.fastHatchGamepass) speed += 50;
    if (calculatorSettings.fastHatchEvent) speed += 30;
    speed += getBuffDayBonus("Hatch", calculatorSettings.premiumDailyPerks);
    speed += getHatchingTierBuff(calculatorSettings.hatchingTier, "speed");
    if (calculatorSettings.bubbleShrineLevel > 0) {
        // Bubble Shrine speed buff seems to be giving 100 + buff (may be a bug)
        speed += 100 + getBubbleShrineStat("hatchSpeed", calculatorSettings.bubbleShrineLevel);
    }
    // base hatches per second is 1 egg per 4.5 seconds.
    const hatchesPerSecond = (1 / 4.5) * (speed / 100) * calculatorSettings.eggsPerHatch;

    const results: CalculatorResults = { 
        luckyBuff: luckyBuff,
        secretBuff: secretBuff,
        shinyChance: shinyChance, 
        mythicChance: mythicChance, 
        shinyMythicChance: shinyChance * mythicChance,
        speed: speed,
        hatchesPerSecond: hatchesPerSecond,
        petResults: [] 
    };

    egg.pets.forEach((pet) => {
        if (pet.rarity !== 'secret' && !pet.rarity.includes('legendary') && !pet.rarity.includes('infinity')) return;

        let normalChance = calculateChance(pet.chance, luckyBuff);

        if (pet.rarity === 'secret' || pet.rarity === 'infinity') {
            normalChance = calculateChance(normalChance, secretBuff);
        }

        results.petResults.push({
            pet: pet,
            normalChance: normalChance,
            shinyChance: normalChance * shinyChance,
            mythicChance: normalChance * mythicChance,
            shinyMythicChance: normalChance * shinyChance * mythicChance,
            normalDroptime: 100 / normalChance / hatchesPerSecond,
            shinyDroptime: (100 / (normalChance * shinyChance)) / hatchesPerSecond,
            mythicDroptime: (100 / (normalChance * mythicChance)) / hatchesPerSecond,
            shinyMythicDroptime: (100 / (normalChance * shinyChance * mythicChance)) / hatchesPerSecond,
        });
    });

    return results;
}

 export default {}