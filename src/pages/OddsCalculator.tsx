import React, { JSX, useEffect, useState } from "react";
import {
  Container,
  Typography,
  Box,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  FormControlLabel,
  Button,
  Paper,
  Tooltip,
  Autocomplete,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Link
} from "@mui/material";
import { getNameAndChanceStyle, rarityColorMap, variants } from "../util/StyleUtil";
import { CategoryData, Egg, Pet } from "../App";
import Decimal from "decimal.js";

const STORAGE_KEY = "oddsCalculatorSettings";

type LuckyPotion = 0 | 10 | 20 | 30 | 65 | 150 | 400;
type MythicPotion = 0 | 10 | 20 | 30 | 75 | 150 | 250;
type IslandMultiplier = 0 | 5 | 10 | 25;
type StreakBuff = 0 | 20 | 30;

interface CalculatorSettings {
    selectedEgg: string,
    //baseChance: number;
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
    pet: Pet;
    normalChance: number;
    shinyChance: number;
    mythicChance: number;
    shinyMythicChance: number;
    luckyValue: number;
    shinyValue: number;
    mythicValue: number;
    shinyMythicValue: number;
}

interface OddsCalculatorProps {
  data: CategoryData[];
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
    const [calculatorResults, setCalculatorResults] = useState<CalculatorResults[]>([]);

    // empirical test inputs
    const [hatches, setHatches] = useState<number>(0);
    const [received, setReceived] = useState<number>(0);

    // list of pets
    const [eggs, setEggs] = useState<Egg[]>([]);
    const [selectedEgg, setSelectedEgg] = useState<Egg | null>(null);

    useEffect(() => {
        if (selectedEgg) {
            setCalculatorSettings({...calculatorSettings, selectedEgg: selectedEgg.name});
        }
    }, [ selectedEgg ]);

