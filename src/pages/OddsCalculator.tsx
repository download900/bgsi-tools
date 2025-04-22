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
  Paper
} from "@mui/material";

const STORAGE_KEY = "oddsCalculatorSettings";

type LuckyPotion = 0 | 10 | 20 | 30 | 65 | 150 | 400;
type MythicPotion = 0 | 10 | 20 | 30 | 75 | 150 | 250;
type IslandMultiplier = 1 | 5 | 10 | 25;
type StreakBuff = 0 | 20 | 30;

interface CalculatorSettings {
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

export function OddsCalculator() {
    const [calculatorSettings, setCalculatorSettings] = useState<CalculatorSettings>({
        baseChance: 1000,
        multiplier: 1,
        luckyPotion: 0,
        mythicPotion: 0,
        streakBuff: 0,
        overworldNormalIndex: false,
        overworldShinyIndex: false,
        highRoller: 0,
        doubleLuckGamepass: false,
        infinityPotion: false,
        friendBoost: 0
    });
    const [calculatorResults, setCalculatorResults] = useState<CalculatorResults | null>(null);

    const loadSettings = () => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) setCalculatorSettings(JSON.parse(saved));
        } catch {}
    }

    const saveSettings = (settings: CalculatorSettings) => {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch {}
    }

    useEffect(() => {
        loadSettings();
    }, []);

    useEffect(() => {
        saveSettings(calculatorSettings);
        handleCalculate();
    }, [calculatorSettings]);

    const handleCalculate = () => {
        // Calculate Lucky value:
        // 1. Add Lucky Potion, Lucky Streak, Overworld Normal Index and High Roller buffs
        let luckyValue = calculatorSettings.luckyPotion 
            + calculatorSettings.streakBuff 
            + (calculatorSettings.overworldNormalIndex ? 50 : 0) 
            + (calculatorSettings.highRoller * 10);
        // 2. Multiply by Double Luck and Infinity Potion (both x2)
        luckyValue *= (calculatorSettings.doubleLuckGamepass ? 2 : 1) * (calculatorSettings.infinityPotion ? 2 : 1);
        // 3. If we have Double Luck, add 100 Flat chance (if infinity potion, 2x that)
        if (calculatorSettings.doubleLuckGamepass) luckyValue += calculatorSettings.infinityPotion ? 200 : 100;
        // 4. If we have Infinity Potion, add 100 Flat chance
        if (calculatorSettings.infinityPotion) luckyValue += 100;
        // 5. Add Friend boost
        luckyValue += calculatorSettings.friendBoost * 10;

        // Calculate Normal chance:
        // 1 / baseChance * IslandMultiplier * (1 + LuckyValue / 100)
        let normalChance = (1 / calculatorSettings.baseChance) * calculatorSettings.multiplier * (1 + luckyValue / 100);

        // Calculate Shiny Multiplier:
        // For Shiny Chance, the only thing that affects it is the normal index and the infinity potion.
        let shinyChance = calculatorSettings.overworldNormalIndex ? 50 : 0;
        let shinyMultiplier = 1 / 40 * (1 + (shinyChance / 100));
        // 2. Infinity potion only affects if shinyChance was not 0.
        shinyMultiplier = shinyChance > 0 ? shinyMultiplier * (calculatorSettings.infinityPotion ? 2 : 1) : shinyMultiplier;

        // Calculate Mythic multiplier:
        // For Mythic Chance, the only thing that affects it is the shiny index, mythic potion and the infinity potion.
        let mythicChance = calculatorSettings.overworldShinyIndex ? 50 : 0;
        mythicChance += calculatorSettings.mythicPotion;
        let mythicMultiplier = 1 / 100 * (1 + (mythicChance / 100));
        // 2. Infinity potion only affects if mythicChance was not 0.
        mythicMultiplier = mythicChance > 0 ? mythicMultiplier * (calculatorSettings.infinityPotion ? 2 : 1) : mythicMultiplier;

        setCalculatorResults({
            luckyValue: luckyValue,
            shinyValue: shinyMultiplier,
            mythicValue: mythicMultiplier,
            shinyMythicValue: shinyMultiplier * mythicMultiplier,
            normalChance: normalChance,
            shinyChance: normalChance * shinyMultiplier,
            mythicChance: normalChance * mythicMultiplier,
            shinyMythicChance: normalChance * shinyMultiplier * mythicMultiplier
        });
    }
    
    // Convert decimal to odds (eg takes 0.025 and turns it into "1/40")
    const convertDecimalToOdds = (decimal: number) => {
        if (decimal === 0) return "1 / ∞";
        const odds = 1 / decimal;
        return `1 / ${odds.toLocaleString(undefined, { maximumFractionDigits: 1 })}`;
    }

    const displayPrettifiedChance = (label: string, chance: number) => {
        return (
            <tr key={label}>
                <td style={{ padding: "8px" }}>{label}:</td>
                <td style={{ padding: "8px" }}><b>{convertDecimalToOdds(chance)}</b></td>
            </tr>
        )
    }

    return (
        <Container sx={{ mt: 4, display: "flex", justifyContent: "center", flexDirection: "column" }}>
            <Typography variant="h4" align="center" gutterBottom>
              Odds Calculator
            </Typography>

            <Container sx={{ display: "flex", justifyContent: "center", mb: 4 }}>
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
                        <Typography variant="subtitle1" sx={{width: 250}}>🥚 Base Pet Rarity:</Typography>
                            <TextField
                            label="1 / "
                            variant="outlined"
                            size="small"
                            value={calculatorSettings.baseChance}
                            onChange={(e) => setCalculatorSettings({ ...calculatorSettings, baseChance: e.target.value ? Number(e.target.value) : 0 })}
                            sx={{ flexGrow: 1, mr: 1 }}
                            />
                        </Box>

                        <Box sx={{ p: 0.5, display: "flex", alignItems: "center" }}>
                            <Typography variant="subtitle1" sx={{width: 250}}>🏝️ Island Multiplier: &nbsp;</Typography>
                            <Select
                              value={calculatorSettings.multiplier}
                              size="small"
                              sx={{ flexGrow: 1, mr: 1 }}
                              onChange={(e) => setCalculatorSettings({ ...calculatorSettings, multiplier: e.target.value as IslandMultiplier })}
                            >
                                <MenuItem value={1}>1x</MenuItem>
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
                            <Typography variant="subtitle1" sx={{width: 250}}>🍀 Double Luck Gamepass:</Typography>
                            <Checkbox
                              checked={calculatorSettings.doubleLuckGamepass}
                              onChange={(e) => setCalculatorSettings({ ...calculatorSettings, doubleLuckGamepass: e.target.checked })}
                            />
                        </Box>

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
                    </Paper>

                    {/* <Button variant="contained" onClick={handleCalculate} sx={{ mt: 2 }}>
                        Calculate
                    </Button> */}

                    <Button variant="outlined" onClick={() => setCalculatorSettings({
                        baseChance: 1000,
                        multiplier: 1,
                        luckyPotion: 0,
                        mythicPotion: 0,
                        streakBuff: 0,
                        overworldNormalIndex: false,
                        overworldShinyIndex: false,
                        highRoller: 0,
                        doubleLuckGamepass: false,
                        infinityPotion: false,
                        friendBoost: 0
                    })} sx={{ mt: 2 }}>
                        Reset
                    </Button>

                </Box>
                
                { /* Right side box (Results) */ }
                
                <Box
                    component="form"
                    sx={{
                      width: "100%",
                      maxWidth: 360,
                      display: "flex",
                      flexDirection: "column",
                      gap: 1.5,
                      paddingLeft: 2
                    }}
                    noValidate
                    autoComplete="off"
                >
                    {
                        calculatorResults ?
                        <>
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
                        <Typography variant="h6" align="center">⚙️ Luck Debug</Typography>
                        <Paper sx={{ p: 1, mb: 2}} elevation={3}>
                            <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
                                <table style={{ borderCollapse: "collapse" }}>
                                    <tbody>
                                        <tr>
                                            <td style={{ padding: "8px" }}>🍀 Lucky:</td>
                                            <td style={{ padding: "8px" }}><b>{calculatorResults.luckyValue}%</b></td>
                                        </tr>
                                        { displayPrettifiedChance("✨ Shiny", calculatorResults.shinyValue) }
                                        { displayPrettifiedChance("🔮 Mythic", calculatorResults.mythicValue) }
                                        { displayPrettifiedChance("💫 Shiny Mythic", calculatorResults.shinyMythicValue) }
                                    </tbody>
                                </table>
                            </Box>
                        </Paper>
                        </>
                        :
                        null
                    }
                </Box>

            </Container>
        </Container>
    );
}