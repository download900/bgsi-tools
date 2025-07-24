import { useEffect, useMemo, useState } from "react";
import { Box, Avatar, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody, Checkbox, Link, Button, Select, MenuItem, Input, Drawer, Tab, Tabs, LinearProgress } from "@mui/material";
import { PetInstance, PetVariant, CurrencyVariant, petVariants, currencyImages, getPetChance, getPetStat, Egg, PetData, Pet, getPetImage, Rarity, Enchant, PetStat, variantData } from "../util/DataUtil";
import { capitalize, imgIcon, variantStyle } from "../util/StyleUtil";
import { theme } from "..";

const drawerWidth = 420;

const STORAGE_KEY = "teamBuilderState";
type PetKey = `${string}__${PetVariant}`;

interface TeamBuilderProfile {
  name: string;
  pets: Record<PetKey, number>; // key = name + variant
  teamSize: number;
}

type EnchantedPet = { pet: PetInstance; enchants: Enchant[] };
interface EnchantedPetWithScore extends EnchantedPet {
  score: number;
}

interface TeamStatResult {
  total: {
    bubbles: number;
    currency: number;
    gems: number;
  };
  detailed: {
    pet: PetInstance;
    enchants: Enchant[];
    bubbles: number;
    currency: number;
    gems: number;
  }[];
}

function loadProfiles(): TeamBuilderProfile[] {
  const stored = localStorage.getItem(STORAGE_KEY);
  let profiles: TeamBuilderProfile[] = stored ? JSON.parse(stored) : [];

  // Ensure Default profile exists
  if (!profiles.some((p) => p.name === "Default")) {
    profiles.unshift({ name: "Default", pets: {}, teamSize: 11 });
  }

  return profiles;
}

function saveProfiles(profiles: TeamBuilderProfile[]) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
}

function expandOwnedPets(profile: TeamBuilderProfile, all: PetInstance[]): PetInstance[] {
  const pool: PetInstance[] = [];
  for (const key in profile.pets) {
    const count = profile.pets[key as PetKey];
    const [name, variant] = key.split("__") as [string, PetVariant];
    const match = all.find(p => p.name === name && p.variant === variant);
    if (!match) continue;
    for (let i = 0; i < count; i++) {
      pool.push(match);
    }
  }
  return pool;
}

function assignEnchants(pet: PetInstance, focus: PetStat): Enchant[] {
  const enchants: Enchant[] = [];
  const canHaveDetermination = ["secret", "infinity"].includes(pet.rarity);
  const isShiny = pet.variant.includes("Shiny");
  if (canHaveDetermination) {
    enchants.push("determination");
  } else {
    enchants.push("teamUpV");
  }
  if (isShiny) {
      enchants.push(focus === "currency" ? "looter" : "bubbler");
  }
  return enchants;
}

function calculateTeamStats(team: EnchantedPet[], currencyType?: CurrencyVariant): TeamStatResult {
  const teamUpCount = team.filter(p => p.enchants.includes("teamUpV")).length;
  const determCount = team.filter(p => p.enchants.includes("determination")).length;

  const detailed = team.map(({ pet, enchants }) => {
    let currencyMultiplier = 1;
    let bubblesMultiplier = 1;
    let gemsMultiplier = 1;

    if (enchants.includes("bubbler")) bubblesMultiplier += 0.5;
    if (enchants.includes("looter")) currencyMultiplier += 0.5;

    if (enchants.includes("teamUpV") || enchants.includes("determination")) {
      const synergy = (0.25 * teamUpCount) + (0.5 * determCount);
      bubblesMultiplier += synergy;
      currencyMultiplier += synergy;
      gemsMultiplier += synergy;
    }

    const bubbles = pet.bubbles * bubblesMultiplier;
    const currency = pet.currencyVariant === currencyType ? pet.currency* currencyMultiplier : 0;
    const gems = pet.gems * gemsMultiplier;

    return {
      pet,
      enchants,
      bubbles: Math.floor(bubbles + 0.5),
      currency: Math.floor(currency + 0.5),
      gems: Math.floor(gems + 0.5)
    };
  });

  const total = {
    bubbles: detailed.reduce((sum, p) => sum + p.bubbles, 0),
    currency: detailed.reduce((sum, p) => sum + p.currency, 0),
    gems: detailed.reduce((sum, p) => sum + p.gems, 0)
  };

  return { total, detailed };
}