    const loadSettings = () => {
        try {
            // remove eggs which have 'ignoreCalculator' set to true, or have no valid pets
            const eggs: Egg[] = [];
            props.data.forEach(category => {
                category.categories.forEach((subcategory) => {
                    subcategory.eggs.forEach(egg => {
                        if (egg.ignoreCalculator) return;
                        if (!egg.pets.some(pet => pet.chance.startsWith("1/") && !pet.ignoreCalculator)) return;
                        eggs.push(egg);
                    });
                });
            });
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

    useEffect(() => {
        loadSettings();
    }, [props.data]);

    useEffect(() => {
        if (props.data?.length > 0) {
            saveSettings(calculatorSettings);
            handleCalculate(selectedEgg as Egg);
        }
    }, [calculatorSettings]);

    const handleCalculate = (egg: Egg) => {
        if (!egg)
            return;

        let luckyValue = 0;
        let shinyValue = 0;
        let mythicValue = 0;

        // Calculate Lucky Value:
        // Add Lucky Potion, Lucky Streak, Overworld Normal Index and High Roller buffs
        luckyValue = calculatorSettings.luckyPotion 
            + calculatorSettings.luckyStreak 
            + (calculatorSettings.overworldNormalIndex && egg.subcategory.name === "Overworld" ? 50 : 0) 
            + (calculatorSettings.minigameNormalIndex && egg.subcategory.name === "Minigame Paradise" ? 50 : 0) 
            + (calculatorSettings.highRoller * 10);
        // Double luck gamepass
        if (calculatorSettings.doubleLuckGamepass) luckyValue *= 2;
        if (calculatorSettings.doubleLuckGamepass) luckyValue += 100;
        const rawLuckyValue = luckyValue;
        // Double luck event
        if (calculatorSettings.doubleLuckEvent) luckyValue += rawLuckyValue;
        if (calculatorSettings.doubleLuckEvent) luckyValue += 100;
        // Infinity Potion
        if (calculatorSettings.infinityPotion) luckyValue += rawLuckyValue;
        if (calculatorSettings.infinityPotion) luckyValue += 100;
        // Friend boost
        luckyValue += calculatorSettings.friendBoost * 10;
        // Add Minigame Luck Boost
        if (calculatorSettings.minigameLuckBoost) luckyValue += 200;
        // Island multiplier
        if (calculatorSettings.multiplier > 0) luckyValue += calculatorSettings.multiplier * 100;

        // Calculate Shiny Multiplier:
        // For Shiny Chance, the only thing that affects it is the normal index and the infinity potion.
        let shinyChance = 0;
        if (calculatorSettings.overworldNormalIndex && egg.subcategory.name === "Overworld") shinyChance += 50;
        if (calculatorSettings.minigameNormalIndex && egg.subcategory.name === "Minigame Paradise") shinyChance += 50;
        let shinyMultiplier = 1 / 40 * (1 + (shinyChance / 100));
        // Infinity potion only affects if shinyChance was not 0.
        shinyValue = shinyChance > 0 ? shinyMultiplier * (calculatorSettings.infinityPotion ? 2 : 1) : shinyMultiplier;

        // Calculate Mythic multiplier:
        // For Mythic Chance, the only thing that affects it is the shiny index, mythic potion and the infinity potion.
        let mythicChance = 0;
        if (calculatorSettings.overworldShinyIndex && egg.subcategory.name === "Overworld") mythicChance += 50;
        if (calculatorSettings.minigameShinyIndex && egg.subcategory.name === "Minigame Paradise") mythicChance += 50;
        mythicChance += calculatorSettings.mythicPotion;
        let mythicMultiplier = 1 / 100 * (1 + (mythicChance / 100));
        // Infinity potion only affects if mythicChance was not 0.
        mythicValue = mythicChance > 0 ? mythicMultiplier * (calculatorSettings.infinityPotion ? 2 : 1) : mythicMultiplier;

        const results: CalculatorResults[] = [];
        egg.pets.forEach((pet) => {
            if (!pet.chance.startsWith("1/") || pet.ignoreCalculator) return;

            const baseChance = Number(pet.chance.split("/")[1].replaceAll(",", ""));

            // Calculate base drop chance
            const n = Decimal(1).plus(luckyValue / 100);//.plus(calculatorSettings.multiplier);
            // 1 - pow(1 - (1 / baseChance), n)
            const dropRate = Decimal(1).minus(Decimal.pow(Decimal(1).minus((Decimal(1).dividedBy(baseChance))), n));
            let normalChance = dropRate as unknown as any;
            
            results.push({
                pet: pet,
                luckyValue: luckyValue,
                shinyValue: shinyValue,
                mythicValue: mythicValue,
                shinyMythicValue: shinyValue * mythicValue,
                normalChance: normalChance,
                shinyChance: normalChance * shinyValue,
                mythicChance: normalChance * mythicValue,
                shinyMythicChance: normalChance * shinyValue * mythicValue
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

            <Container sx={{ display: "flex", justifyContent: "center", mb: 4, maxWidth: '1600px' }}>
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
                      width: "1600px !important",
                      maxWidth: '1600px !important',
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 1.5,
                      paddingLeft: 2
                    }}
                    noValidate
                    autoComplete="off"
                >
                    <Typography variant="h6" align="center">🎲 Pet Odds</Typography>
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
                                    calculatorResults.map((result, index) => {
                                        return (
                                            <TableRow key={index}>
                                                <TableCell sx={{ display: "flex", alignItems: "center" }}>
                                                    <Link
                                                      href={`https://bgs-infinity.fandom.com/wiki/${result.pet.name}`}
                                                      target="_blank"
                                                      style={{ textDecoration: "none", color: "inherit", display: "flex", alignItems: "center" }}
                                                    >
                                                        <img src={result.pet.image[0]} alt={result.pet.name} style={{ width: 24, height: 24, marginRight: 8 }} />
                                                        <span style={getNameAndChanceStyle(result.pet.rarity)}>{result.pet.name}</span>
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

                    {/* Empirical Test */}
                    {/* <Typography variant="h6" align="center" gutterBottom>
                        📊 Dry Checker:
                    </Typography>
                    <Paper sx={{ p: 2, m: 1 }} elevation={3}>
                        <Box sx={{ display: "flex", gap: 2, mb: 2 }}>
                            <TextField
                            label="Eggs hatched"
                            size="small"
                            value={hatches}
                            onChange={e => setHatches(+e.target.value)}
                            fullWidth
                            />
                            <TextField
                            label="Drops"
                            size="small"
                            value={received}
                            onChange={e => setReceived(+e.target.value)}
                            fullWidth
                            />
                        </Box>
                        {hatches > 0 && (
                            <Box>
                            <Typography>
                                Expected drops:{" "}
                                <b>{(calculatorResults.normalChance * hatches).toLocaleString(undefined, { maximumFractionDigits: 5 })}</b>
                            </Typography>
                            {received < (Math.floor(calculatorResults.normalChance * hatches)) ? (
                                <Box sx={{ color: "#f5877f" }}>
                                <Typography>You went dry :(</Typography>
                                </Box>
                            ) : (
                                <Box sx={{ color: "#7ff585" }}>
                                <Typography>You haven't gone dry... yet.</Typography>
                                </Box>
                            )}
                            <Box sx={{ mt: 1, fontStyle: "italic", color: "#888" }}>
                                <Typography variant="body2">
                                There was a <b>{(
                                    (1 - Math.pow(1 - calculatorResults.normalChance, hatches)) *
                                    100
                                ).toFixed(1)}
                                %</b> chance of getting at least one drop by now.
                                </Typography>
                            </Box>
                            </Box>
                        )}
                    </Paper> */}

                    { /* Luck Debug for Advanced Mode */ }
                    <Typography variant="h6" align="center">⚙️ Luck Debug</Typography>
                    <Paper sx={{ p: 1, mb: 2, width: "350px !important"}} elevation={3}>
                            <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
                                <table style={{ borderCollapse: "collapse" }}>
                                    <tbody>
                                        <tr>
                                            <td style={{ padding: "8px" }}>🍀 Lucky:</td>
                                            <td style={{ padding: "8px" }}><b>{calculatorResults[0]?.luckyValue || 0}%</b></td>
                                        </tr>

                                        <tr>
                                            <td style={{ padding: "8px" }}>✨ Shiny:</td>
                                            <td style={{ padding: "8px" }}><b>1 / {(1 / calculatorResults[0]?.shinyValue || 0).toLocaleString(undefined, { maximumFractionDigits: 1})}</b></td>
                                        </tr>
                                        <tr>
                                            <td style={{ padding: "8px" }}>🔮 Mythic:</td>
                                            <td style={{ padding: "8px" }}><b>1 / {(1 / calculatorResults[0]?.mythicValue || 0).toLocaleString(undefined, { maximumFractionDigits: 1})}</b></td>
                                        </tr>
                                        <tr>
                                            <td style={{ padding: "8px" }}>💫 Shiny Mythic:</td>
                                            <td style={{ padding: "8px" }}><b>1 / {(1 / calculatorResults[0]?.shinyMythicValue || 0).toLocaleString(undefined, { maximumFractionDigits: 1})}</b></td>
                                        </tr>
                                    </tbody>
                                </table>
                            </Box>
                        </Paper>
                </Box>

            </Container>
        </Container>
    );
}