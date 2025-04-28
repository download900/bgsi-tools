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
  Autocomplete
} from "@mui/material";
import { getNameAndChanceStyle, rarityColorMap } from "../util/StyleUtil";
import { CategoryData, Pet } from "../App";
import Decimal from "decimal.js";

const STORAGE_KEY = "oddsCalculatorSettings";

type LuckyPotion = 0 | 10 | 20 | 30 | 65 | 150 | 400;
type MythicPotion = 0 | 10 | 20 | 30 | 75 | 150 | 250;
type IslandMultiplier = 0 | 5 | 10 | 25;
type StreakBuff = 0 | 20 | 30;

interface CalculatorSettings {
    selectedPet: string,
    baseChance: number;
    multiplier: IslandMultiplier;
    luckyPotion: LuckyPotion;
    mythicPotion: MythicPotion;
    streakBuff: StreakBuff;
    overworldNormalIndex: boolean;
    overworldShinyIndex: boolean;
    highRoller: number;
    doubleLuckGamepass: boolean;
    infinityPotion: boolean;
    friendBoost: number;

    simpleMode: boolean;
    simpleLucky: number;
    simpleShiny: number;
    simpleMythic: number;
}

interface CalculatorResults {
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
        selectedPet: "",
        baseChance: 1000,
        multiplier: 0,
        luckyPotion: 0,
        mythicPotion: 0,
        streakBuff: 0,
        overworldNormalIndex: false,
        overworldShinyIndex: false,
        highRoller: 0,
        doubleLuckGamepass: false,
        infinityPotion: false,
        friendBoost: 0,
        simpleMode: true,
        simpleLucky: 0,
        simpleShiny: 40,
        simpleMythic: 100
    });
    const [calculatorResults, setCalculatorResults] = useState<CalculatorResults>({
        normalChance: 0,
        shinyChance: 0,
        mythicChance: 0,
        shinyMythicChance: 0,
        luckyValue: 0,
        shinyValue: 0,
        mythicValue: 0,
        shinyMythicValue: 0
    });

    // empirical test inputs
    const [hatches, setHatches] = useState<number>(0);
    const [received, setReceived] = useState<number>(0);

    // list of pets
    const [pets, setPets] = useState<Pet[]>([]);
    const [selectedPet, setSelectedPet] = useState<Pet | null>(null);

    useEffect(() => {
        if (selectedPet) {
            setCalculatorSettings({...calculatorSettings, selectedPet: selectedPet.name});
        }
    }, [ selectedPet ]);

    const loadSettings = () => {
        try {
            // sort pets by name, remove pets which don't have a rarity value that starts with "1/""
            const pets: Pet[] = [];
            props.data.forEach(category => {
                category.categories.forEach((subcategory) => {
                    subcategory.eggs.forEach(egg => {
                        egg.pets.forEach(pet => {
                            if (pet.chance.startsWith("1/") && !pet.discontinued) {
                                pets.push(pet);
                            }
                        });
                    });
                });
            });
            // sort pets by name
            setPets(pets.sort((a, b) => a.name.localeCompare(b.name)));

            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                const newSettings = JSON.parse(saved);
                setCalculatorSettings(newSettings);
                if (pets && pets.length > 0) {
                    const pet = pets.find(pet => pet.name === newSettings.selectedPet);
                    setSelectedPet(pet || pets[0])
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
            handleCalculate();
        }
    }, [calculatorSettings]);

    const handleCalculate = () => {
        if (!selectedPet)
            return;

        let luckyValue = 0;
        let shinyValue = 0;
        let mythicValue = 0;

        if (calculatorSettings.simpleMode) {
            luckyValue = calculatorSettings.simpleLucky;
            shinyValue = 1 / calculatorSettings.simpleShiny;
            mythicValue = 1 / calculatorSettings.simpleMythic;
        }
        else {
            // Calculate Lucky Value:
            // 1. Add Lucky Potion, Lucky Streak, Overworld Normal Index and High Roller buffs
            luckyValue = calculatorSettings.luckyPotion 
            + calculatorSettings.streakBuff 
            + (calculatorSettings.overworldNormalIndex && selectedPet.egg.subcategory.name === "Overworld" ? 50 : 0) 
            + (calculatorSettings.highRoller * 10);
            // 2. Multiply by Double Luck and Infinity Potion (both x2)
            luckyValue *= (calculatorSettings.doubleLuckGamepass ? 2 : 1) * (calculatorSettings.infinityPotion ? 2 : 1);
            // 3. If we have Double Luck, add 100 Flat chance (if infinity potion, 2x that)
            if (calculatorSettings.doubleLuckGamepass) luckyValue += calculatorSettings.infinityPotion ? 200 : 100;
            // 4. If we have Infinity Potion, add 100 Flat chance
            if (calculatorSettings.infinityPotion) luckyValue += 100;
            // 5. Add Friend boost
            luckyValue += calculatorSettings.friendBoost * 10;

            // Calculate Shiny Multiplier:
            // For Shiny Chance, the only thing that affects it is the normal index and the infinity potion.
            let shinyChance = calculatorSettings.overworldNormalIndex && selectedPet.egg.subcategory.name === "Overworld" ? 50 : 0;
            let shinyMultiplier = 1 / 40 * (1 + (shinyChance / 100));
            // 2. Infinity potion only affects if shinyChance was not 0.
            shinyValue = shinyChance > 0 ? shinyMultiplier * (calculatorSettings.infinityPotion ? 2 : 1) : shinyMultiplier;

            // Calculate Mythic multiplier:
            // For Mythic Chance, the only thing that affects it is the shiny index, mythic potion and the infinity potion.
            let mythicChance = calculatorSettings.overworldShinyIndex && selectedPet.egg.subcategory.name === "Overworld" ? 50 : 0;
            mythicChance += calculatorSettings.mythicPotion;
            let mythicMultiplier = 1 / 100 * (1 + (mythicChance / 100));
            // 2. Infinity potion only affects if mythicChance was not 0.
            mythicValue = mythicChance > 0 ? mythicMultiplier * (calculatorSettings.infinityPotion ? 2 : 1) : mythicMultiplier;
        }

        // Calculate base drop chance
        const n = Decimal(1).plus(luckyValue / 100).plus(calculatorSettings.multiplier);
        const dropRate = Decimal(1).minus(Decimal.pow(Decimal(1).minus((Decimal(1).dividedBy(calculatorSettings.baseChance))), n));
        let normalChance = dropRate as unknown as any;
        
        setCalculatorResults({
            luckyValue: luckyValue,
            shinyValue: shinyValue,
            mythicValue: mythicValue,
            shinyMythicValue: shinyValue * mythicValue,
            normalChance: normalChance,
            shinyChance: normalChance * shinyValue,
            mythicChance: normalChance * mythicValue,
            shinyMythicChance: normalChance * shinyValue * mythicValue
        });
    }

    const displayPrettifiedChance = (label: string, chance: number) => {
        let oddsString = "";
        let tooltipString = "";
        //let shortString = "";
        //let rarityColor:React.CSSProperties = { color: "inherit" };
        if (chance != 0) {
            const odds = 1 / chance;
            tooltipString = `${(chance * 100).toLocaleString(undefined, { maximumFractionDigits: 10 })}%`;
            oddsString = `1 / ${odds.toLocaleString(undefined, { maximumFractionDigits: 0})}`;
            //// if greater than 1 billion, round to nearest billion (to 3 places).
            //if (odds > 1_000_000_000) {
            //    shortString = ` (${(odds / 1_000_000_000).toLocaleString(undefined, { maximumFractionDigits: 1 })}B)`;
            //}
            //// if greater than 1 million, round to nearest million (to 2 places).
            //else if (odds > 1_000_000) {
            //    shortString = ` (${(odds / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 1 })}M)`;
            //}
        }
        else {
            oddsString = "1 / ∞";
            tooltipString = "Cannot divide by 0.";
        }

        return (
            <tr key={label}>
                <td style={{ padding: "8px" }}>{label}:</td>
                <Tooltip title={tooltipString} arrow>
                    <td style={{ padding: "8px" }}>
                        <b><span style={{...getNameAndChanceStyle("Secret")}}>{oddsString}</span></b> 
                        {/* { shortString ? <span style={{fontStyle: "italic", fontSize: "0.8em"}}>{shortString}</span> : <></>} */}
                    </td>
                </Tooltip>
            </tr>
        )
    }

    return (
        <Container sx={{ mt: 4, display: "flex", justifyContent: "center", flexDirection: "column" }}>
            <Typography variant="h4" align="center" gutterBottom>
              Odds Calculator
            </Typography>

            <Container sx={{ display: "flex", justifyContent: "center", mb: 4, maxWidth: '900px' }}>
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
                    <Box sx={{ display: "flex", justifyContent: "center", gap: 2 }}>
                        <Button variant={calculatorSettings.simpleMode ? "contained" : "outlined"} onClick={() => setCalculatorSettings({ ...calculatorSettings, simpleMode: true })}>
                            Simple
                        </Button>
                        <Button variant={!calculatorSettings.simpleMode ? "contained" : "outlined"} onClick={() => setCalculatorSettings({ ...calculatorSettings, simpleMode: false })}>
                            Advanced
                        </Button>
                    </Box>

                    <Paper sx={{ p: 1, mb: 2}} elevation={3}>
                        <Box sx={{ p: 0.5, display: "flex", alignItems: "center" }}>
                            <Typography variant="subtitle1" sx={{width: 250}}>🐶 Pet:</Typography>
                            <FormControl fullWidth size="small" sx={{ flexGrow: 1, mr: 1 }}>
                                <Autocomplete
                                    options={pets}
                                    getOptionLabel={(option) => option.name}
                                    onChange={(event, newValue) => {
                                        if (newValue) {
                                            setSelectedPet(newValue);
                                            setCalculatorSettings({ ...calculatorSettings, baseChance: Number(newValue.chance.split("/")[1].replaceAll(",", ""))})
                                        }
                                    }}
                                    renderInput={(params) => <TextField {...params} label="Select a pet" />}
                                    renderOption={(props, option) => (
                                        <li {...props} key={option.name}>
                                            <img src={option.image} alt={option.name} style={{ width: 32, height: 32, marginRight: 8 }} />
                                            <span style={{...getNameAndChanceStyle(option.rarity)}}>{option.name}</span>
                                        </li>
                                    )}
                                    isOptionEqualToValue={(option, value) => option.name === value.name}
                                    noOptionsText="No pets found"
                                    value={selectedPet}
                                />
                            </FormControl>
                            {/* <Typography variant="subtitle1" sx={{width: 250}}>🥚 Pet Drop Chance:</Typography>
                            <TextField
                                label="1 / "
                                variant="outlined"
                                size="small"
                                value={calculatorSettings.baseChance}
                                onChange={(e) => setCalculatorSettings({ ...calculatorSettings, baseChance: e.target.value ? Number(e.target.value) : 0 })}
                                sx={{ flexGrow: 1, mr: 1 }}
                            /> */}
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

                        {
                            calculatorSettings.simpleMode ? 
                            <>
                            <Box sx={{ p: 0.5, display: "flex", alignItems: "center" }}>
                                <Typography variant="subtitle1" sx={{width: 250}}>🍀 Lucky:</Typography>
                                <TextField
                                  label="%"
                                  variant="outlined"
                                  size="small"
                                  value={calculatorSettings.simpleLucky}
                                  onChange={(e) => setCalculatorSettings({ ...calculatorSettings, simpleLucky: e.target.value ? Number(e.target.value) : 0 })}
                                  sx={{ flexGrow: 1, mr: 1 }}
                                />
                            </Box>
                            <Box sx={{ p: 0.5, display: "flex", alignItems: "center" }}>
                                <Typography variant="subtitle1" sx={{width: 250}}>✨ Shiny Chance:</Typography>
                                <TextField
                                  label="1 /"
                                  variant="outlined"
                                  size="small"
                                  value={calculatorSettings.simpleShiny}
                                  onChange={(e) => setCalculatorSettings({ ...calculatorSettings, simpleShiny: e.target.value ? Number(e.target.value) : 0 })}
                                  sx={{ flexGrow: 1, mr: 1 }}
                                />
                            </Box>
                            <Box sx={{ p: 0.5, display: "flex", alignItems: "center" }}>
                                <Typography variant="subtitle1" sx={{width: 250}}>🔮 Mythic Chance:</Typography>
                                <TextField
                                  label="1 /"
                                  variant="outlined"
                                  size="small"
                                  value={calculatorSettings.simpleMythic}
                                  onChange={(e) => setCalculatorSettings({ ...calculatorSettings, simpleMythic: e.target.value ? Number(e.target.value) : 0 })}
                                  sx={{ flexGrow: 1, mr: 1 }}
                                />
                            </Box>
                            </>
                            :
                            <>
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
                                <Typography variant="subtitle1" sx={{width: 250}}>🍀 Double Luck Gamepass:</Typography>
                                <Checkbox
                                  checked={calculatorSettings.doubleLuckGamepass}
                                  onChange={(e) => setCalculatorSettings({ ...calculatorSettings, doubleLuckGamepass: e.target.checked })}
                                />
                            </Box>
    
                            {
                                selectedPet?.egg.subcategory.name === "Overworld" && (
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
                                <Typography variant="subtitle1" sx={{width: 250}}>🔥 Lucky Streak Buff:</Typography>
                                <Select
                                  value={calculatorSettings.streakBuff}
                                  size="small"
                                  sx={{ flexGrow: 1, mr: 1 }}
                                  onChange={(e) => setCalculatorSettings({ ...calculatorSettings, streakBuff: e.target.value as StreakBuff })}
                                >
                                    <MenuItem value={0}>None</MenuItem>
                                    <MenuItem value={30}>Streak II (30%)</MenuItem>
                                    <MenuItem value={20}>Streak I (20%)</MenuItem>
                                </Select>
                            </Box>
                            </>
                        }
                    </Paper>

                    {/* <Button variant="contained" onClick={handleCalculate} sx={{ mt: 2 }}>
                        Calculate
                    </Button> */}

                    <Button variant="outlined" onClick={() => setCalculatorSettings({
                        selectedPet: "",
                        baseChance: 1000,
                        multiplier: 0,
                        luckyPotion: 0,
                        mythicPotion: 0,
                        streakBuff: 0,
                        overworldNormalIndex: false,
                        overworldShinyIndex: false,
                        highRoller: 0,
                        doubleLuckGamepass: false,
                        infinityPotion: false,
                        friendBoost: 0,
                        simpleMode: calculatorSettings.simpleMode,
                        simpleLucky: 0,
                        simpleShiny: 40,
                        simpleMythic: 100
                    })} sx={{ mt: 2 }}>
                        Reset
                    </Button>

                </Box>
                
                { /* Right side box (Results) */ }
                
                <Box
                    component="form"
                    sx={{
                      width: "450px !important",
                      maxWidth: '450px !important',
                      display: "flex",
                      flexDirection: "column",
                      gap: 1.5,
                      paddingLeft: 2
                    }}
                    noValidate
                    autoComplete="off"
                >
                    <Typography variant="h6" align="center">🎲 Pet Odds</Typography>
                        <Paper sx={{ p: 1, mb: 2}} elevation={3}>
                            <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
                                <table style={{ borderCollapse: "collapse" }}>
                                    <tbody>
                                        { displayPrettifiedChance("Normal", calculatorResults.normalChance) }
                                        { displayPrettifiedChance("Shiny", calculatorResults.shinyChance) }
                                        { displayPrettifiedChance("Mythic", calculatorResults.mythicChance) }
                                        { displayPrettifiedChance("Shiny Mythic", calculatorResults.shinyMythicChance) }
                                    </tbody>
                                </table>
                            </Box>
                        </Paper>
                        {/* Empirical Test */}
                        <Typography variant="h6" align="center" gutterBottom>
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
                                {/* If successes > expected successes, let them know they went dry. Otherwise, let them know they got lucky. */}
                                {received < (Math.floor(calculatorResults.normalChance * hatches)) ? (
                                  <Box sx={{ color: "#f5877f" }}>
                                    <Typography>You went dry :(</Typography>
                                  </Box>
                                ) : (
                                  <Box sx={{ color: "#7ff585" }}>
                                    <Typography>You haven't gone dry... yet.</Typography>
                                  </Box>
                                )}
                                {/* X percent of people would have got the drop by now: */}
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
                        </Paper>
                        { /* Luck Debug for Advanced Mode */ }
                        {
                            !calculatorSettings.simpleMode ? 
                            <>
                            <Typography variant="h6" align="center">⚙️ Luck Debug</Typography>
                            <Paper sx={{ p: 1, mb: 2}} elevation={3}>
                                <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
                                    <table style={{ borderCollapse: "collapse" }}>
                                        <tbody>
                                            <tr>
                                                <td style={{ padding: "8px" }}>🍀 Lucky:</td>
                                                <td style={{ padding: "8px" }}><b>{calculatorResults.luckyValue}%</b></td>
                                            </tr>
                                            
                                            <tr>
                                                <td style={{ padding: "8px" }}>✨ Shiny:</td>
                                                <td style={{ padding: "8px" }}><b>1 / {(1 / calculatorResults.shinyValue).toLocaleString(undefined, { maximumFractionDigits: 1})}</b></td>
                                            </tr>
                                            <tr>
                                                <td style={{ padding: "8px" }}>🔮 Mythic:</td>
                                                <td style={{ padding: "8px" }}><b>1 / {(1 / calculatorResults.mythicValue).toLocaleString(undefined, { maximumFractionDigits: 1})}</b></td>
                                            </tr>
                                            <tr>
                                                <td style={{ padding: "8px" }}>💫 Shiny Mythic:</td>
                                                <td style={{ padding: "8px" }}><b>1 / {(1 / calculatorResults.shinyMythicValue).toLocaleString(undefined, { maximumFractionDigits: 1})}</b></td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </Box>
                            </Paper>
                            </>
                            : <></>
                        }
                </Box>

            </Container>
        </Container>
    );
}