interface TeamBuilderProps {
    data: PetData | undefined;
}

export function TeamBuilder(props: TeamBuilderProps) {
  const [profile, setProfile] = useState<TeamBuilderProfile>(
    () => loadProfiles().find((p) => p.name === "Default")!
  );
  const [visibleCount, setVisibleCount] = useState(20);
  const [profiles, setProfiles] = useState<TeamBuilderProfile[]>(loadProfiles());
  const [searchQuery, setSearchQuery] = useState("");
  const [tab, setTab] = useState(0); // 0 = Owned Pets, 1 = Add Pets
  const [focusStat, setFocusStat] = useState<PetStat>("bubbles");
  const [focusCurrency, setFocusCurrency] = useState<CurrencyVariant>("coins");
  const [teamResult, setTeamResult] = useState<TeamStatResult | undefined>(undefined);
  const [isCalculating, setIsCalculating] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);

  const allPetInstances = useMemo(() => {
    if (!props.data || props.data.eggs.length < 1) return [];
    const all: PetInstance[] = [];
    for (const pet of props.data.pets) {
      if (!["legendary", "secret", "infinity"].includes(pet.rarity)) continue;
      for (const variant of petVariants) {
        if (variant.includes("Mythic") && !pet.hasMythic) continue;
        all.push({
          name: pet.name,
          chance: getPetChance(pet, variant),
          hatchable: pet.hatchable,
          rarity: pet.rarity,
          bubbles: getPetStat(pet, variant, "bubbles", true),
          currencyVariant: pet.currencyVariant,
          currency: getPetStat(pet, variant, "currency", true),
          gems: getPetStat(pet, variant, "gems", true),
          variant,
          image: pet.image[petVariants.indexOf(variant)],
          obtainedFrom: pet.obtainedFrom,
          obtainedFromImage: pet.obtainedFromImage
        });
      }
    }
    // sort by bubbles, then currency, then gems, then name
    all.sort((a, b) => {
      if (a.bubbles !== b.bubbles) return b.bubbles - a.bubbles;
      if (a.currency !== b.currency) return b.currency - a.currency;
      if (a.gems !== b.gems) return b.gems - a.gems;
      return a.name.localeCompare(b.name);
    });
    return all;
  }, [props.data]);

  function sortProfilePets(pets: Record<PetKey, number>): Record<PetKey, number> {
    return Object.fromEntries(
      Object.entries(pets)
        .filter(([_, count]) => count > 0)
        .sort(([keyA], [keyB]) => {
          const [nameA, variantA] = keyA.split("__") as [string, PetVariant];
          const [nameB, variantB] = keyB.split("__") as [string, PetVariant];
          const petA = allPetInstances.find(p => p.name === nameA && p.variant === variantA);
          const petB = allPetInstances.find(p => p.name === nameB && p.variant === variantB);
          if (!petA || !petB) return 0; // should not happen
          return petA.bubbles !== petB.bubbles ? petB.bubbles - petA.bubbles : petA.name.localeCompare(petB.name);
        })
    );
  }

  // on profile change, or owned pets change, sort pets
  useEffect(() => {
      const sortedPets = sortProfilePets(profile.pets);
      setProfile((prev) => ({ ...prev, pets: sortedPets }));
      setVisibleCount(20); // reset scroll
  }, [profile.name, profile.pets]);

  const filteredPets = useMemo(() => {
    return allPetInstances.filter((pet) =>
      pet.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [allPetInstances, searchQuery]);

  const calculateTeam = async () => {
    setIsCalculating(true);
    setProgress(0);
  
    await new Promise((r) => setTimeout(r, 10)); // Let UI render
  
    const pool = expandOwnedPets(profile, allPetInstances);
    const focus = focusStat;
    const currency = focusCurrency;
    const teamSize = profile.teamSize;
  
    // Step 1: Score pets with assumed max synergy values (naive, greedy approach, but should still produce the best results)
    const scoredPets: EnchantedPetWithScore[] = pool.map((pet) => {
      const enchants = assignEnchants(pet, focus);
      let bubblesMultiplier = 1;
      let currencyMultiplier = 1;
      let gemsMultiplier = 1;
      
      if (enchants.includes("bubbler")) bubblesMultiplier += 0.5;
      if (enchants.includes("looter")) currencyMultiplier += 0.5;
  
      if (enchants.includes("teamUpV")) {
        bubblesMultiplier += 0.25 * teamSize;
        currencyMultiplier += 0.25 * teamSize;
        gemsMultiplier += 0.25 * teamSize;
      }
      if (enchants.includes("determination")) {
        bubblesMultiplier += 0.5 * teamSize;
        currencyMultiplier += 0.5 * teamSize;
        gemsMultiplier += 0.5 * teamSize;
      }

      const bubbles = Math.floor(pet.bubbles * bubblesMultiplier);
      const currencyVal = pet.currencyVariant === currency ? Math.floor(pet.currency * currencyMultiplier) : 0;
      const gems = Math.floor(pet.gems * gemsMultiplier);

      const score =
        focus === "bubbles"
          ? bubbles
          : focus === "gems"
          ? gems
          : currencyVal;
  
      return { pet, enchants, score };
    });
  
    // Step 2: Sort by estimated stat value
    const top = scoredPets
      .sort((a, b) => b.score - a.score)
      .slice(0, teamSize)
      .map(({ pet, enchants }) => ({ pet, enchants }));
  
    // Step 3: Compute true team stats using synergy rules
    const result = calculateTeamStats(top, currency);
  
    setTeamResult(result);
    setIsCalculating(false);
    setProgress(null);
  };

  function renderEnchant(enchant: Enchant) {
    switch (enchant) {
        case "bubbler":
            return "🫧 Bubbler";
        case "looter":
            return "💰 Looter";
        case "teamUpV":
            return "⚡ Team Up V";
        case "determination":
            return "💖 Determination";
        default:
            return null;
    }
  }

  return (
    <Box sx={{ display: "flex", flexGrow: 1 }}>
      <Box sx={{ display: "flex", flexGrow: 1 }}>
            {/* LEFT DRAWER */}
            <Drawer
              variant="permanent"
              anchor="left"
              sx={{
                width: drawerWidth,
                flexShrink: 0,
                "& .MuiDrawer-paper": {
                  width: drawerWidth,
                  boxSizing: "border-box",
                  mt: 8,
                  height: `calc(100% - ${theme.mixins.toolbar.minHeight}px)`,
                  overflowY: "auto",
                },
              }}
            >
              <Box sx={{ p: 2 }}>
                {/* Profile Selector */}
                <Typography variant="h6" gutterBottom>Profiles</Typography>
                <Select
                  fullWidth
                  size="small"
                  value={profile.name}
                  onChange={(e) => {
                    const selected = profiles.find(p => p.name === e.target.value);
                    if (selected) setProfile(selected);
                  }}
                  sx={{ mb: 1 }}
                >
                  {profiles.map((p) => (
                    <MenuItem key={p.name} value={p.name}>{p.name}</MenuItem>
                  ))}
                </Select>
              
                <Box sx={{ display: "flex", gap: 1, mb: 2 }}>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => {
                      const name = prompt("Enter profile name:");
                      if (!name) return;
                      if (profiles.some(p => p.name === name)) {
                        alert("Profile name already exists.");
                        return;
                      }
                      const newProfile = { name, pets: {}, teamSize: 11 };
                      const newProfiles = [...profiles, newProfile];
                      setProfiles(newProfiles);
                      setProfile(newProfile);
                      saveProfiles(newProfiles);
                    }}
                  >
                    Add
                  </Button>
                  {profile.name === "Default" ? (
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => {
                          if (!window.confirm("Clear all pets from Default profile?")) return;
                          const cleared = { ...profile, pets: {} };
                          const updated = profiles.map((p) =>
                            p.name === "Default" ? cleared : p
                          );
                          setProfile(cleared);
                          setProfiles(updated);
                          saveProfiles(updated);
                        }}
                      >
                        Clear
                      </Button>
                    ) : (
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => {
                          if (!window.confirm(`Delete profile "${profile.name}"?`)) return;
                          const newProfiles = profiles.filter(p => p.name !== profile.name);
                          const fallback = newProfiles[0];
                          setProfiles(newProfiles);
                          setProfile(fallback);
                          saveProfiles(newProfiles);
                        }}
                      >
                        Delete
                      </Button>
                    )}
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => {
                      const newName = prompt("Rename profile:", profile.name);
                      if (!newName || newName === profile.name) return;
                      if (profiles.some(p => p.name === newName)) {
                        alert("Name already in use.");
                        return;
                      }
                      const updated = profiles.map((p) =>
                        p.name === profile.name ? { ...p, name: newName } : p
                      );
                      const newCurrent = { ...profile, name: newName };
                      setProfiles(updated);
                      setProfile(newCurrent);
                      saveProfiles(updated);
                    }}
                  >
                    Rename
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => {
                      if (!window.confirm("Import owned pets from Pet Index? This will replace your current team.")) return;

                      try {
                        const saved = localStorage.getItem("petTrackerState");
                        if (!saved) {
                          alert("No saved data found from Pet Index.");
                          return;
                        }
                    
                        const indexOwned = JSON.parse(saved) as Record<string, boolean>;
                    
                        let newPets: Record<PetKey, number> = {};
                        for (const key in indexOwned) {
                          if (indexOwned[key]) {
                            newPets[key as PetKey] = 1; // Add each owned pet once
                          }
                        }

                        newPets = sortProfilePets(newPets);
                    
                        const updatedProfile = { ...profile, pets: newPets };
                        const updatedProfiles = profiles.map((p) =>
                          p.name === profile.name ? updatedProfile : p
                        );
                    
                        setProfile(updatedProfile);
                        setProfiles(updatedProfiles);
                        saveProfiles(updatedProfiles);
                    
                        alert("Import successful.");
                      } catch (err) {
                        console.error("Failed to import pets:", err);
                        alert("Error importing data. Please check your Pet Index save.");
                      }
                    }}

                  >
                    Import
                  </Button>
                </Box>
                
                {/* Tabs for Owned / Add */}
                <Tabs
                  value={tab}
                  onChange={(_, v) => {
                    setTab(v);
                    setSearchQuery("");
                    setVisibleCount(20);
                  }}
                  sx={{ mb: 1 }}
                >
                  <Tab label="Owned Pets" />
                  <Tab label="Add Pets" />
                </Tabs>
                
                {/* --- TAB: OWNED PETS --- */}
                {tab === 0 && (
                  <>
                  <Input
                    placeholder="Search pets..."
                    fullWidth
                    size="small"
                    sx={{ mb: 1 }}
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setVisibleCount(20);
                    }}
                  />
                  <Box
                    sx={{ maxHeight: "60vh", overflowY: "auto", pr: 1 }}
                    onScroll={(e) => {
                      const target = e.currentTarget;
                      const matching = Object.entries(profile.pets).filter(
                        ([key, count]) =>
                          count > 0 &&
                          key.toLowerCase().includes(searchQuery.toLowerCase())
                      );
                      if (
                        target.scrollTop + target.clientHeight >= target.scrollHeight - 100 &&
                        visibleCount < matching.length
                      ) {
                        setVisibleCount((v) => Math.min(v + 20, matching.length));
                      }
                    }}
                  >
                    {Object.entries(profile.pets)
                      .filter(
                        ([key, count]) =>
                          count > 0 &&
                          key.toLowerCase().includes(searchQuery.toLowerCase())
                      )
                      //.slice(0, visibleCount)
                      .map(([key, count]) => {
                        const [petName, variant] = key.split("__") as [string, PetVariant];
                        const pet = allPetInstances.find(
                          (p) => p.name === petName && p.variant === variant
                        );
                        if (!pet || !["legendary", "secret", "infinity"].includes(pet.rarity))
                          return null;
                    
                        const updateCount = (value: number) => {
                          const newPets = { ...profile.pets, [key]: Math.max(0, value) };
                          const updatedProfile = { ...profile, pets: newPets };
                          const updatedProfiles = profiles.map((p) =>
                            p.name === profile.name ? updatedProfile : p
                          );
                          setProfile(updatedProfile);
                          setProfiles(updatedProfiles);
                          saveProfiles(updatedProfiles);
                        };
                    
                        return (
                          <Box
                            key={key}
                            sx={{ display: "flex", alignItems: "center", mb: 0.5 }}
                          >
                            <Avatar
                              src={pet.image}
                              variant="square"
                              sx={{ width: 24, height: 24, mr: 1 }}
                            />
                            <Typography variant="body2" sx={{ flex: 1 }}>
                              <span className={pet.rarity}>{pet.name}</span>
                              <span
                                style={{ marginLeft: 4, fontWeight: 500 }}
                                className={variantStyle(variant)}
                              >
                                ({variant})
                              </span>
                            </Typography>
                            <Input
                              type="text"
                              size="small"
                              value={count}
                              onChange={(e) =>
                                updateCount(parseInt(e.target.value || "0"))
                              }
                              inputProps={{
                                style: { width: 50, textAlign: "center" },
                              }}
                            />
                            <Button
                              size="small"
                              onClick={() => {
                                const newPets = { ...profile.pets };
                                delete newPets[key as PetKey];
                                const updatedProfile = { ...profile, pets: newPets };
                                const updatedProfiles = profiles.map((p) =>
                                  p.name === profile.name ? updatedProfile : p
                                );
                                setProfile(updatedProfile);
                                setProfiles(updatedProfiles);
                                saveProfiles(updatedProfiles);
                              }}
                            >
                              ❌
                            </Button>
                          </Box>
                        );
                      })}
                  </Box>

                  </>
                )}
            
                {/* --- TAB: ADD PETS --- */}
                {tab === 1 && (
                  <>
                    <Input
                      placeholder="Search pets..."
                      fullWidth
                      size="small"
                      sx={{ mb: 1 }}
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setVisibleCount(20); // reset scroll
                      }}
                    />
                    <Box sx={{ maxHeight: "60vh", overflowY: "auto", pr: 1 }} onScroll={(e) => {
                      const target = e.currentTarget;
                      if (
                        target.scrollTop + target.clientHeight >= target.scrollHeight - 100 &&
                        visibleCount < filteredPets.length
                      ) {
                        setVisibleCount((v) =>
                          Math.min(v + 20, filteredPets.length)
                        );
                      }
                    }}>
                        {filteredPets.slice(0, visibleCount).map((pet) => {
                            const key = `${pet.name}__${pet.variant}` as const;
                            const count = profile.pets[key] || 0;

                            const updateCount = (value: number) => {
                            const newPets = { ...profile.pets, [key]: Math.max(0, value) };
                            const updatedProfile = { ...profile, pets: newPets };
                            const updatedProfiles = profiles.map((p) =>
                                p.name === profile.name ? updatedProfile : p
                            );
                            setProfile(updatedProfile);
                            setProfiles(updatedProfiles);
                            saveProfiles(updatedProfiles);
                            };
                        
                            return (
                            <Box key={key} sx={{ display: "flex", alignItems: "center", mb: 0.5 }}>
                              <Avatar
                                src={pet.image}
                                variant="square"
                                sx={{ width: 24, height: 24, mr: 1 }}
                              />
                              <Typography variant="body2" sx={{ flex: 1 }}>
                                <span className={pet.rarity}>{pet.name}</span>
                                <span
                                  style={{ marginLeft: 4, fontWeight: 500 }}
                                  className={variantStyle(pet.variant)}
                                >
                                  ({pet.variant})
                                </span>
                              </Typography>
                              <Input
                                type="text"
                                size="small"
                                value={count}
                                onChange={(e) =>
                                  updateCount(parseInt(e.target.value || "0"))
                                }
                                inputProps={{
                                  style: { width: 50, textAlign: "center" },
                                }}
                              />
                              <Button
                                size="small"
                                onClick={() => updateCount(Math.max(0, count - 1))}
                                sx={{ minWidth: 24, px: 0.5, ml: 1, backgroundColor: "#2c2c2c" }}
                              >
                                -
                              </Button>
                              <Button
                                size="small"
                                onClick={() => updateCount(count + 1)}
                                sx={{ minWidth: 24, px: 0.5, ml: 1, mr: 1, backgroundColor: "#2c2c2c" }}
                              >
                                +
                              </Button>
                            </Box>

                            );
                        })}
                    </Box>
                </>)}
              </Box>
            </Drawer>

            {/* MAIN CONTENT */}
            <Box
                component="main"
                sx={{
                    flexGrow: 1,
                    p: 3,
                    mt: -5,
                    mx: "auto",
                    maxWidth: "1200px",
                }}
            >
                <Typography variant="h4" gutterBottom>Team Builder</Typography>
                <Paper sx={{ p: 2, mb: 4, width: 950 }}>
                  <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
                    {/* Stat Selector */}
                    <Box display="flex" flexDirection="row" alignItems="center" gap={1}>
                      <Typography variant="subtitle1" gutterBottom>
                        Focus Stat
                      </Typography>
                      <Select
                        size="small"
                        value={focusStat}
                        onChange={(e) => {
                          setFocusStat(e.target.value as PetStat);
                        }}
                      >
                        <MenuItem value="bubbles">Bubbles</MenuItem>
                        <MenuItem value="currency">Currency</MenuItem>
                        <MenuItem value="gems">Gems</MenuItem>
                      </Select>
                    </Box>
                    
                    {/* Currency Selector (only if currency selected) */}
                    {focusStat === "currency" && (
                      <Box display="flex" flexDirection="row" alignItems="center" gap={1}>
                        <Typography variant="subtitle1" gutterBottom>
                          Currency Type
                        </Typography>
                        <Select
                          size="small"
                          value={focusCurrency}
                          onChange={(e) =>
                            setFocusCurrency(e.target.value as CurrencyVariant)
                          }
                        >
                          <MenuItem value="coins">Coins</MenuItem>
                          <MenuItem value="tickets">Tickets</MenuItem>
                        </Select>
                      </Box>
                    )}
                
                    {/* Team Size */}
                    <Box display="flex" flexDirection="row" alignItems="center" gap={1}>
                      <Typography variant="subtitle1" gutterBottom>
                        Team Size
                      </Typography>
                      <Input
                        size="small"
                        value={profile.teamSize ?? 8}
                        onChange={(e) => {
                          const teamSize = Math.max(1, parseInt(e.target.value || "1"));
                          const updatedProfile = { ...profile, teamSize };
                          const updatedProfiles = profiles.map((p) =>
                            p.name === profile.name ? updatedProfile : p
                          );
                          setProfile(updatedProfile);
                          setProfiles(updatedProfiles);
                          saveProfiles(updatedProfiles);
                        }}
                        inputProps={{
                          min: 1,
                          max: 12,
                          style: { width: 60, textAlign: "center" },
                        }}
                      />
                    </Box>
                    
            <Button variant="contained" onClick={calculateTeam} disabled={isCalculating}>
              {isCalculating ? "Calculating..." : "Calculate"}
            </Button>
          </Box>
          {isCalculating && (
            <Box sx={{ mt: 2 }}>
              <LinearProgress variant={progress !== null ? "determinate" : "indeterminate"} value={progress || 0} />
              <Typography variant="caption" display="block" align="center">
                {progress !== null ? `${Math.round(progress)}% complete` : "Calculating combinations..."}
              </Typography>
            </Box>
          )}
        </Paper>

        <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>Result</Typography>
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
                  {teamResult?.detailed.map((result, idx) => (
                    <Paper
                      key={`${result.pet.name}__${result.pet.variant}__${idx}`}
                      sx={{
                        width: 145,
                        p: 1,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        backgroundColor: "#111",
                        border: "1px solid #444",
                        borderRadius: 2,
                      }}
                    >
                      <Avatar
                        src={result.pet.image}
                        variant="square"
                        sx={{ width: 100, height: 100, mb: 1 }}
                      />
                      <Typography
                        variant="subtitle1"
                        sx={{ fontWeight: "bold", textAlign: "center" }}
                        className={result.pet.rarity}
                      >
                        {result.pet.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary"
                        className={variantStyle(result.pet.variant)}
                      >
                        ({result.pet.variant})
                      </Typography>
                      <Box sx={{ mt: 1, textAlign: "center" }}>
                        <Typography variant="body2">
                            {imgIcon("https://static.wikia.nocookie.net/bgs-infinity/images/0/0c/Bubbles.png")}{' '}
                            {result.bubbles.toLocaleString()}
                        </Typography>
                        <Typography variant="body2">
                            {imgIcon( currencyImages[focusStat === 'currency' ? focusCurrency : result.pet.currencyVariant])}{' '}
                            {result.currency.toLocaleString()}
                        </Typography>
                        <Typography variant="body2">
                            {imgIcon("https://static.wikia.nocookie.net/bgs-infinity/images/d/d5/Gems.png")}{' '}
                            {result.gems.toLocaleString()}
                        </Typography>
                        {result.enchants.length > 0 && (
                          <>{result.enchants.map((enchant) => (
                            <Typography variant="body2" key={enchant}>
                              {renderEnchant(enchant)}
                            </Typography>
                          ))}</>
                        )}
                      </Box>
                    </Paper>
                ))}
            </Box>
          </Paper>
        </Box>
      </Box>
    </Box>
  );
}

export default TeamBuilder;