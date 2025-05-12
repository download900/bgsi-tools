import { JSX, useEffect, useState } from "react";
import { Container, Typography, Box, TextField, FormControl, Select, MenuItem, Checkbox, Paper, Tooltip, Autocomplete, Table, TableBody, TableCell, TableHead,TableRow, Link } from "@mui/material";
import { getRarityStyle } from "../util/StyleUtil";
import { CategoryData, Egg, Pet, SubCategoryData } from "../util/PetUtil";
import Decimal from "decimal.js";

const STORAGE_KEY = "oddsCalculatorSettings";

// Buff data
type LuckyPotion = 0 | 10 | 20 | 30 | 65 | 150 | 400;
type MythicPotion = 0 | 10 | 20 | 30 | 75 | 150 | 250;
type IslandMultiplier = 0 | 5 | 10 | 25;
type StreakBuff = 0 | 20 | 30;

interface CalculatorSettings {
    selectedEgg: string,
    multiplier: IslandMultiplier;
    luckyPotion: LuckyPotion;
    mythicPotion: MythicPotion;
    luckyStreak: StreakBuff;
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
    normalChance: number;
    shinyChance: number;
    mythicChance: number;
    shinyMythicChance: number;
}

interface OddsCalculatorProps {
  data: CategoryData[];
}

export interface InfinityEgg {
    name: string;
    pets: Pet[];
    legendaryChance: number;
    secretChance: number;
    subcategory: SubCategoryData;
}

export type InfinityEggNames = "Overworld" | "Minigame Paradise";
const infinityEggNames: string[] = ["Overworld", "Minigame Paradise"];

export const infinityEggs: { [key in InfinityEggNames] : InfinityEgg } = {
    "Overworld": {
        name: "Overworld",
        pets: [],
        legendaryChance: 0.005,
        secretChance: 0.000000025,
        subcategory: { name: "Overworld" } as SubCategoryData
    },
    "Minigame Paradise": {
        name: "Minigame Paradise",
        pets: [],
        legendaryChance: 0.005,
        secretChance: 0.000000025,
        subcategory: { name: "Minigame Paradise" } as SubCategoryData
    }
}

