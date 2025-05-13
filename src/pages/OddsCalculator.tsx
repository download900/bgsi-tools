import { JSX, useEffect, useState } from "react";
import { Container, Typography, Box, TextField, Select, MenuItem, Checkbox, Paper, Tooltip, Table, TableBody, TableCell, TableHead,TableRow, Link } from "@mui/material";
import { getRarityStyle, imgIcon } from "../util/StyleUtil";
import { CategoryData, Egg, Pet, SubCategoryData } from "../util/PetUtil";
import Decimal from "decimal.js";

const STORAGE_KEY = "oddsCalculatorSettings";

// Buff data
type LuckyPotion = 0 | 10 | 20 | 30 | 65 | 150 | 400;
type MythicPotion = 0 | 10 | 20 | 30 | 75 | 150 | 250;
type RiftMultiplier = 0 | 5 | 10 | 25;
type LuckyStreak = 0 | 20 | 30;

interface CalculatorSettings {
    selectedEgg: string,
    riftMultiplier: RiftMultiplier;
    luckyPotion: LuckyPotion;
    mythicPotion: MythicPotion;
    luckyStreak: LuckyStreak;
    overworldNormalIndex: boolean;
    overworldShinyIndex: boolean;
    minigameNormalIndex: boolean;
    minigameShinyIndex: boolean;
    minigameLuckBoost: boolean;
    highRoller: number;
    doubleLuckGamepass: boolean;
    infinityPotion: boolean;
    friendBoost: number;
    doubleLuckEvent: boolean;
    secretsBountyPet: string;
    secretsBountyEgg: string;
}

interface CalculatorResults {
    luckyBuff: number;
    shinyRate: number;
    mythicRate: number;
    shinyMythicRate: number;
    petResults: PetResult[];
}

