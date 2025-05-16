import { JSX, useEffect, useState } from "react";
import { Container, Typography, Box, TextField, Select, MenuItem, Checkbox, Paper, Tooltip, Table, TableBody, TableCell, TableHead,TableRow, Link, Tabs, Tab, List, ListItem } from "@mui/material";
import { getRarityStyle, imgIcon } from "../util/StyleUtil";
import { CategoryData, Egg, Pet, SubCategoryData } from "../util/PetUtil";
import Decimal from "decimal.js";

const STORAGE_KEY = "oddsCalculatorSettings";

// Buff data
type LuckyPotion = 0 | 10 | 20 | 30 | 65 | 150 | 400;
type MythicPotion = 0 | 10 | 20 | 30 | 75 | 150 | 250;
type SpeedPotion = 0 | 10 | 15 | 20 | 25 | 40 | 100;
type RiftMultiplier = 0 | 5 | 10 | 25;
type LuckyStreak = 0 | 20 | 30;

interface CalculatorSettings {
    // egg settings
    selectedEgg: string,
    riftMultiplier: RiftMultiplier;
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
    doubleLuckEvent: boolean;
    // speed buffs
    speedPotion: SpeedPotion;
    fastHatchGamepass: boolean;
    fastHatchMastery: boolean;
    eggsPerHatch: number;
    // secret bounty
    secretsBountyPet: string;
    secretsBountyEgg: string;
}

interface CalculatorResults {
    luckyBuff: number;
    shinyRate: number;
    mythicRate: number;
    speed: number;
    hatchesPerSecond: number;
    shinyMythicRate: number;
    petResults: PetResult[];
}

interface PetResult {
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
    subcategory: SubCategoryData;
}

interface OddsCalculatorProps {
  data: CategoryData[];
}