export function OddsCalculator(props: OddsCalculatorProps): JSX.Element {
    const [calculatorSettings, setCalculatorSettings] = useState<CalculatorSettings>({
        selectedEgg: "",
        multiplier: 0,
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
        doubleLuckEvent: false
    });
    const [calculatorResults, setCalculatorResults] = useState<CalculatorResults>();

    // list of pets
    const [eggs, setEggs] = useState<Egg[]>([]);
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
            // process eggs into new list for calculator
            const eggs: Egg[] = [];
            props.data.forEach(category => {
                category.categories.forEach((subcategory) => {
                    subcategory.eggs.forEach(egg => {
                        if (egg.ignoreCalculator || !egg.pets.some(pet => !pet.ignoreCalculator)) return;

                        eggs.push(egg);

                        if (egg.infinityEgg) {
                            const newPets = structuredClone(egg.pets);
                            infinityEggs[egg.infinityEgg as InfinityEggNames].pets.push(...newPets);
                        }
                    });
                });
            });

            // add infinity eggs
            infinityEggNames.forEach((infinityEggName) => {
                const infinityEgg = infinityEggs[infinityEggName as InfinityEggNames];
                // 1. Add up the decimal chance of all pets
                let totalDecimalLegendary = 0;
                let totalDecimalSecret = 0;
                infinityEgg.pets.forEach((pet) => {
                    if (pet.rarity === "Legendary")
                        totalDecimalLegendary += 1 / Number(pet.chance.split("/")[1].replaceAll(",", ""));
                    else
                        totalDecimalSecret += 1 / Number(pet.chance.split("/")[1].replaceAll(",", ""));
                });
                // 2. For each pet, recalculate the infinity egg chance:
                infinityEgg.pets.forEach((pet) => {
                    // - divide the pet's original decimal chance by the total decimal chance for the infinity egg
                    let decimalChance = 1 / Number(pet.chance.split("/")[1].replaceAll(",", ""));
                    if (pet.rarity === "Legendary")
                        decimalChance /= totalDecimalLegendary;
                    else
                        decimalChance /= totalDecimalSecret;
                    // - multiply this value by the infinity egg's legendaryChance or secretChance depending on pet rarity
                    let fractionChance = 1 / decimalChance;
                    let newChance = 0;
                    if (pet.rarity === "Legendary")
                        newChance = fractionChance * (1 / infinityEgg.legendaryChance);
                    else 
                        newChance = fractionChance * (1 / infinityEgg.secretChance);
                    pet.chance = `1/${newChance}`;
                });

                eggs.push({
                    name: `Infinity Egg (${infinityEgg.name})`,
                    image: "https://static.wikia.nocookie.net/bgs-infinity/images/2/24/Infinity_Egg.png",
                    pets: infinityEgg.pets.sort((a, b) => Number(a.chance.split("/")[1].replaceAll(",", "")) - Number(b.chance.split("/")[1].replaceAll(",", ""))),
                    subcategory: infinityEgg.subcategory
                } as Egg)                
            })

            // sort eggs by name
            setEggs(eggs.sort((a, b) => a.name.localeCompare(b.name)));

            // load settings
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const newSettings = JSON.parse(saved);
                setCalculatorSettings(newSettings);
                if (eggs && eggs.length > 0) {
                    const egg = eggs.find(egg => egg.name === newSettings.selectedEgg);
                    setSelectedEgg(egg || eggs[0])
                }
            }

        } catch {}
    }

    const saveSettings = (settings: CalculatorSettings) => {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch {}
    }

    // ~~~~~~~~~~~~~ Calculation ~~~~~~~~~~~~~

    useEffect(() => {
        if (props.data?.length > 0) {
            saveSettings(calculatorSettings);
            handleCalculate(selectedEgg as Egg);
        }
    }, [calculatorSettings]);

    const calculateChance = (baseChance:number, luckyBuff: number) => {
        // Calculate base drop chance
        const n = Decimal(1).plus(luckyBuff / 100);
        // The line below is: 1 - pow(1 - (1 / baseChance), n)
        const dropRate = Decimal(1).minus(Decimal.pow(Decimal(1).minus((Decimal(1).dividedBy(baseChance))), n));
        let normalChance = dropRate as unknown as any;
        return normalChance;
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
        const rawLuckyValue = luckyBuff;
        // Double luck event
        if (calculatorSettings.doubleLuckEvent) luckyBuff += rawLuckyValue;
        if (calculatorSettings.doubleLuckEvent) luckyBuff += 100;
        // Infinity Potion
        if (calculatorSettings.infinityPotion) luckyBuff += rawLuckyValue;
        if (calculatorSettings.infinityPotion) luckyBuff += 100;
        // Add External buffs:
        // Friend boost
        luckyBuff += calculatorSettings.friendBoost * 10;
        // Board Game Luck Boost
        if (calculatorSettings.minigameLuckBoost) luckyBuff += 200;
        // Island multiplier
        if (calculatorSettings.multiplier > 0) luckyBuff += calculatorSettings.multiplier * 100;

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
        
        // If infinity egg, calculate chance of any legendary or secret
        if (egg.name.startsWith("Infinity Egg (")) {
            const infinityName = egg.name.split("(")[1].replace(")", "");
            const infinityEgg = infinityEggs[infinityName as InfinityEggNames];

            const legendaryChance = calculateChance(1 / infinityEgg.legendaryChance, luckyBuff);
            const secretChance = calculateChance(1 / infinityEgg.secretChance, luckyBuff);

            results.petResults.push({
                pet: { name: "Any Legendary", chance: `1/${infinityEgg.legendaryChance}`, image: ["https://static.wikia.nocookie.net/bgs-infinity/images/2/24/Infinity_Egg.png"] } as Pet,
                normalChance: legendaryChance,
                shinyChance: legendaryChance * shinyRate,
                mythicChance: legendaryChance * mythicRate,
                shinyMythicChance: legendaryChance * shinyRate * mythicRate
            })
            results.petResults.push({
                pet: { name: "Any Secret", chance: `1/${infinityEgg.legendaryChance}`, image: ["https://static.wikia.nocookie.net/bgs-infinity/images/2/24/Infinity_Egg.png"] } as Pet,
                normalChance: secretChance,
                shinyChance: secretChance * shinyRate,
                mythicChance: secretChance * mythicRate,
                shinyMythicChance: secretChance * shinyRate * mythicRate
            })
        }

        egg.pets.forEach((pet) => {
            if (!pet.chance.startsWith("1/") || pet.ignoreCalculator) return;

            const baseChance = Number(pet.chance.split("/")[1].replaceAll(",", ""));
            const normalChance = calculateChance(baseChance, luckyBuff);

            results.petResults.push({
                pet: pet,
                normalChance: normalChance,
                shinyChance: normalChance * shinyRate,
                mythicChance: normalChance * mythicRate,
                shinyMythicChance: normalChance * shinyRate * mythicRate
            });
        });


        setCalculatorResults(results);
    }

    const formatChanceResult = (chance: number) => {
        let oddsString = "";
        let tooltipString = "";
        if (chance != 0) {
            const odds = 1 / chance;
            tooltipString = `${(chance * 100).toLocaleString(undefined, { maximumFractionDigits: 10 })}%`;
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

    return (
        <Container sx={{ mt: 4, display: "flex", justifyContent: "center", flexDirection: "column", maxWidth: '100% !important' }}>
            <Typography variant="h4" align="center" gutterBottom>
              Odds Calculator
            </Typography>

            <Container sx={{ display: "flex", justifyContent: "center", mb: 4, maxWidth: '1300px !important' }}>
                { /* Left side box (Calculator) */ }
                <Box
                    component="form"
                    sx={{
                      width: "100%",
                      maxWidth: 450,
                      display: "flex",
                      flexDirection: "column",
                      gap: 1.5
                    }}
                    noValidate
                    autoComplete="off"
                >

                    <Paper sx={{ p: 1, mb: 2}} elevation={3}>
                        <Box sx={{ p: 0.5, display: "flex", alignItems: "center" }}>
                            <Typography variant="subtitle1" sx={{width: 250}}>🥚 Egg:</Typography>
                            <FormControl fullWidth size="small" sx={{ flexGrow: 1, mr: 1 }}>
                                <Autocomplete
                                    options={eggs}
                                    getOptionLabel={(option) => option.name}
                                    onChange={(event, newValue) => {
                                        if (newValue) {
                                            setSelectedEgg(newValue);
                                        }
                                    }}
                                    renderInput={(params) => <TextField {...params} label="Select an egg" />}
                                    renderOption={(props, option) => (
                                        <li {...props} key={option.name}>
                                            <img src={option.image} alt={option.name} style={{ width: 32, height: 32, marginRight: 8 }} />
                                            <span>{option.name}</span>
                                        </li>
                                    )}
                                    isOptionEqualToValue={(option, value) => option.name === value.name}
                                    noOptionsText="No eggs found"
                                    value={selectedEgg}
                                />
                            </FormControl>
                        </Box>

                        <Box sx={{ p: 0.5, display: "flex", alignItems: "center" }}>
                            <Typography variant="subtitle1" sx={{width: 250}}>🏝️ Island Multiplier: &nbsp;</Typography>
                            <Select
                              value={calculatorSettings.multiplier}
                              size="small"
                              sx={{ flexGrow: 1, mr: 1 }}
                              onChange={(e) => setCalculatorSettings({ ...calculatorSettings, multiplier: e.target.value as IslandMultiplier })}
                            >
                                <MenuItem value={0}>None</MenuItem>
                                <MenuItem value={5}>5x</MenuItem>
                                <MenuItem value={10}>10x</MenuItem>
                                <MenuItem value={25}>25x</MenuItem>
                            </Select>
                        </Box>

                            <Box sx={{ p: 0.5, display: "flex", alignItems: "center" }}>
                                <Typography variant="subtitle1" sx={{width: 250}}>🍀 Lucky Potion:</Typography>
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
                                <Typography variant="subtitle1" sx={{width: 250}}>🔮 Mythic Potion:</Typography>
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
                                <Typography variant="subtitle1" sx={{width: 250}}>♾️ Infinity Potion:</Typography>
                                <Checkbox
                                  checked={calculatorSettings.infinityPotion}
                                  onChange={(e) => setCalculatorSettings({ ...calculatorSettings, infinityPotion: e.target.checked })}
                                />
                            </Box>
    
                            <Box sx={{ p: 0.5, display: "flex", alignItems: "center" }}>
                                <Typography variant="subtitle1" sx={{width: 250}}>💸 Double Luck Gamepass:</Typography>
                                <Checkbox
                                  checked={calculatorSettings.doubleLuckGamepass}
                                  onChange={(e) => setCalculatorSettings({ ...calculatorSettings, doubleLuckGamepass: e.target.checked })}
                                />
                            </Box>
    
                            {
                                selectedEgg?.subcategory.name === "Overworld" && (
                                    <>
                                    <Box sx={{ p: 0.5, display: "flex", alignItems: "center" }}>
                                        <Typography variant="subtitle1" sx={{width: 250}}>📘 Overworld Normal Index:</Typography>
                                        <Checkbox
                                          checked={calculatorSettings.overworldNormalIndex}
                                          onChange={(e) => setCalculatorSettings({ ...calculatorSettings, overworldNormalIndex: e.target.checked })}
                                        />
                                    </Box>
                                        
                                    <Box sx={{ p: 0.5, display: "flex", alignItems: "center" }}>
                                        <Typography variant="subtitle1" sx={{width: 250}}>📔 Overworld Shiny Index:</Typography>
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
                                        <Typography variant="subtitle1" sx={{width: 250}}>📘 Minigame Normal Index:</Typography>
                                        <Checkbox
                                          checked={calculatorSettings.minigameNormalIndex}
                                          onChange={(e) => setCalculatorSettings({ ...calculatorSettings, minigameNormalIndex: e.target.checked })}
                                        />
                                    </Box>
                                        
                                    <Box sx={{ p: 0.5, display: "flex", alignItems: "center" }}>
                                        <Typography variant="subtitle1" sx={{width: 250}}>📔 Minigame Shiny Index:</Typography>
                                        <Checkbox
                                          checked={calculatorSettings.minigameShinyIndex}
                                          onChange={(e) => setCalculatorSettings({ ...calculatorSettings, minigameShinyIndex: e.target.checked })}
                                        />
                                    </Box>
                                    </>
                                )
                            }
                            
                            <Box sx={{ p: 0.5, display: "flex", alignItems: "center" }}>
                                <Typography variant="subtitle1" sx={{width: 250}}>🌠 Board game +200%:</Typography>
                                <Checkbox
                                  checked={calculatorSettings.minigameLuckBoost}
                                  onChange={(e) => setCalculatorSettings({ ...calculatorSettings, minigameLuckBoost: e.target.checked })}
                                />
                            </Box>
    
                            <Box sx={{ p: 0.5, display: "flex", alignItems: "center" }}>
                                <Typography variant="subtitle1" sx={{width: 250}}>🎲 High Roller Pets:</Typography>
                                <TextField
                                  label="Pets"
                                  variant="outlined"
                                  size="small"
                                  value={calculatorSettings.highRoller}
                                  onChange={(e) => setCalculatorSettings({ ...calculatorSettings, highRoller: e.target.value ? Number(e.target.value) : 0 })}
                                  sx={{ flexGrow: 1, mr: 1 }}
                                />
                            </Box>
    
                            <Box sx={{ p: 0.5, display: "flex", alignItems: "center" }}>
                                <Typography variant="subtitle1" sx={{width: 250}}>👫 Friend Boost:</Typography>
                                <TextField
                                  label="Friends"
                                  variant="outlined"
                                  size="small"
                                  value={calculatorSettings.friendBoost}
                                  onChange={(e) => setCalculatorSettings({ ...calculatorSettings, friendBoost: e.target.value ? Number(e.target.value) : 0 })}
                                  sx={{ flexGrow: 1, mr: 1 }}
                                />
                            </Box>
    
                            <Box sx={{ p: 0.5, display: "flex", alignItems: "center" }}>
                                <Typography variant="subtitle1" sx={{width: 250}}>🔥 Lucky Streak:</Typography>
                                <Select
                                  value={calculatorSettings.luckyStreak}
                                  size="small"
                                  sx={{ flexGrow: 1, mr: 1 }}
                                  onChange={(e) => setCalculatorSettings({ ...calculatorSettings, luckyStreak: e.target.value as StreakBuff })}
                                >
                                    <MenuItem value={0}>None</MenuItem>
                                    <MenuItem value={30}>Streak II (30%)</MenuItem>
                                    <MenuItem value={20}>Streak I (20%)</MenuItem>
                                </Select>
                            </Box>

                            <Box sx={{ p: 0.5, display: "flex", alignItems: "center" }}>
                                <Typography variant="subtitle1" sx={{width: 250}}>🎉 Double Luck event:</Typography>
                                <Checkbox
                                  checked={calculatorSettings.doubleLuckEvent}
                                  onChange={(e) => setCalculatorSettings({ ...calculatorSettings, doubleLuckEvent: e.target.checked })}
                                />
                            </Box>

                            {/* </>
                        } */}

                    </Paper>
                </Box>
                
                { /* Right box (Results) */ }
                
                <Box
                    component="form"
                    sx={{
                      maxWidth: '100% !important',
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 1.5,
                      paddingLeft: 2
                    }}
                    noValidate
                    autoComplete="off"
                >
                    <Paper sx={{ p: 1, mb: 2}} elevation={3}>
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
                                            <TableRow key={index}>
                                                <TableCell sx={{ display: "flex", alignItems: "center" }}>
                                                    <Link
                                                      href={`https://bgs-infinity.fandom.com/wiki/${result.pet.name}`}
                                                      target="_blank"
                                                      style={{ textDecoration: "none", color: "inherit", display: "flex", alignItems: "center" }}
                                                    >
                                                        <img src={result.pet.image[0]} alt={result.pet.name} style={{ width: 24, height: 24, marginRight: 8 }} />
                                                        <span style={getRarityStyle(result.pet.rarity)}>{result.pet.name}</span>
                                                    </Link>
                                                </TableCell>
                                                <TableCell sx={{ fontWeight: "bold" }}>
                                                    {formatChanceResult(result.normalChance)}
                                                </TableCell>
                                                <TableCell sx={{ fontWeight: "bold" }}>
                                                    {formatChanceResult(result.shinyChance)}
                                                </TableCell>
                                                <TableCell sx={{ fontWeight: "bold" }}>
                                                    {formatChanceResult(result.mythicChance)}
                                                </TableCell>
                                                <TableCell sx={{ fontWeight: "bold" }}>
                                                    {formatChanceResult(result.shinyMythicChance)}
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })
                                }
                            </TableBody>
                        </Table>
                    </Paper>

                    { /* Luck Debug for Advanced Mode */ }
                    <Typography variant="h6" align="center">⚙️ Luck Debug</Typography>
                    <Paper sx={{ p: 1, mb: 2, width: "350px !important"}} elevation={3}>
                        {
                            calculatorResults && (
                                <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
                                    <table style={{ borderCollapse: "collapse" }}>
                                        <tbody>
                                            <tr>
                                                <td style={{ padding: "8px" }}>🍀 Lucky:</td>
                                                <td style={{ padding: "8px" }}><b>{calculatorResults.luckyBuff || 0}%</b></td>
                                            </tr>
                                    
                                            <tr>
                                                <td style={{ padding: "8px" }}>✨ Shiny:</td>
                                                <td style={{ padding: "8px" }}><b>1 / {(1 / calculatorResults.shinyRate || 0).toLocaleString(undefined, { maximumFractionDigits: 1})}</b></td>
                                            </tr>
                                            <tr>
                                                <td style={{ padding: "8px" }}>🔮 Mythic:</td>
                                                <td style={{ padding: "8px" }}><b>1 / {(1 / calculatorResults.mythicRate || 0).toLocaleString(undefined, { maximumFractionDigits: 1})}</b></td>
                                            </tr>
                                            <tr>
                                                <td style={{ padding: "8px" }}>💫 Shiny Mythic:</td>
                                                <td style={{ padding: "8px" }}><b>1 / {(1 / calculatorResults.shinyMythicRate || 0).toLocaleString(undefined, { maximumFractionDigits: 1})}</b></td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </Box>
                            )
                        }
                    </Paper>
                </Box>

            </Container>
        </Container>
    );
}