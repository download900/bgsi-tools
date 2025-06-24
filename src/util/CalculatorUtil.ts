import Decimal from "decimal.js";
import { Egg, Pet, PetData } from "./DataUtil";

// Buff data
export type LuckyPotion = 0 | 10 | 20 | 30 | 65 | 150 | 400;
export type MythicPotion = 0 | 10 | 20 | 30 | 75 | 150 | 250;
export type SpeedPotion = 0 | 10 | 15 | 20 | 25 | 40 | 100;
export type RiftMultiplier = 0 | 5 | 10 | 25;
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
    doubleLuckGamepass: boolean;
    normalIndex: string[];
    shinyIndex: string[];
    luckyStreak: LuckyStreak;
    highRoller: number;
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
    // bubble shrine
    bubbleShrineLevel: number; // 1-50
    // daily perks
    premiumDailyPerks: boolean;
}

export interface CalculatorResults {
    luckyBuff: number;
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

export function calculateChance(baseChance:number, luckyBuff: number) {
    // Calculate base drop chance
    const n = Decimal(1).plus(luckyBuff / 100);
    // (baseChance) * (1 + (luckyBuff / 100))
    const dropRate = n.times(baseChance);
    return dropRate as unknown as any;
}

export function isBuffDay(buff: string) {
    // Check if the current day (UTC) is the right day for a buff
    // Saturday: Luck day
    // Tuesday: Hatch day
    const day = new Date().getUTCDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    if (buff === "Luck") {
        return day === 6; // Saturday
    } else if (buff === "Hatch") {
        return day === 2; // Tuesday
    }
    return false; // No buff day
}

export function calculate(egg: Egg, calculatorSettings: CalculatorSettings, setCalculatorResults: any, selectedEgg: Egg) {
    let luckyBuff = 0;
    let shinyChance = 0;
    let mythicChance = 0;

    // Calculate Lucky buff:
    // Add Raw buffs:
    luckyBuff = calculatorSettings.luckyPotion 
        + calculatorSettings.luckyStreak 
        + (calculatorSettings.normalIndex.includes(egg.index) ? 50 : 0) 
        + (calculatorSettings.highRoller * 10);
    if (isBuffDay("Luck")) {
        // Luck Day free and premium actually stack together if you have premium, so its 350 (may be a bug)
        luckyBuff += calculatorSettings.premiumDailyPerks ? 350 : 100;
    }
    else {
        // Free buff seems to be permanently active even on other days.
        luckyBuff += 100;
    }
    if (calculatorSettings.bubbleShrineLevel > 0) {
        luckyBuff += getBubbleShrineStat("luck", calculatorSettings.bubbleShrineLevel);
    }
    // Double luck gamepass
    if (calculatorSettings.doubleLuckGamepass) luckyBuff *= 2;
    if (calculatorSettings.doubleLuckGamepass) luckyBuff += 100;
    // Double Luck Event and Infinity Elixir don't multiply together, they each double the value so far:
    const luckyBuffSubtotal = luckyBuff;
    // Double luck event
    if (calculatorSettings.doubleLuckEvent) luckyBuff += luckyBuffSubtotal;
    if (calculatorSettings.doubleLuckEvent) luckyBuff += 100;
    // Infinity Elixir
    if (calculatorSettings.infinityElixir) luckyBuff += luckyBuffSubtotal;
    if (calculatorSettings.infinityElixir) luckyBuff += 100;
    // Add External buffs:
    // Friend boost
    luckyBuff += calculatorSettings.friendBoost * 10;
    // Board Game Luck Boost
    if (calculatorSettings.boardGameLuckBoost) luckyBuff += 200;
    // Rift egg multiplier
    if (selectedEgg?.canSpawnAsRift && calculatorSettings.riftMultiplier > 0) luckyBuff += calculatorSettings.riftMultiplier * 100;

    // Calculate Shiny rate:
    let shinyBuff = 0;
    if (calculatorSettings.normalIndex.includes(egg.index)) shinyBuff += 50;
    shinyChance = 1 / 40 * (1 + (shinyBuff / 100)) * (calculatorSettings.infinityElixir ? 2 : 1);

    // Calculate Mythic rate:
    let mythicBuff = 0;
    if (calculatorSettings.shinyIndex.includes(egg.index)) mythicBuff += 50;
    mythicBuff += calculatorSettings.mythicPotion;
    mythicChance = 1 / 100 * (1 + (mythicBuff / 100)) * (calculatorSettings.infinityElixir ? 2 : 1);

    // Calculate speed:
    let speed = 100 + calculatorSettings.speedPotion;
    if (calculatorSettings.fastHatchMastery) speed += 10;
    if (calculatorSettings.infinityElixir) speed *= 2;
    if (calculatorSettings.fastHatchGamepass) speed += 50;
    if (calculatorSettings.fastHatchEvent) speed += 30;
    if (isBuffDay("Hatch")) {
        speed += calculatorSettings.premiumDailyPerks ? 30 : 15;
    }
    if (calculatorSettings.bubbleShrineLevel > 0) {
        // Bubble Shrine speed buff seems to be giving 100 + buff (may be a bug)
        speed += 100 + getBubbleShrineStat("hatchSpeed", calculatorSettings.bubbleShrineLevel);
    }
    // base hatches per second is 1 egg per 4.5 seconds. multipy that by speed, then by eggsPerHatch
    const hatchesPerSecond = (1 / 4.5) * (speed / 100) * calculatorSettings.eggsPerHatch;

    const results: CalculatorResults = { 
        luckyBuff: luckyBuff, 
        shinyChance: shinyChance, 
        mythicChance: mythicChance, 
        shinyMythicChance: shinyChance * mythicChance,
        speed: speed,
        hatchesPerSecond: hatchesPerSecond,
        petResults: [] 
    };

    egg.pets.forEach((pet) => {
        if (pet.rarity && pet.rarity !== 'secret' && !pet.rarity.includes('legendary')) return;
        const normalChance = calculateChance(pet.chance, luckyBuff);
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


    setCalculatorResults(results);
}

export default {}