interface PetResult {
    pet: Pet;
    normalDroprate: number;
    shinyDroprate: number;
    mythicDroprate: number;
    shinyMythicDroprate: number;
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
        luckyStreak: 0,
        overworldNormalIndex: false,
        overworldShinyIndex: false,
        minigameNormalIndex: false,
        minigameShinyIndex: false,
        minigameLuckBoost: false,
        highRoller: 0,
        doubleLuckGamepass: false,
        infinityPotion: false,
        friendBoost: 0,
        doubleLuckEvent: false,
        secretsBountyPet: "",
        secretsBountyEgg: "",
    });
    const [calculatorResults, setCalculatorResults] = useState<CalculatorResults>();

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
                setCalculatorSettings(settings);
            } else {
                settings = calculatorSettings;
            }
            
            // Set up infinity eggs
            const infinityEggs: Record<string, InfinityEgg> = {};
            const infinityEggNames: string[] = [];

            // Load secret bounty pets
            const secretPets = props.data.find(cat => cat.name.includes("Other"))?.categories.find(subcat => subcat.name === "Secret Bounty Board")?.eggs[0].pets || [];
            setSecretBountyPets(secretPets);

            // Process eggs for calculator
            const eggs: Egg[] = [];
            for (const category of props.data) {
                if (category.ignoreCalculator) continue;
                for (const subcat of category.categories) {
                    if (subcat.ignoreCalculator) continue;
                    // push new infinity egg to infinityEggs
                    if (category.name.includes("Worlds")) {
                        const egg = { name: subcat.name, pets: [], subcategory: subcat } as InfinityEgg;
                        infinityEggs[subcat.name] = egg;
                        infinityEggNames.push(subcat.name);
                    }
                    for (const egg of subcat.eggs) {
                        if (egg.ignoreCalculator) continue;

                        // add the secret bounty pet to the egg
                        if (settings.secretsBountyPet && settings.secretsBountyEgg === egg.name) {
                            const secretBountyPet = secretPets.find(pet => pet.name === settings.secretsBountyPet);
                            if (secretBountyPet) {
                                console.log("Adding secret bounty pet to egg:", secretBountyPet);
                                egg.pets.push(secretBountyPet);
                            }
                        }

                        eggs.push(egg);

                        if (egg.infinityEgg) {
                            const newPets = structuredClone(egg.pets);
                            infinityEggs[egg.infinityEgg].pets.push(...newPets);
                        }
                    }
                }
            }

            // Process Infinity Eggs:
            infinityEggNames.forEach((eggName) => {
              const egg = infinityEggs[eggName];
              const { pets, subcategory, name } = egg;
                        
              // 1) compute “sum of 1/droprate” per rarity
              const totals = pets.reduce((acc, pet) => {
                  const dec = 1 / pet.droprate;
                  acc[pet.rarity] += dec;
                  return acc;
                }, { Legendary: 0, Secret: 0 } as Record<"Legendary" | "Secret", number>
              );
          
              // 2) recalc each pet’s droprate: new = pet.droprate * (totalDecimalForThisRarity) / rateForThisRarity
              const rateMap = { Legendary: 200, Secret: 40000000 };
              let updatedPets = pets.map((pet) => ({ ...pet,
                  droprate: pet.droprate * totals[pet.rarity] / (1 / rateMap[pet.rarity]),
                })).sort((a, b) => a.droprate - b.droprate);

              // After processing, add "Any Legendary" and "Any Secret" to top of the pet list.
              updatedPets = [
                { name: "Any Legendary", droprate: 200, image: ["https://static.wikia.nocookie.net/bgs-infinity/images/2/24/Infinity_Egg.png"] } as Pet,
                { name: "Any Secret", droprate: 40000000, image: ["https://static.wikia.nocookie.net/bgs-infinity/images/2/24/Infinity_Egg.png"] } as Pet,
                ...updatedPets
              ];
            
              eggs.push({
                name: `Infinity Egg (${name})`,
                image: "https://static.wikia.nocookie.net/bgs-infinity/images/2/24/Infinity_Egg.png",
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
        let shinyRate = 0;
        let mythicRate = 0;

        // Calculate Lucky buff:
        // Add Raw buffs:
        luckyBuff = calculatorSettings.luckyPotion 
            + calculatorSettings.luckyStreak 
            + (calculatorSettings.overworldNormalIndex && egg.subcategory.name === "Overworld" ? 50 : 0) 
            + (calculatorSettings.minigameNormalIndex && egg.subcategory.name === "Minigame Paradise" ? 50 : 0) 
            + (calculatorSettings.highRoller * 10);
        // Double luck gamepass
        if (calculatorSettings.doubleLuckGamepass) luckyBuff *= 2;
        if (calculatorSettings.doubleLuckGamepass) luckyBuff += 100;
        // Double Luck Event and Infinity Potion don't multiply together, they each double the value so far:
        const luckyBuffSubtotal = luckyBuff;
        // Double luck event
        if (calculatorSettings.doubleLuckEvent) luckyBuff += luckyBuffSubtotal;
        if (calculatorSettings.doubleLuckEvent) luckyBuff += 100;
        // Infinity Potion
        if (calculatorSettings.infinityPotion) luckyBuff += luckyBuffSubtotal;
        if (calculatorSettings.infinityPotion) luckyBuff += 100;
        // Add External buffs:
        // Friend boost
        luckyBuff += calculatorSettings.friendBoost * 10;
        // Board Game Luck Boost
        if (calculatorSettings.minigameLuckBoost) luckyBuff += 200;
        // Rift egg multiplier
        if (calculatorSettings.riftMultiplier > 0) luckyBuff += calculatorSettings.riftMultiplier * 100;

        // Calculate Shiny rate:
        let shinyBuff = 0;
        if (calculatorSettings.overworldNormalIndex && egg.subcategory.name === "Overworld") shinyBuff += 50;
        if (calculatorSettings.minigameNormalIndex && egg.subcategory.name === "Minigame Paradise") shinyBuff += 50;
        shinyRate = 1 / 40 * (1 + (shinyBuff / 100)) * (calculatorSettings.infinityPotion ? 2 : 1);

        // Calculate Mythic rate:
        let mythicBuff = 0;
        if (calculatorSettings.overworldShinyIndex && egg.subcategory.name === "Overworld") mythicBuff += 50;
        if (calculatorSettings.minigameShinyIndex && egg.subcategory.name === "Minigame Paradise") mythicBuff += 50;
        mythicBuff += calculatorSettings.mythicPotion;
        mythicRate = 1 / 100 * (1 + (mythicBuff / 100)) * (calculatorSettings.infinityPotion ? 2 : 1);

        const results: CalculatorResults = { 
            luckyBuff: luckyBuff, 
            shinyRate: shinyRate, 
            mythicRate: mythicRate, 
            shinyMythicRate: shinyRate * mythicRate, 
            petResults: [] 
        };

        egg.pets.forEach((pet) => {
            const normalChance = calculateChance(pet.droprate, luckyBuff);

            results.petResults.push({
                pet: pet,
                normalDroprate: normalChance,
                shinyDroprate: normalChance * shinyRate,
                mythicDroprate: normalChance * mythicRate,
                shinyMythicDroprate: normalChance * shinyRate * mythicRate
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
                tooltipString = `${percent.toExponential(2)}%`;
            }
            else {
                tooltipString = `${(percent).toLocaleString(undefined, { maximumFractionDigits: 10 })}%`;
            }
            oddsString = `1 / ${odds.toLocaleString(undefined, { maximumFractionDigits: 0})}`;
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

    const horizontalLine = () => {
        return (
            <Box sx={{ width: "100%", height: '1px !important', backgroundColor: "#555555", my: 1, px: 2 }} />
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
                        {subheading("Egg Settings")}
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

                        { horizontalLine() }
                        {subheading("Buff Settings")}

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
                                checked={calculatorSettings.infinityPotion}
                                onChange={(e) => setCalculatorSettings({ ...calculatorSettings, infinityPotion: e.target.checked })}
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
                            selectedEgg?.subcategory.name === "Overworld" && (
                                <>
                                <Box sx={{ p: 0.5, display: "flex", alignItems: "center" }}>
                                    <Typography variant="subtitle1" sx={{width: 250}}>
                                        {imgIcon("https://static.wikia.nocookie.net/bgs-infinity/images/d/da/Index_Icon.png", 20, 0, 4)}
                                        Overworld Index:
                                    </Typography>
                                    <Typography variant="subtitle1">
                                        Normal:
                                    </Typography>
                                    <Checkbox
                                        checked={calculatorSettings.overworldNormalIndex}
                                        onChange={(e) => setCalculatorSettings({ ...calculatorSettings, overworldNormalIndex: e.target.checked })}
                                    />
                                    <Typography variant="subtitle1">
                                        Shiny:
                                    </Typography>
                                    <Checkbox
                                        checked={calculatorSettings.overworldShinyIndex}
                                        onChange={(e) => setCalculatorSettings({ ...calculatorSettings, overworldShinyIndex: e.target.checked })}
                                    />
                                </Box>
                                </>
                            )
                        }
                        {
                            selectedEgg?.subcategory.name === "Minigame Paradise" && (
                                <>
                                <Box sx={{ p: 0.5, display: "flex", alignItems: "center" }}>
                                    <Typography variant="subtitle1" sx={{width: 250}}>
                                        {imgIcon("https://static.wikia.nocookie.net/bgs-infinity/images/d/da/Index_Icon.png", 20, 0, 4)}
                                        Minigame Paradise Index:
                                    </Typography>
                                    <Typography variant="subtitle1">
                                        Normal:
                                    </Typography>
                                    <Checkbox
                                        checked={calculatorSettings.minigameNormalIndex}
                                        onChange={(e) => setCalculatorSettings({ ...calculatorSettings, minigameNormalIndex: e.target.checked })}
                                    />
                                    <Typography variant="subtitle1">
                                        Shiny:
                                    </Typography>
                                    <Checkbox
                                        checked={calculatorSettings.minigameShinyIndex}
                                        onChange={(e) => setCalculatorSettings({ ...calculatorSettings, minigameShinyIndex: e.target.checked })}
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
                                checked={calculatorSettings.minigameLuckBoost}
                                onChange={(e) => setCalculatorSettings({ ...calculatorSettings, minigameLuckBoost: e.target.checked })}
                            />
                        </Box>

                        <Box sx={{ p: 0.5, display: "flex", alignItems: "center" }}>
                            <Typography variant="subtitle1" sx={{width: 250}}>🎉 Double Luck event:</Typography>
                            <Checkbox
                                checked={calculatorSettings.doubleLuckEvent}
                                onChange={(e) => setCalculatorSettings({ ...calculatorSettings, doubleLuckEvent: e.target.checked })}
                            />
                        </Box>

                        { horizontalLine() }
                        {subheading("Secret Bounty Board")}
                        
                        <Typography variant="subtitle1" sx={{width: '100%', fontSize: 13, textAlign: 'center', mb: 1}}>
                            <b>Refresh page to reload eggs after secret bounty change.</b>
                        </Typography>
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
                    </Paper>
                </Box>
                
                { /* Right box (Results) */ }
                <Box component="form" sx={{ width: "100%", maxWidth: '100% !important', display: "flex", flexDirection: "column", gap: 1.5, pl: 2, alignItems: 'center' }} noValidate autoComplete="off" >
                    { /* Luck Debug */ }
                    <Paper sx={{ p: 1,  width: "100% !important"}} elevation={3}>
                        {
                            calculatorResults && (
                                <Box sx={{ display: "flex", justifyContent: "space-evenly", flexDirection: 'row' }}>
                                    <Box>
                                        🍀 Lucky: <b>{calculatorResults.luckyBuff || 0}%</b>
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
                                                    {formatChanceResult(result.normalDroprate)}
                                                </TableCell>
                                                <TableCell>
                                                    {formatChanceResult(result.shinyDroprate)}
                                                </TableCell>
                                                <TableCell>
                                                    {formatChanceResult(result.mythicDroprate)}
                                                </TableCell>
                                                <TableCell>
                                                    {formatChanceResult(result.shinyMythicDroprate)}
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })
                                }
                            </TableBody>
                        </Table>
                    </Paper>
                </Box>

            </Container>
        </Container>
    );
}