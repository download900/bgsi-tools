import { JSX, useEffect, useState } from "react";
import { Container, Typography, Box, TextField, Select, MenuItem, Checkbox, Paper, Tooltip, Table, TableBody, TableCell, TableHead,TableRow, Link, Tabs, Tab, List, ListItem, FormControlLabel } from "@mui/material";
import { imgIcon } from "../util/StyleUtil";
import { Egg, isAvailable, Pet, PetData } from "../util/DataUtil";
import Decimal from "decimal.js";
import { calculate, CalculatorResults, CalculatorSettings, HatchDayBonus, InfinityEgg, isBuffDay, LuckDayBonus, LuckyPotion, LuckyStreak, MythicPotion, RiftMultiplier, SpeedPotion } from "../util/CalculatorUtil";

const STORAGE_KEY = "oddsCalculatorSettings";

interface OddsCalculatorProps {
  data: PetData | undefined;
}

export function OddsCalculator({ data }: OddsCalculatorProps): JSX.Element {
    const [calculatorSettings, setCalculatorSettings] = useState<CalculatorSettings>({
        selectedEgg: "",
        riftMultiplier: 0,
        luckyPotion: 0,
        mythicPotion: 0,
        speedPotion: 0,
        infinityElixir: false,
        secretElixir: false,
        doubleLuckGamepass: false,
        normalIndex: [],
        shinyIndex: [],
        luckyStreak: 0,
        highRoller: 0,
        secretHunter: 0,
        ultraRoller: 0,
        shinySeeker: 0,
        friendBoost: 0,
        boardGameLuckBoost: false,
        premiumDailyPerks: false,
        bubbleShrineLevel: 1,
        fastHatchGamepass: false,
        fastHatchMastery: false,
        eggsPerHatch: 1,
        doubleLuckEvent: false,
        fastHatchEvent: false,
        doubleSecretEvent: false,
        secretsBountyPet: "",
        secretsBountyEgg: "",
        hatchingTier: 0,
    });
    const [calculatorResults, setCalculatorResults] = useState<CalculatorResults>();

    const [settingsTab, setSettingsTab] = useState(0);
    const [resultsTab, setResultsTab] = useState(0);
    const [usePercentResults, setUsePercentResults] = useState(false);

    // list of pets
    const [eggs, setEggs] = useState<Egg[]>([]);
    const [secretBountyEggs ] = useState<Egg[]>([]);
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
    }, [data]);

    const shouldCalculateEgg = (egg: Egg) => {
        if (egg.luckIgnored || !isAvailable(egg.dateRemoved)) return false;
        return egg.pets.some((pet: Pet) => isAvailable(pet.dateRemoved) && (pet.rarity === "secret" || pet.rarity === "legendary" || pet.rarity === "infinity"));
    }
    
    const loadCalculator = () => {
        try {
            if (!data || data.eggs?.length === 0) {
                setEggs([]);
                setSelectedEgg(null);
                return;
            }
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
            if (settings.bubbleShrineLevel === undefined) settings.bubbleShrineLevel = 0;
            if (settings.hatchingTier === undefined) settings.hatchingTier = 0;
            if (settings.ultraRoller === undefined) settings.ultraRoller = 0;
            if (settings.secretHunter === undefined) settings.secretHunter = 0;
            if (settings.shinySeeker === undefined) settings.shinySeeker = 0;
            setCalculatorSettings(settings);
            
            // Set up infinity eggs
            const infinityEggs: Record<string, InfinityEgg> = {};
            const infinityEggNames: string[] = [];

            // Load secret bounty pets
            const secretPets = data?.categoryLookup["Secret Bounty"].categories
                .flatMap((cat) => cat.pets || [])
                .filter((pet: Pet) => isAvailable(pet.dateRemoved)) || [];
            setSecretBountyPets(secretPets);

            // Load Daily Perks pets
            const dailyPerksPets = data?.categoryLookup["Daily Perks"].categories
                .flatMap((cat) => cat.pets || [])
                .filter((pet: Pet) => isAvailable(pet.dateRemoved)) || [];

            // Process eggs for calculator
            const eggs: Egg[] = [];
            // make a clone to avoid mutating the original data
            const clonedData = structuredClone(data.eggs);

            const processEgg = (egg: Egg) => {
                if (settings.secretsBountyPet && settings.secretsBountyEgg === egg.name) {
                    const secretBountyPet = secretPets.find(pet => pet.name === settings.secretsBountyPet);
                    if (secretBountyPet) {
                        egg.pets.push(secretBountyPet);
                    }
                }

                if (egg.secretBountyRotation) {
                    secretBountyEggs.push(egg);
                }

                // Check Daily Perks pets
                if (isBuffDay("Luck")) {
                    egg.pets.push(...dailyPerksPets.filter(pet => pet.name === "WOMAN FACE GOD"));
                }
                else if (isBuffDay("Hatch")) {
                    egg.pets.push(...dailyPerksPets.filter(pet => pet.name === "Dogcat"));
                }

                if (!shouldCalculateEgg(egg)) return;

                eggs.push(egg);

                // if more than 1 secret, add "Any Secret"
                if (egg.pets.filter((pet: Pet) => pet.rarity === 'secret').length > 1) {
                    // calculate sum of droprates for secrets
                    const totalSecretChance = egg.pets
                        .filter((pet: Pet) => pet.rarity === 'secret')
                        .reduce((sum, pet) => sum + pet.chance, 0);
                    egg.pets.unshift({
                        name: "Any Secret",
                        chance: totalSecretChance,
                        image: ["https://static.wikia.nocookie.net/bgs-infinity/images/2/24/Infinity_Egg.png"],
                        rarity: "secret"
                    } as Pet);
                }

                // check for infinity egg, clone pets to infinity egg
                if (egg.infinityEgg) {
                    if (!infinityEggs[egg.infinityEgg]) {
                        infinityEggs[egg.infinityEgg] = { name: egg.infinityEgg, pets: [] };
                        infinityEggNames.push(egg.infinityEgg);
                    }
                    const newPets = structuredClone(egg.pets.filter((pet: Pet) => pet.rarity.includes('legendary') || pet.rarity === 'secret' || pet.rarity === 'infinity'));
                    infinityEggs[egg.infinityEgg].pets.push(...newPets);
                }
            }
            
            for (const egg of clonedData) {
                processEgg(egg);                
            }

            // Process Infinity Eggs:
            infinityEggNames.forEach((eggName) => {
                const egg = infinityEggs[eggName];

                // Remove "Any X" pets and duplicate pets from infinity eggs (leave 1 of each)
                const seen = new Set<string>();
                egg.pets = egg.pets.filter((pet: Pet) => {
                    if (pet.name.includes("Any ")) return false;
                    if (seen.has(pet.name)) {
                        return false;
                    } else {
                        seen.add(pet.name);
                        return true;
                    }
                });

                const { pets, name } = egg;

                const legendaryRate = 200;
                const secretRate = 40000000;
                        
                // 1) compute sum per rarity
                const totals = pets.reduce((acc, pet) => {
                    const dec = pet.chance;
                    let rarity: "legendary" | "secret";
                    if (pet.rarity === 'secret') rarity = 'secret';
                    else rarity = 'legendary';
                    acc[rarity] += dec;
                    return acc;
                }, { legendary: 0, secret: 0 } as Record<"legendary" | "secret", number>);
              
                // 2) recalc each pet’s droprate: new = pet.chance / total * (100 / rate)
                const rateMap = { legendary: legendaryRate, secret: secretRate };
                let updatedPets = pets.map((pet) => ({ ...pet,
                    chance: pet.chance / totals[pet.rarity === 'secret' ? 'secret' : 'legendary'] * (100 / rateMap[pet.rarity === 'secret' ? 'secret' : 'legendary']),
                })).sort((a, b) => b.chance - a.chance);

                // After processing, add "Any Legendary" and "Any Secret" to top of the pet list.
                updatedPets = [
                    { name: "Any Legendary", rarity: "legendary", chance: 100 / legendaryRate, image: ["https://static.wikia.nocookie.net/bgs-infinity/images/2/24/Infinity_Egg.png"] } as Pet,
                    { name: "Any Secret", rarity: "secret", chance: 100 / secretRate, image: ["https://static.wikia.nocookie.net/bgs-infinity/images/2/24/Infinity_Egg.png"] } as Pet,
                    ...updatedPets
                ];
              
                eggs.push({
                    name: `Infinity Egg (${name})`,
                    image: "https://static.wikia.nocookie.net/bgs-infinity/images/2/24/Infinity_Egg.png",
                    pets: updatedPets
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
        if (data && data.eggs?.length > 0 && selectedEgg) {
            saveSettings(calculatorSettings);
            handleCalculate(selectedEgg as Egg);
        }
    }, [calculatorSettings]);

    // ~~~~~~~~~~~~~ Calculation ~~~~~~~~~~~~~

    const handleCalculate = (egg: Egg) => {
        if (!egg || !selectedEgg || !data) return;
        const results = calculate(egg, calculatorSettings, selectedEgg!);
        results.petResults.sort((a, b) => b.normalChance - a.normalChance);
        setCalculatorResults(results);
    }

    // ~~~~~~~~~~~~~ Render ~~~~~~~~~~~~~

    const formatChanceResult = (chance: number) => {
        let oddsString = "";
        let percentString = "";
        if (chance !== 0) {
            const odds = 100 / chance;
            const percent = chance;
            // if chance is less than 0.0001, use scientific notation
            if (percent < 0.0001) {
                percentString = `${percent.toExponential(3)}%`;
                // replace the "e-" with "e-0" to match how the game displays it
                percentString = percentString.replace("e-", "e-0");
            }
            else {
                percentString = `${(percent).toLocaleString(undefined, { maximumFractionDigits: 6, maximumSignificantDigits: 6 })}%`;
                if (percentString.length > 7) {
                    percentString = `${percent.toFixed(6)}%`;
                }
                //percentString = `${percent.toFixed(6)}%`;
            }
            oddsString = `1 / ${odds.toLocaleString(undefined, { maximumFractionDigits: 1})}`;
        }
        else {
            oddsString = "1 / ∞";
            percentString = "Cannot divide by 0.";
        }

        return usePercentResults ? (<Tooltip title={oddsString}><b>{percentString}</b></Tooltip>) : (<Tooltip title={percentString}><b>{oddsString}</b></Tooltip>
        );
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
            const hue = Math.floor(60 - (30 * percent));
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
                        {
                            selectedEgg?.canSpawnAsRift && (
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
                                    <MenuItem value={15}>15x (1500%)</MenuItem>
                                    <MenuItem value={20}>20x (2000%)</MenuItem>
                                    <MenuItem value={25}>25x (2500%)</MenuItem>
                                </Select>
                            </Box>
                            )
                        }
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
                                        <MenuItem value={600}>Lucky Infinity</MenuItem>
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
                                        <MenuItem value={375}>Mythic Infinity</MenuItem>
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
                                        {imgIcon("https://static.wikia.nocookie.net/bgs-infinity/images/2/21/Secret_Elixir.png", 24)}
                                        Secret Elixir:
                                    </Typography>
                                    <Checkbox
                                        checked={calculatorSettings.secretElixir}
                                        onChange={(e) => setCalculatorSettings({ ...calculatorSettings, secretElixir: e.target.checked })}
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
                                    <Typography variant="subtitle1" sx={{width: 250}}>🎲 Ultra Roller Pets:</Typography>
                                    <TextField
                                        label="Pets"
                                        variant="outlined"
                                        size="small"
                                        value={calculatorSettings.ultraRoller}
                                        onChange={(e) => setCalculatorSettings({ ...calculatorSettings, ultraRoller: e.target.value ? Number(e.target.value) : 0 })}
                                        sx={{ flexGrow: 1, mr: 1, ml: 7.7 }}
                                    />
                                </Box>
                            
                                <Box sx={{ p: 0.5, display: "flex", alignItems: "center" }}>
                                    <Typography variant="subtitle1" sx={{width: 250}}>🔮 Secret Hunter Pets:</Typography>
                                    <TextField
                                        label="Pets"
                                        variant="outlined"
                                        size="small"
                                        value={calculatorSettings.secretHunter}
                                        onChange={(e) => setCalculatorSettings({ ...calculatorSettings, secretHunter: e.target.value ? Number(e.target.value) : 0 })}
                                        sx={{ flexGrow: 1, mr: 1, ml: 7.7 }}
                                    />
                                </Box>
                            
                                <Box sx={{ p: 0.5, display: "flex", alignItems: "center" }}>
                                    <Typography variant="subtitle1" sx={{width: 250}}>🌟 Shiny Seeker Pets:</Typography>
                                    <TextField
                                        label="Pets"
                                        variant="outlined"
                                        size="small"
                                        value={calculatorSettings.shinySeeker}
                                        onChange={(e) => setCalculatorSettings({ ...calculatorSettings, shinySeeker: e.target.value ? Number(e.target.value) : 0 })}
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
                                    <Typography variant="subtitle1" sx={{width: 250}}>
                                        {imgIcon("https://static.wikia.nocookie.net/bgs-infinity/images/3/39/Luck_Icon.png", 24, 0, 4)}
                                        Premium Daily Perks:
                                    </Typography>
                                    <Checkbox 
                                        checked={calculatorSettings.premiumDailyPerks}
                                        onChange={(e) => setCalculatorSettings({ ...calculatorSettings, premiumDailyPerks: e.target.checked })}
                                    />
                                </Box>

                                <Box sx={{ p: 0.5, display: "flex", alignItems: "center" }}>
                                    <Typography variant="subtitle1" sx={{width: 250}}>
                                        {imgIcon("https://static.wikia.nocookie.net/bgs-infinity/images/c/c0/Bubble_Shrine_Icon.png", 24, 0, 4)}
                                        Bubble Shrine Level:
                                    </Typography>
                                    <TextField
                                        label="Level"
                                        variant="outlined"
                                        size="small"
                                        value={calculatorSettings.bubbleShrineLevel}
                                        onChange={(e) => setCalculatorSettings({ ...calculatorSettings, bubbleShrineLevel: e.target.value ? Number(e.target.value) : 0 })}
                                        sx={{ flexGrow: 1, mr: 1, ml: 7.7 }}
                                    />
                                </Box>

                                <Box sx={{ p: 0.5, display: "flex", alignItems: "center" }}>
                                    <Typography variant="subtitle1" sx={{width: 250}}>
                                        {imgIcon("https://static.wikia.nocookie.net/bgs-infinity/images/8/89/Multi_Egg_Icon.png", 20, 0, 4)}
                                        Hatching Milestone:
                                    </Typography>
                                    <Select
                                        value={calculatorSettings.hatchingTier}
                                        size="small"
                                        sx={{ flexGrow: 1, mr: 1 }}
                                        onChange={(e) => setCalculatorSettings({ ...calculatorSettings, hatchingTier: e.target.value as number })}
                                    >
                                        <MenuItem value={0}>Unranked</MenuItem>
                                        <MenuItem value={1}>Bronze I</MenuItem>
                                        <MenuItem value={2}>Bronze II</MenuItem>
                                        <MenuItem value={3}>Bronze III</MenuItem>
                                        <MenuItem value={4}>Silver I</MenuItem>
                                        <MenuItem value={5}>Silver II</MenuItem>
                                        <MenuItem value={6}>Silver III</MenuItem>
                                        <MenuItem value={7}>Gold I</MenuItem>
                                        <MenuItem value={8}>Gold II</MenuItem>
                                        <MenuItem value={9}>Gold III</MenuItem>
                                        <MenuItem value={10}>Platinum I</MenuItem>
                                    </Select>
                                </Box>
                            
                                <Box sx={{ p: 0.5, display: "flex", alignItems: "center" }}>
                                    <Typography variant="subtitle1" sx={{width: 250}}>🎉 Double Luck event:</Typography>
                                    <Checkbox
                                        checked={calculatorSettings.doubleLuckEvent}
                                        onChange={(e) => setCalculatorSettings({ ...calculatorSettings, doubleLuckEvent: e.target.checked })}
                                    />
                                </Box>
                            
                                {/*<Box sx={{ p: 0.5, display: "flex", alignItems: "center" }}>
                                    <Typography variant="subtitle1" sx={{width: 250}}>🥳 Double Secret event:</Typography>
                                    <Checkbox
                                        checked={calculatorSettings.doubleSecretEvent}
                                        onChange={(e) => setCalculatorSettings({ ...calculatorSettings, doubleSecretEvent: e.target.checked })}
                                    />
                                </Box>*/}
                                </>
                            )
                        }
                        {
                            settingsTab === 1 && (
                                <>
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
                                        <MenuItem value={125}>Speed Infinity</MenuItem>
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
                                        {imgIcon("https://static.wikia.nocookie.net/bgs-infinity/images/d/df/Golden_Egg_Icon.png", 24, 0, 4)}
                                        Premium Daily Perks:
                                    </Typography>
                                    <Checkbox 
                                        checked={calculatorSettings.premiumDailyPerks}
                                        onChange={(e) => setCalculatorSettings({ ...calculatorSettings, premiumDailyPerks: e.target.checked })}
                                    />
                                </Box>

                                <Box sx={{ p: 0.5, display: "flex", alignItems: "center" }}>
                                    <Typography variant="subtitle1" sx={{width: 250}}>
                                        {imgIcon("https://static.wikia.nocookie.net/bgs-infinity/images/c/c0/Bubble_Shrine_Icon.png", 24, 0, 4)}
                                        Bubble Shrine Level:
                                    </Typography>
                                    <TextField
                                        label="Level"
                                        variant="outlined"
                                        size="small"
                                        value={calculatorSettings.bubbleShrineLevel}
                                        onChange={(e) => setCalculatorSettings({ ...calculatorSettings, bubbleShrineLevel: e.target.value ? Number(e.target.value) : 0 })}
                                        sx={{ flexGrow: 1, mr: 1, ml: 7.7 }}
                                    />
                                </Box>
                                
                                <Box sx={{ p: 0.5, display: "flex", alignItems: "center" }}>
                                    <Typography variant="subtitle1" sx={{width: 250}}>
                                        {imgIcon("https://static.wikia.nocookie.net/bgs-infinity/images/8/89/Multi_Egg_Icon.png", 20, 0, 4)}
                                        Hatching Milestone:
                                    </Typography>
                                    <Select
                                        value={calculatorSettings.hatchingTier}
                                        size="small"
                                        sx={{ flexGrow: 1, mr: 1 }}
                                        onChange={(e) => setCalculatorSettings({ ...calculatorSettings, hatchingTier: e.target.value as number })}
                                    >
                                        <MenuItem value={0}>Unranked</MenuItem>
                                        <MenuItem value={1}>Bronze I</MenuItem>
                                        <MenuItem value={2}>Bronze II</MenuItem>
                                        <MenuItem value={3}>Bronze III</MenuItem>
                                        <MenuItem value={4}>Silver I</MenuItem>
                                        <MenuItem value={5}>Silver II</MenuItem>
                                        <MenuItem value={6}>Silver III</MenuItem>
                                        <MenuItem value={7}>Gold I</MenuItem>
                                        <MenuItem value={8}>Gold II</MenuItem>
                                        <MenuItem value={9}>Gold III</MenuItem>
                                        <MenuItem value={10}>Platinum I</MenuItem>
                                    </Select>
                                </Box>

                                <Box sx={{ p: 0.5, display: "flex", alignItems: "center" }}>
                                    <Typography variant="subtitle1" sx={{width: 250}}>
                                        🚀 Fast Hatch Event:
                                    </Typography>
                                    <Checkbox
                                        checked={calculatorSettings.fastHatchEvent}
                                        onChange={(e) => setCalculatorSettings({ ...calculatorSettings, fastHatchEvent: e.target.checked })}
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
                                            const selectedEgg = secretBountyEggs.find(egg => egg.name === e.target.value);
                                            setCalculatorSettings({ ...calculatorSettings, secretsBountyEgg: selectedEgg?.name || "" });
                                        }}
                                        >
                                        <MenuItem value="None">None</MenuItem>
                                        {
                                            secretBountyEggs.map((egg) => (
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
                        <Tab label="Hatch Chances" value={0} />
                        <Tab label="Hatch Times" value={1} />
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
                                                {imgIcon('https://static.wikia.nocookie.net/bgs-infinity/images/3/39/Luck_Icon.png', 24)}{' '}
                                                <b>{calculatorResults.luckyBuff || 0}%</b>
                                            </Box>
                                            <Box>
                                                {imgIcon('https://static.wikia.nocookie.net/bgs-infinity/images/a/a1/Secret_Luck_Icon.png', 24)}{' '}
                                                <b>{1 + calculatorResults.secretBuff / 100 || 0}x</b>
                                            </Box>
                                            <Box>
                                                {imgIcon('https://static.wikia.nocookie.net/bgs-infinity/images/1/10/Shiny.png', 24)}{' '}
                                                <b>1 / {(1 / calculatorResults.shinyChance || 0).toLocaleString(undefined, { maximumFractionDigits: 1})}</b>
                                            </Box>
                                            <Box>
                                                {imgIcon('https://static.wikia.nocookie.net/bgs-infinity/images/e/ec/Mythic.png', 24)}{' '}
                                                <b>1 / {(1 / calculatorResults.mythicChance || 0).toLocaleString(undefined, { maximumFractionDigits: 1})}</b>
                                            </Box>
                                            <Box>
                                                {imgIcon('https://static.wikia.nocookie.net/bgs-infinity/images/5/58/Shiny_Mythic.png', 24)}{' '}
                                                <b>1 / {(1 / calculatorResults.shinyMythicChance || 0).toLocaleString(undefined, { maximumFractionDigits: 1})}</b>
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
                        {
                            resultsTab === 0 ? (
                                <>
                                <Box sx={{display: "flex", justifyContent: "center", flexDirection: 'row', m: 0, p: 0 }}>
                                    <FormControlLabel 
                                        sx={{ m: 0, p: 0 }}
                                        label="Use percent chances" 
                                        control={
                                            <Checkbox 
                                                checked={usePercentResults} 
                                                onChange={(e) => setUsePercentResults(e.target.checked)} 
                                                sx={{ m: 0, p: 0, ml: 0.5, mr: 0.5, fontSize: 10 }} 
                                            />
                                        } 
                                    />    
                                </Box>
                                </>
                            ) : (<></>)
                        }
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
                                  ✨ <span className='shiny'>Shiny</span>
                                </TableCell>
                                <TableCell sx={{ width: 200, fontWeight: "bold" }}>
                                  🔮 <span className='mythic'>Mythic</span>
                                </TableCell>
                                <TableCell sx={{ width: 200, fontWeight: "bold" }}>
                                  💫 <span className='shiny-mythic'>Shiny Mythic</span>
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
                                                        <span className={result.pet.rarity}>{result.pet.name}</span>
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