export function OddsCalculator(props: OddsCalculatorProps): JSX.Element {
    const [calculatorSettings, setCalculatorSettings] = useState<CalculatorSettings>({
        selectedEgg: "",
        riftMultiplier: 0,
        luckyPotion: 0,
        mythicPotion: 0,
        speedPotion: 0,
        infinityElixir: false,
        doubleLuckGamepass: false,
        normalIndex: [],
        shinyIndex: [],
        luckyStreak: 0,
        highRoller: 0,
        friendBoost: 0,
        boardGameLuckBoost: false,
        fastHatchGamepass: false,
        fastHatchMastery: false,
        eggsPerHatch: 1,
        doubleLuckEvent: false,
        secretsBountyPet: "",
        secretsBountyEgg: "",
    });
    const [calculatorResults, setCalculatorResults] = useState<CalculatorResults>();

    const [settingsTab, setSettingsTab] = useState(0);
    const [resultsTab, setResultsTab] = useState(0);

    // list of pets
    const [eggs, setEggs] = useState<Egg[]>([]);
    const [secretBountyPets, setSecretBountyPets] = useState<Pet[]>([]);
    const [selectedEgg, setSelectedEgg] = useState<Egg | null>(null);

    useEffect(() => {
        if (selectedEgg) {
            setCalculatorSettings({...calculatorSettings, selectedEgg: selectedEgg.name});
        }
    }, [ selectedEgg ]);

    // ~~~~~~~~~~~~~ Load egg data and settings ~~~~~~~~~~~~~

    useEffect(() => {
        loadCalculator();
    }, [props.data]);
    
    const loadCalculator = () => {
        try {
            // Load settings
            const saved = localStorage.getItem(STORAGE_KEY);
            let settings: CalculatorSettings;
            if (saved) {
                settings = JSON.parse(saved);
            } else {
                settings = calculatorSettings;
            }
            if (!settings.normalIndex) settings.normalIndex = [];
            if (!settings.shinyIndex) settings.shinyIndex = [];
            setCalculatorSettings(settings);
            
            // Set up infinity eggs
            const infinityEggs: Record<string, InfinityEgg> = {};
            const infinityEggNames: string[] = [];

            // Load secret bounty pets
            const secretPets = props.data.find(cat => cat.name.includes("Other"))?.categories.find(subcat => subcat.name === "Secret Bounty")?.eggs[0].pets || [];
            setSecretBountyPets(secretPets);

            // Process eggs for calculator
            const eggs: Egg[] = [];
            // make a clone to avoid mutating the original data
            const clonedData = structuredClone(props.data);
            for (const category of clonedData) {
                if (category.ignoreCalculator) continue;
                for (const subcat of category.categories) {
                    if (subcat.ignoreCalculator) continue;

                    // if we're parsing Worlds, push new infinity egg
                    if (category.name.includes("Worlds")) {
                        const egg = { name: subcat.name, pets: [], subcategory: subcat } as InfinityEgg;
                        infinityEggs[subcat.name] = egg;
                        infinityEggNames.push(subcat.name);
                    }

                    for (const egg of subcat.eggs) {
                        if (egg.ignoreCalculator) continue;

                        // check for secret bounty
                        if (settings.secretsBountyPet && settings.secretsBountyEgg === egg.name) {
                            const secretBountyPet = secretPets.find(pet => pet.name === settings.secretsBountyPet);
                            if (secretBountyPet) {
                                egg.pets.push(secretBountyPet);
                            }
                        }

                        if (egg.pets.some((pet: Pet) => pet.rarity === "Secret" || pet.rarity.includes("Legendary"))) {
                            eggs.push(egg);
                            // check for infinity egg, clone pets to infinity egg
                            if (egg.infinityEgg) {
                                const newPets = structuredClone(egg.pets.filter((pet: Pet) => pet.rarity.includes('Legendary') || pet.rarity === 'Secret'));
                                infinityEggs[egg.infinityEgg].pets.push(...newPets);
                            }
                        }
                    }
                }
            }

            // Process Infinity Eggs:
            infinityEggNames.forEach((eggName) => {
                const egg = infinityEggs[eggName];
                const { pets, subcategory, name } = egg;

                const legendaryRate = 200;
                const secretRate = 40000000;
                        
                // 1) compute “sum of 1/droprate” per rarity
                const totals = pets.reduce((acc, pet) => {
                        const dec = 1 / pet.droprate;
                        let rarity: "Legendary" | "Secret";
                        if (pet.rarity === 'Secret') rarity = 'Secret';
                        else rarity = 'Legendary';
                        acc[rarity] += dec;
                        return acc;
                    }, { Legendary: 0, Secret: 0 } as Record<"Legendary" | "Secret", number>
                );
              
                // 2) recalc each pet’s droprate: new = pet.droprate * (totalDecimalForThisRarity) / rateForThisRarity
                const rateMap = { Legendary: legendaryRate, Secret: secretRate };
                let updatedPets = pets.map((pet) => ({ ...pet,
                    droprate: pet.droprate * totals[pet.rarity === 'Secret' ? 'Secret' : 'Legendary'] / (1 / rateMap[pet.rarity === 'Secret' ? 'Secret' : 'Legendary']),
                })).sort((a, b) => a.droprate - b.droprate);

                // After processing, add "Any Legendary" and "Any Secret" to top of the pet list.
                updatedPets = [
                    { name: "Any Legendary", droprate: legendaryRate, image: ["https://static.wikia.nocookie.net/bgs-infinity/images/2/24/Infinity_Egg.png"] } as Pet,
                    { name: "Any Secret", droprate: secretRate, image: ["https://static.wikia.nocookie.net/bgs-infinity/images/2/24/Infinity_Egg.png"] } as Pet,
                    ...updatedPets
                ];
              
                eggs.push({
                    name: `Infinity Egg (${name})`,
                    image: "https://static.wikia.nocookie.net/bgs-infinity/images/2/24/Infinity_Egg.png",
                    index: subcategory.name,
                    pets: updatedPets,
                    subcategory,
                } as Egg);
            });

            // Sort all eggs by name
            setEggs(eggs.sort((a, b) => a.name.localeCompare(b.name)));

            // Set egg from settings
            setSelectedEgg(eggs.find(egg => egg.name === settings.selectedEgg) || eggs[0]);
        } catch {}
    }

    const saveSettings = (settings: CalculatorSettings) => {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch {}
    }

    useEffect(() => {
        if (props.data?.length > 0) {
            saveSettings(calculatorSettings);
            handleCalculate(selectedEgg as Egg);
        }
    }, [calculatorSettings]);

    // ~~~~~~~~~~~~~ Calculation ~~~~~~~~~~~~~

    const calculateChance = (baseDroprate:number, luckyBuff: number) => {
        // Calculate base drop chance
        const n = Decimal(1).plus(luckyBuff / 100);
        // The line below is: 1 - pow(1 - (1 / baseChance), n)
        const dropRate = Decimal(1).minus(Decimal.pow(Decimal(1).minus((Decimal(1).dividedBy(baseDroprate))), n));
        return dropRate as unknown as any;
    }

    const handleCalculate = (egg: Egg) => {
        if (!egg)
            return;

        let luckyBuff = 0;
        let shinyChance = 0;
        let mythicChance = 0;

        // Calculate Lucky buff:
        // Add Raw buffs:
        luckyBuff = calculatorSettings.luckyPotion 
            + calculatorSettings.luckyStreak 
            + (calculatorSettings.normalIndex.includes(egg.index) ? 50 : 0) 
            + (calculatorSettings.highRoller * 10);
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
        if (calculatorSettings.riftMultiplier > 0) luckyBuff += calculatorSettings.riftMultiplier * 100;

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
        // base hatches per second is 1 egg per 4.5 seconds. multipy that by speed, then by eggsPerHatch
        const hatchesPerSecond = (1 / 4.5) * (speed / 100) * calculatorSettings.eggsPerHatch;

        const results: CalculatorResults = { 
            luckyBuff: luckyBuff, 
            shinyRate: shinyChance, 
            mythicRate: mythicChance, 
            shinyMythicRate: shinyChance * mythicChance,
            speed: speed,
            hatchesPerSecond: hatchesPerSecond,
            petResults: [] 
        };

        egg.pets.forEach((pet) => {
            if (pet.rarity && pet.rarity !== 'Secret' && !pet.rarity.includes('Legendary')) return;
            const normalChance = calculateChance(pet.droprate, luckyBuff);
            results.petResults.push({
                pet: pet,
                normalChance: normalChance,
                shinyChance: normalChance * shinyChance,
                mythicChance: normalChance * mythicChance,
                shinyMythicChance: normalChance * shinyChance * mythicChance,
                normalDroptime: 1 / normalChance / hatchesPerSecond,
                shinyDroptime: (1 / (normalChance * shinyChance)) / hatchesPerSecond,
                mythicDroptime: (1 / (normalChance * mythicChance)) / hatchesPerSecond,
                shinyMythicDroptime: (1 / (normalChance * shinyChance * mythicChance)) / hatchesPerSecond,
            });
        });


        setCalculatorResults(results);
    }

    // ~~~~~~~~~~~~~ Render ~~~~~~~~~~~~~

    const formatChanceResult = (chance: number) => {
        let oddsString = "";
        let tooltipString = "";
        if (chance !== 0) {
            const odds = 1 / chance;
            const percent = Number(100 * chance);
            // if chance is less than 0.0001, use scientific notation
            if (percent < 0.0001) {
                tooltipString = `${percent.toExponential(5)}%`;
                // replace the "e-" with "e-0" to match how the game displays it
                tooltipString = tooltipString.replace("e-", "e-0");
            }
            else {
                tooltipString = `${(percent).toLocaleString(undefined, { maximumFractionDigits: 5 })}%`;
            }
            oddsString = `1 / ${odds.toLocaleString(undefined, { maximumFractionDigits: 1})}`;
        }
        else {
            oddsString = "1 / ∞";
            tooltipString = "Cannot divide by 0.";
        }

        return (
            <Tooltip title={tooltipString} arrow>
                <b>{oddsString}</b>
            </Tooltip>
        )
    }

    const formatTimeResult = (seconds: number) => {
        if (seconds === 0) return "∞";
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        const years = Math.floor(days / 365);
        const secondsLeft = seconds % 60;
        const minutesLeft = minutes % 60;
        const hoursLeft = hours % 24;
        const daysLeft = days % 365;

        let timeString = "";
        if (years > 0) timeString += `${years}y `;
        if (daysLeft > 0) timeString += `${daysLeft}d `;
        if (years < 1 && (hoursLeft > 0 || daysLeft > 0)) timeString += `${hoursLeft}h `;
        if (days < 1 && (minutesLeft > 0 || hoursLeft > 0)) timeString += `${minutesLeft}m `;
        if (hours < 1) timeString += `${secondsLeft.toFixed(minutesLeft > 0 ? 0 : 2)}s`;

        // gradient color map. less than 1 minute is green, less than 1 hour is yellow, less than 1 day is orange, and more than 1 day is red.
        let color = "#00ff00";
        if (seconds < 60) {
            color = "#00ff00";
        } else if (seconds < 3600) {
            const percent = seconds / 3600;
            const hue = Math.floor(60 - (60 * percent));
            color = `hsl(${hue}, 100%, 50%)`;
        } else if (seconds < 86400) {
            const percent = seconds / 86400;
            const hue = Math.floor(30 - (30 * percent));
            color = `hsl(${hue}, 100%, 50%)`;
        } else {
            color = "#ff0000";
        }

        return <span style={{ color: color }}>{timeString}</span>;
    }

    const horizontalLine = () => {
        return (
            <Box sx={{ width: "100%", height: '1px !important', backgroundColor: "#555", my: 1, px: 2 }} />
        )
    }

    const verticalLine = () => {
        return (
            <Box sx={{ width: "1px !important", height: '20px !important', backgroundColor: "#777", ml: 1, mr: 0.5, mt: 0.2 }} />
        )
    }

    // small supertext allcaps title
    const subheading = (text: string) => {
        return (
            <Typography variant="subtitle2" sx={{ textTransform: "uppercase", fontSize: 10, fontWeight: "bold",  textAlign: "center", color: "#bbb" }}>
                {text}
            </Typography>
        )
    }

    return (
        <Container sx={{ mt: 4, display: "flex", justifyContent: "center", flexDirection: "column", maxWidth: '100% !important' }}>
            <Container sx={{ display: "flex", justifyContent: "center", mb: 4, maxWidth: '1300px !important' }}>
                { /* Left side box (Calculator) */ }
                <Box component="form" sx={{ width: "100%", maxWidth: 450, display: "flex", flexDirection: "column", gap: 1.5 }} noValidate autoComplete="off" >
                    <Paper sx={{ p: 1, mb: 2}} elevation={3}>
                        <Box sx={{ p: 0.5, display: "flex", alignItems: "center" }}>
                            <Typography variant="subtitle1" sx={{width: 250}}>
                                {imgIcon("https://static.wikia.nocookie.net/bgs-infinity/images/5/5b/Common_Egg.png", 20, 0, 4)}
                                Egg:
                            </Typography>
                            <Select
                                value={selectedEgg?.name || "None"}
                                size="small"
                                sx={{ flexGrow: 1, mr: 1 }}
                                onChange={(e) => {
                                    const selectedEgg = eggs.find(egg => egg.name === e.target.value);
                                    if (selectedEgg) setSelectedEgg(selectedEgg);
                                }}
                            >
                                <MenuItem value="None">None</MenuItem>
                                {
                                    eggs.map((egg) => (
                                        <MenuItem key={egg.name} value={egg.name}>
                                            <img src={egg.image} alt={egg.name} style={{ width: 20, height: 20, marginRight: 8 }} />
                                            {egg.name}
                                        </MenuItem>
                                    ))
                                }
                            </Select>
                        </Box>
                        <Box sx={{ p: 0.5, display: "flex", alignItems: "center" }}>
                            <Typography variant="subtitle1" sx={{width: 250}}>
                                {imgIcon("https://static.wikia.nocookie.net/bgs-infinity/images/f/fe/Floating_Island_Icon.png", 24, 0, 2)}
                                Rift:
                            </Typography>
                            <Select
                                value={calculatorSettings.riftMultiplier}
                                size="small"
                                sx={{ flexGrow: 1, mr: 1 }}
                                onChange={(e) => setCalculatorSettings({ ...calculatorSettings, riftMultiplier: e.target.value as RiftMultiplier })}
                            >
                                <MenuItem value={0}>None</MenuItem>
                                <MenuItem value={5}>5x (500%)</MenuItem>
                                <MenuItem value={10}>10x (1000%)</MenuItem>
                                <MenuItem value={25}>25x (2500%)</MenuItem>
                            </Select>
                        </Box>
                        <Tabs value={settingsTab} onChange={(_e, newValue) => setSettingsTab(newValue)} variant="fullWidth" sx={{ width: "100%", mb: 1 }}>
                            <Tab sx={{fontSize:12}} label="Luck Settings" value={0} />
                            <Tab sx={{fontSize:12}} label="Speed Settings" value={1} />
                            <Tab sx={{fontSize:12}} label="Secret Bounty" value={2} />
                        </Tabs>
                        {
                            settingsTab === 0 && (
                                <>
                                <Box sx={{ p: 0.5, display: "flex", alignItems: "center" }}>
                                    <Typography variant="subtitle1" sx={{width: 250}}>
                                        {imgIcon("https://static.wikia.nocookie.net/bgs-infinity/images/f/f1/Lucky_Evolved.png", 24)}
                                        Lucky Potion:</Typography>
                                    <Select
                                        value={calculatorSettings.luckyPotion}
                                        size="small"
                                        sx={{ flexGrow: 1, mr: 1 }}
                                        onChange={(e) => setCalculatorSettings({ ...calculatorSettings, luckyPotion: e.target.value as LuckyPotion })}
                                    >
                                        <MenuItem value={0}>None</MenuItem>
                                        <MenuItem value={400}>Lucky Evolved</MenuItem>
                                        <MenuItem value={150}>Lucky V</MenuItem>
                                        <MenuItem value={65}>Lucky IV</MenuItem>
                                        <MenuItem value={30}>Lucky III</MenuItem>
                                        <MenuItem value={20}>Lucky II</MenuItem>
                                        <MenuItem value={10}>Lucky I</MenuItem>
                                    </Select>
                                </Box>

                                <Box sx={{ p: 0.5, display: "flex", alignItems: "center" }}>
                                    <Typography variant="subtitle1" sx={{width: 250}}>
                                        {imgIcon("https://static.wikia.nocookie.net/bgs-infinity/images/d/df/Mythic_Evolved.png", 24)} 
                                        Mythic Potion:
                                        </Typography>
                                    <Select
                                        value={calculatorSettings.mythicPotion}
                                        size="small"
                                        sx={{ flexGrow: 1, mr: 1 }}
                                        onChange={(e) => setCalculatorSettings({ ...calculatorSettings, mythicPotion: e.target.value as MythicPotion })}
                                    >
                                        <MenuItem value={0}>None</MenuItem>
                                        <MenuItem value={250}>Mythic Evolved</MenuItem>
                                        <MenuItem value={150}>Mythic V</MenuItem>
                                        <MenuItem value={75}>Mythic IV</MenuItem>
                                        <MenuItem value={30}>Mythic III</MenuItem>
                                        <MenuItem value={20}>Mythic II</MenuItem>
                                        <MenuItem value={10}>Mythic I</MenuItem>
                                    </Select>
                                </Box>

                                <Box sx={{ p: 0.5, display: "flex", alignItems: "center" }}>
                                    <Typography variant="subtitle1" sx={{width: 250}}>
                                        {imgIcon("https://static.wikia.nocookie.net/bgs-infinity/images/c/ce/Infinity_Elixir.png", 24)}
                                        Infinity Elixir:
                                    </Typography>
                                    <Checkbox
                                        checked={calculatorSettings.infinityElixir}
                                        onChange={(e) => setCalculatorSettings({ ...calculatorSettings, infinityElixir: e.target.checked })}
                                    />
                                </Box>

                                <Box sx={{ p: 0.5, display: "flex", alignItems: "center" }}>
                                    <Typography variant="subtitle1" sx={{width: 250}}>
                                        {imgIcon("https://static.wikia.nocookie.net/bgs-infinity/images/1/1f/Gamepass_-_Double_Luck.png", 16, 3, 5)}
                                        Double Luck Gamepass:
                                    </Typography>
                                    <Checkbox
                                        checked={calculatorSettings.doubleLuckGamepass}
                                        onChange={(e) => setCalculatorSettings({ ...calculatorSettings, doubleLuckGamepass: e.target.checked })}
                                    />
                                </Box>

                                {
                                    selectedEgg?.index && (
                                        <>
                                        <Box sx={{ p: 0.5, display: "flex", alignItems: "center" }}>
                                            <Typography variant="subtitle1" sx={{width: 250}}>
                                                {imgIcon("https://static.wikia.nocookie.net/bgs-infinity/images/d/da/Index_Icon.png", 20, 0, 4)}
                                                {selectedEgg.index} Index:
                                            </Typography>
                                            <Typography variant="subtitle1">
                                                Normal:
                                            </Typography>
                                            <Checkbox
                                                checked={calculatorSettings.normalIndex.includes(selectedEgg.index)}
                                                onChange={(e) => setCalculatorSettings({ ...calculatorSettings, normalIndex: e.target.checked ? [...calculatorSettings.normalIndex, selectedEgg.index] : calculatorSettings.normalIndex.filter(index => index !== selectedEgg.index) })}
                                            />
                                            <Typography variant="subtitle1">
                                                Shiny:
                                            </Typography>
                                            <Checkbox
                                                checked={calculatorSettings.shinyIndex.includes(selectedEgg.index)}
                                                onChange={(e) => setCalculatorSettings({ ...calculatorSettings, shinyIndex: e.target.checked ? [...calculatorSettings.shinyIndex, selectedEgg.index] : calculatorSettings.shinyIndex.filter(index => index !== selectedEgg.index) })}
                                            />
                                        </Box>
                                        </>
                                    )
                                }

                                <Box sx={{ p: 0.5, display: "flex", alignItems: "center" }}>
                                    <Typography variant="subtitle1" sx={{width: 250}}>
                                        {imgIcon("https://static.wikia.nocookie.net/bgs-infinity/images/d/d7/Lucky_Streak_Icon.png", 24, 0, 4)}
                                        Lucky Streak:
                                    </Typography>
                                    <Select
                                        value={calculatorSettings.luckyStreak}
                                        size="small"
                                        sx={{ flexGrow: 1, mr: 1 }}
                                        onChange={(e) => setCalculatorSettings({ ...calculatorSettings, luckyStreak: e.target.value as LuckyStreak })}
                                    >
                                        <MenuItem value={0}>None</MenuItem>
                                        <MenuItem value={30}>Lucky II (30%)</MenuItem>
                                        <MenuItem value={20}>Lucky I (20%)</MenuItem>
                                    </Select>
                                </Box>
                            
                                <Box sx={{ p: 0.5, display: "flex", alignItems: "center" }}>
                                    <Typography variant="subtitle1" sx={{width: 250}}>🎲 High Roller Pets:</Typography>
                                    <TextField
                                        label="Pets"
                                        variant="outlined"
                                        size="small"
                                        value={calculatorSettings.highRoller}
                                        onChange={(e) => setCalculatorSettings({ ...calculatorSettings, highRoller: e.target.value ? Number(e.target.value) : 0 })}
                                        sx={{ flexGrow: 1, mr: 1, ml: 7.7 }}
                                    />
                                </Box>
                            
                                <Box sx={{ p: 0.5, display: "flex", alignItems: "center" }}>
                                    <Typography variant="subtitle1" sx={{width: 250}}>
                                        {imgIcon("https://static.wikia.nocookie.net/bgs-infinity/images/5/5d/Luckier_Together_Icon.png", 24, 0, 4)}
                                        Luckier Together:
                                    </Typography>
                                    <TextField
                                        label="Friends"
                                        variant="outlined"
                                        size="small"
                                        value={calculatorSettings.friendBoost}
                                        onChange={(e) => setCalculatorSettings({ ...calculatorSettings, friendBoost: e.target.value ? Number(e.target.value) : 0 })}
                                        sx={{ flexGrow: 1, mr: 1, ml: 7.7 }}
                                    />
                                </Box>

                                <Box sx={{ p: 0.5, display: "flex", alignItems: "center" }}>
                                    <Typography variant="subtitle1" sx={{width: 250}}>
                                        {imgIcon("https://static.wikia.nocookie.net/bgs-infinity/images/a/ad/Dice_Icon.png", 20, 0, 4)} 
                                        Board game +200%:
                                    </Typography>
                                    <Checkbox
                                        checked={calculatorSettings.boardGameLuckBoost}
                                        onChange={(e) => setCalculatorSettings({ ...calculatorSettings, boardGameLuckBoost: e.target.checked })}
                                    />
                                </Box>
                            
                                <Box sx={{ p: 0.5, display: "flex", alignItems: "center" }}>
                                    <Typography variant="subtitle1" sx={{width: 250}}>🎉 Double Luck event:</Typography>
                                    <Checkbox
                                        checked={calculatorSettings.doubleLuckEvent}
                                        onChange={(e) => setCalculatorSettings({ ...calculatorSettings, doubleLuckEvent: e.target.checked })}
                                    />
                                </Box>
                                </>
                            )
                        }
                        {
                            settingsTab === 1 && (
                                <>
                                <Box sx={{ p: 0.5, display: "flex", alignItems: "center" }}>
                                    <Typography variant="subtitle1" sx={{width: 250}}>
                                        {imgIcon("https://static.wikia.nocookie.net/bgs-infinity/images/2/2e/Speed_Evolved.png", 24)} 
                                        Speed Potion:
                                        </Typography>
                                    <Select
                                        value={calculatorSettings.speedPotion}
                                        size="small"
                                        sx={{ flexGrow: 1, mr: 1 }}
                                        onChange={(e) => setCalculatorSettings({ ...calculatorSettings, speedPotion: e.target.value as SpeedPotion })}
                                    >
                                        <MenuItem value={0}>None</MenuItem>
                                        <MenuItem value={100}>Speed Evolved</MenuItem>
                                        <MenuItem value={40}>Speed V</MenuItem>
                                        <MenuItem value={25}>Speed IV</MenuItem>
                                        <MenuItem value={20}>Speed III</MenuItem>
                                        <MenuItem value={15}>Speed II</MenuItem>
                                        <MenuItem value={10}>Speed I</MenuItem>
                                    </Select>
                                </Box>
                                
                                <Box sx={{ p: 0.5, display: "flex", alignItems: "center" }}>
                                    <Typography variant="subtitle1" sx={{width: 250}}>
                                        {imgIcon("https://static.wikia.nocookie.net/bgs-infinity/images/c/ce/Infinity_Elixir.png", 24)}
                                        Infinity Elixir:
                                    </Typography>
                                    <Checkbox
                                        checked={calculatorSettings.infinityElixir}
                                        onChange={(e) => setCalculatorSettings({ ...calculatorSettings, infinityElixir: e.target.checked })}
                                    />
                                </Box>

                                <Box sx={{ p: 0.5, display: "flex", alignItems: "center" }}>
                                    <Typography variant="subtitle1" sx={{width: 250}}>
                                        {imgIcon("https://static.wikia.nocookie.net/bgs-infinity/images/0/0d/Gamepass_-_Fast_Hatch.png", 20, 0, 4)}
                                        Fast Hatch Gamepass:
                                    </Typography>
                                    <Checkbox
                                        checked={calculatorSettings.fastHatchGamepass}
                                        onChange={(e) => setCalculatorSettings({ ...calculatorSettings, fastHatchGamepass: e.target.checked })}
                                    />
                                </Box>

                                <Box sx={{ p: 0.5, display: "flex", alignItems: "center" }}>
                                    <Typography variant="subtitle1" sx={{width: 250}}>
                                        {imgIcon("https://static.wikia.nocookie.net/bgs-infinity/images/4/4b/Fast_Hatch_Icon.png", 20, 0, 4)}
                                        Fast Hatch Mastery:
                                    </Typography>
                                    <Checkbox
                                        checked={calculatorSettings.fastHatchMastery}
                                        onChange={(e) => setCalculatorSettings({ ...calculatorSettings, fastHatchMastery: e.target.checked })}
                                    />
                                </Box>

                                <Box sx={{ p: 0.5, display: "flex", alignItems: "center" }}>
                                    <Typography variant="subtitle1" sx={{width: 250}}>
                                        {imgIcon("https://static.wikia.nocookie.net/bgs-infinity/images/8/89/Multi_Egg_Icon.png", 20, 0, 4)}
                                        Eggs per Hatch:
                                    </Typography>
                                    <TextField
                                        label="Eggs"
                                        variant="outlined"
                                        size="small"
                                        value={calculatorSettings.eggsPerHatch}
                                        onChange={(e) => setCalculatorSettings({ ...calculatorSettings, eggsPerHatch: e.target.value ? Number(e.target.value) : 1 })}
                                        sx={{ flexGrow: 1, mr: 1, ml: 7.7 }}
                                    />
                                </Box>
                                </>
                            )
                        }
                        {
                            settingsTab === 2 && (
                                <>
                                <Box sx={{ p: 0.5, display: "flex", alignItems: "center" }}>
                                    <Typography variant="subtitle1" sx={{width: 250}}>
                                        {imgIcon("https://static.wikia.nocookie.net/bgs-infinity/images/2/28/Pet_Equips_Icon.png", 24, 0, 4)}
                                        Secret Bounty Pet:
                                    </Typography>
                                    <Select 
                                        value={calculatorSettings.secretsBountyPet || "None"}
                                        size="small"
                                        sx={{ flexGrow: 1, mr: 1 }}
                                        onChange={(e) => {
                                            const selectedPet = secretBountyPets.find(pet => pet.name === e.target.value);
                                            setCalculatorSettings({ ...calculatorSettings, secretsBountyPet: selectedPet?.name || "" });
                                        }}
                                        >
                                        <MenuItem value="None">None</MenuItem>
                                        {
                                            secretBountyPets.map((pet) => (
                                                <MenuItem key={pet.name} value={pet.name}>
                                                    <img src={pet.image[0]} alt={pet.name} style={{ width: 24, height: 24, marginRight: 8 }} />
                                                    {pet.name}
                                                </MenuItem>
                                            ))
                                        }
                                    </Select>
                                </Box>
                                <Box sx={{ p: 0.5, display: "flex", alignItems: "center" }}>
                                    <Typography variant="subtitle1" sx={{width: 250}}>
                                        {imgIcon("https://static.wikia.nocookie.net/bgs-infinity/images/8/89/Multi_Egg_Icon.png", 20, 0, 8)}
                                        Secret Bounty Egg:
                                    </Typography>
                                    <Select 
                                        value={calculatorSettings.secretsBountyEgg || "None"}
                                        size="small"
                                        sx={{ flexGrow: 1, mr: 1 }}
                                        onChange={(e) => {
                                            const selectedEgg = eggs.find(egg => egg.name === e.target.value);
                                            setCalculatorSettings({ ...calculatorSettings, secretsBountyEgg: selectedEgg?.name || "" });
                                        }}
                                        >
                                        <MenuItem value="None">None</MenuItem>
                                        {
                                            eggs.filter((egg) => !egg.name.includes("Infinity")).map((egg) => (
                                                <MenuItem key={egg.name} value={egg.name}>
                                                    <img src={egg.image} alt={egg.name} style={{ width: 24, height: 24, marginRight: 8 }} />
                                                    {egg.name}
                                                </MenuItem>
                                            ))
                                        }
                                    </Select>
                                </Box>
                                <Typography variant="subtitle1" sx={{width: '100%', fontSize: 13, textAlign: 'center', mb: 1}}>
                                    <b>Note: Refresh page after you change secret bounty settings.</b>
                                </Typography>
                                </>
                            )
                        }
                    </Paper>
                </Box>
                
                { /* Right box (Results) */ }
                <Box component="form" sx={{ width: "100%", maxWidth: '100% !important', display: "flex", flexDirection: "column", gap: 1.5, pl: 2, alignItems: 'center' }} noValidate autoComplete="off" >
                    <Tabs value={resultsTab} onChange={(_e, newValue) => setResultsTab(newValue)} variant="fullWidth" sx={{ width: "100%", mb: 1 }}>
                        <Tab label="Hatch Rates" value={0} />
                        <Tab label="Average Hatch Times" value={1} />
                    </Tabs>
                    { /* Luck Debug */ }
                    <Paper sx={{ p: 1,  width: "100% !important"}} elevation={3}>
                        {
                            calculatorResults && (
                                <Box sx={{ display: "flex", justifyContent: "space-evenly", flexDirection: 'row' }}>
                                    {
                                        resultsTab === 0 ? (
                                            <>
                                            <Box>
                                                🍀 Luck: <b>{calculatorResults.luckyBuff || 0}%</b>
                                            </Box>
                                            <Box>
                                                ✨ Shiny: <b>1 / {(1 / calculatorResults.shinyRate || 0).toLocaleString(undefined, { maximumFractionDigits: 1})}</b>
                                            </Box>
                                            <Box>
                                                🔮 Mythic: <b>1 / {(1 / calculatorResults.mythicRate || 0).toLocaleString(undefined, { maximumFractionDigits: 1})}</b>
                                            </Box>
                                            <Box>
                                                💫 Shiny Mythic: <b>1 / {(1 / calculatorResults.shinyMythicRate || 0).toLocaleString(undefined, { maximumFractionDigits: 1})}</b>
                                            </Box>
                                            </>
                                        ) : (
                                            <>
                                            <Box>
                                                ⚡ Speed: <b>{calculatorResults.speed || 0}%</b>
                                            </Box>
                                            <Box>
                                                ⏱️ Hatches per second: <b>{(calculatorResults.hatchesPerSecond || 0).toLocaleString(undefined, { maximumFractionDigits: 3})}</b>
                                            </Box>
                                            </>
                                        )
                                    }
                                </Box>
                            )
                        }
                    </Paper>
                    <Paper sx={{ p: 1, mb: 2 }} elevation={3}>
                        <Table size="small" sx={{ "& .MuiTableCell-root": { p: 0.5 } }}>
                            <TableHead>
                              <TableRow>
                                <TableCell sx={{ width: 400, fontWeight: "bold" }}>
                                  Pet
                                </TableCell>
                                <TableCell sx={{ width: 200, fontWeight: "bold" }}>
                                 🥚 Normal
                                </TableCell>
                                <TableCell sx={{ width: 200, fontWeight: "bold" }}>
                                  ✨ Shiny
                                </TableCell>
                                <TableCell sx={{ width: 200, fontWeight: "bold" }}>
                                  🔮 Mythic
                                </TableCell>
                                <TableCell sx={{ width: 200, fontWeight: "bold" }}>
                                  💫 Shiny Mythic
                                </TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                                {
                                    calculatorResults && calculatorResults.petResults.map((result, index) => {
                                        return (
                                            <TableRow key={index} sx={{ "&:last-child td, &:last-child th": { border: 0 }, "&:hover": { backgroundColor: "#333" } }}>
                                                <TableCell>
                                                    <Link
                                                      href={`https://bgs-infinity.fandom.com/wiki/${result.pet.name}`}
                                                      target="_blank"
                                                      style={{ textDecoration: "none", color: "inherit", display: "flex", alignItems: "center" }}
                                                    >
                                                        <img src={result.pet.image[0]} alt={result.pet.name} style={{ width: 24, height: 24, marginRight: 8 }} />
                                                        <span style={getRarityStyle(result.pet.rarity)}>{result.pet.name}</span>
                                                    </Link>
                                                </TableCell>
                                                <TableCell sx={{ display: 'table-cell !important' }}>
                                                    { resultsTab === 0 ? formatChanceResult(result.normalChance) : formatTimeResult(result.normalDroptime) }
                                                </TableCell>
                                                <TableCell>
                                                    { resultsTab === 0 ? formatChanceResult(result.shinyChance) : formatTimeResult(result.shinyDroptime) }
                                                </TableCell>
                                                <TableCell>
                                                    { resultsTab === 0 ? formatChanceResult(result.mythicChance) : formatTimeResult(result.mythicDroptime) }
                                                </TableCell>
                                                <TableCell>
                                                    { resultsTab === 0 ? formatChanceResult(result.shinyMythicChance) : formatTimeResult(result.shinyMythicDroptime) }
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })
                                }
                            </TableBody>
                        </Table>
                    </Paper>
                    {
                        resultsTab === 1 && (
                            <Paper sx={{ p: 1, mb: 2, width: '100%' }} elevation={1}>
                                <Typography variant="subtitle2" sx={{ textTransform: "uppercase", fontSize: 14, fontWeight: "bold",  textAlign: "center", color: "#bbb" }}>
                                    HATCH TIME NOTES:
                                </Typography>
                                <List sx={{ fontSize: 12, lineHeight: 0.5, color: "#bbb" }}>
                                    <ListItem>• It assumes you are spamming E to skip delays and rare pet animations</ListItem>
                                    <ListItem>• It is simply based on the time to reach the pet's drop rate (taking your luck values into account)</ListItem>
                                    <ListItem>• Hatch time calculations have a small margin of error (~0.5%) due to a number of factors (frame rate, lag, etc)</ListItem>
                                </List>
                            </Paper>
                        )
                    }
                </Box>

            </Container>
        </Container>
    );
}