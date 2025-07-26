import { useEffect, useMemo, useState } from "react";
import { Box, Avatar, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody, Checkbox, Link, Button, Select, MenuItem, Input, Drawer, Tab, Tabs, LinearProgress } from "@mui/material";
import { PetInstance, PetVariant, CurrencyVariant, petVariants, currencyImages, getPetChance, getPetStat, Egg, PetData, Pet, getPetImage, Rarity, Enchant, PetStat, variantData } from "../util/DataUtil";
import { capitalize, imgIcon, variantStyle } from "../util/StyleUtil";
import { theme } from "..";

const drawerWidth = 420;

const STORAGE_KEY = "teamBuilderState";
type PetKey = `${string}__${PetVariant}`;

interface TeamBuilderState {
  profiles: TeamBuilderProfile[];
  currentProfileIndex: number;
  lastTeamResult: TeamStatResult | undefined;
  lastFocusStat: PetStat;
  lastFocusCurrency: CurrencyVariant;
}

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

// function loadProfiles(): TeamBuilderProfile[] {
//   const stored = localStorage.getItem(STORAGE_KEY);
//   let profiles: TeamBuilderProfile[] = stored ? JSON.parse(stored) : [];

//   // Ensure Default profile exists if no other profiles found
//   if (profiles.length == 0) {
//     profiles.unshift({ name: "Default", pets: {}, teamSize: 11 });
//   }

//   return profiles;
// }

// function saveProfiles(profiles: TeamBuilderProfile[]) {
//     localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
// }

function ensureValidSaveData(data: TeamBuilderState): TeamBuilderState {
  // Ensure profiles are valid, and at least one profile exists
  if (!data.profiles || !Array.isArray(data.profiles) || data.profiles.length === 0) {
    data.profiles = [{ name: "Default", pets: {}, teamSize: 11 }];
  }
  // Ensure each profile has a valid name and pets
  data.profiles = data.profiles.map(profile => {
    if (!profile.name || typeof profile.name !== "string") {
      profile.name = "Default";
    }
    if (!profile.pets || typeof profile.pets !== "object") {
      profile.pets = {};
    }
    if (typeof profile.teamSize !== "number" || profile.teamSize < 1) {
      profile.teamSize = 11;
    }
    return profile;
  });
  // Ensure currentProfileIndex is valid
  if (typeof data.currentProfileIndex !== "number" || data.currentProfileIndex < 0 || data.currentProfileIndex >= data.profiles.length) {
    data.currentProfileIndex = 0;
  }
  // Ensure lastTeamResult is valid
  if (!data.lastTeamResult || typeof data.lastTeamResult !== "object") {
    data.lastTeamResult = {
      total: {
        bubbles: 0,
        currency: 0,
        gems: 0
      },
      detailed: []
    };
  }

  return data;
}

function expandOwnedPets(profile: TeamBuilderProfile, all: PetInstance[]): PetInstance[] {
  const pool: PetInstance[] = [];
  for (const key in profile.pets) {
    const [name, variant] = key.split("__") as [string, PetVariant];
    const match = all.find(p => p.name === name && p.variant === variant);
    if (!match) continue;
    pool.push(match);
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
  const [profile, setProfile] = useState<TeamBuilderProfile | undefined>();
  const [visibleCount, setVisibleCount] = useState(20);
  const [profiles, setProfiles] = useState<TeamBuilderProfile[] | undefined>();
  const [searchQuery, setSearchQuery] = useState("");
  const [tab, setTab] = useState(0); // 0 = Owned Pets, 1 = Add Pets
  const [focusStat, setFocusStat] = useState<PetStat>("bubbles");
  const [focusCurrency, setFocusCurrency] = useState<CurrencyVariant>("coins");
  const [teamResult, setTeamResult] = useState<TeamStatResult | undefined>(undefined);
  const [isCalculating, setIsCalculating] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);

  // On component mount, load State data from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const state: TeamBuilderState = JSON.parse(stored);
      const validState = ensureValidSaveData(state);
      setProfiles(validState.profiles || []);
      const currentProfile = validState.profiles[validState.currentProfileIndex] || validState.profiles[0];
      setProfile(currentProfile);
      setTeamResult(validState.lastTeamResult);
      setFocusStat(validState.lastFocusStat || "bubbles");
      setFocusCurrency(validState.lastFocusCurrency || "coins");
    }
    else {
      // If no saved state, initialize with default profile
      const defaultProfile: TeamBuilderProfile = { name: "Default", pets: {}, teamSize: 11 };
      setProfiles([defaultProfile]);
      setProfile(defaultProfile);
      setTeamResult(undefined);
      setFocusStat("bubbles");
      setFocusCurrency("coins");
    }
  }, []);
  
  // On TeamBuilderState change, save to localStorage
  useEffect(() => {
    if (!profiles || !profile) return;
    const state: TeamBuilderState = {
      profiles: profiles!,
      currentProfileIndex: profiles!.findIndex(p => p.name === profile!.name),
      lastTeamResult: teamResult,
      lastFocusStat: focusStat,
      lastFocusCurrency: focusCurrency
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [profiles, profile, teamResult, focusStat, focusCurrency]);

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

  const filteredPets = useMemo(() => {
    return allPetInstances.filter((pet) =>
      pet.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [allPetInstances, searchQuery]);

  // Owned-pets list that is actually renderable (search + valid rarity) and sorted by bubbles
  const ownedList = useMemo(() => {
    if (!profile) {
      return [] as Array<{
        key: PetKey;
        count: number;
        pet: PetInstance;
        variant: PetVariant;
      }>;
    }

    const q = searchQuery.toLowerCase();
    const out: Array<{ key: PetKey; count: number; pet: PetInstance; variant: PetVariant }> = [];

    for (const [key, count] of Object.entries(profile.pets)) {
      if (count <= 0) continue;
      if (!key.toLowerCase().includes(q)) continue;

      const [petName, variant] = key.split("__") as [string, PetVariant];
      const pet = allPetInstances.find(p => p.name === petName && p.variant === variant);
      if (!pet) continue;

      // Only show Legendary / Secret / Infinity
      if (!["legendary", "secret", "infinity"].includes(pet.rarity)) continue;

      out.push({ key: key as PetKey, count, pet, variant });
    }

    out.sort((a, b) => {
      if (a.pet.bubbles !== b.pet.bubbles) return b.pet.bubbles - a.pet.bubbles;
      // Optional tie-breakers to keep ordering stable:
      if (a.pet.currency !== b.pet.currency) return b.pet.currency - a.pet.currency;
      if (a.pet.gems !== b.pet.gems) return b.pet.gems - a.pet.gems;
      if (a.pet.name !== b.pet.name) return a.pet.name.localeCompare(b.pet.name);
      return a.variant.localeCompare(b.variant);
    });

    return out;
  }, [profile?.pets, allPetInstances, searchQuery]);

  const calculateTeam = async () => {
    if (!profile) {
      return;
    }
    setIsCalculating(true);
    setProgress(0);
  
    await new Promise((r) => setTimeout(r, 10)); // Let UI render
  
    const focus = focusStat;
    const currency = focusCurrency;
    const teamSize = profile.teamSize;
    let totalDetermPets = 0;
    let totalNonDetermPets = 0;

    // Step 1: Score each unique pet in the profile based on focus stat and enchants, then sort by score.
    const batchSize = 50;
    let i = 0;
    const pool = expandOwnedPets(profile, allPetInstances);
    const scoredPets: EnchantedPetWithScore[] = await Promise.all(pool.map(async (pet) => {
      i++;
      if (i % batchSize === 0) {
        setProgress(Math.min(100, Math.floor((i / pool.length) * 100)));
        // await animation frame
        await new Promise((r) => requestAnimationFrame(r));
      }
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
        totalNonDetermPets += 1;
      }
      if (enchants.includes("determination")) {
        bubblesMultiplier += 0.5 * teamSize;
        currencyMultiplier += 0.5 * teamSize;
        gemsMultiplier += 0.5 * teamSize;
        totalDetermPets += 1;
      }

      const bubbles = Math.floor(pet.bubbles * bubblesMultiplier);
      const currencyStat = Math.floor(pet.currency * currencyMultiplier);
      const currencyVal = focusStat === 'currency' ? (pet.currencyVariant === currency ? currencyStat : 0) : currencyStat;
      const gems = Math.floor(pet.gems * gemsMultiplier);

      const score = focus === "bubbles" ? bubbles : focus === "gems" ? gems : currencyVal;

      return { pet, enchants, score };
    })) as EnchantedPetWithScore[];

    scoredPets.sort((a, b) => b.score - a.score);

    // Expand owned pets to include owned count. Once we have teamSize pets with and without Determination, we can stop.
    const expandedPets: EnchantedPet[] = [];
    let determCount = 0;
    let nonDetermCount = 0;
    for (const scored of scoredPets) {
      const count = profile.pets[`${scored.pet.name}__${scored.pet.variant}` as PetKey] || 0;
      if (count > 0) {
        for (i = 0; i < count; i++) {
          expandedPets.push({
            pet: scored.pet,
            enchants: scored.enchants
          });
        }
        if (scored.enchants.includes("determination")) {
          determCount += count;
        } else {
          nonDetermCount += count;
        }
      }
      // Check if we have enough pets to do our calculations
      if ((determCount >= teamSize || determCount >= totalDetermPets) 
        && (nonDetermCount >= teamSize || nonDetermCount >= totalNonDetermPets)
        && (expandedPets.length >= teamSize)) {
        break;
      }
    }

    // Step 2: Pick the top teamSize pets with Determination, and the top teamSize pets without it.
    const topDeterm = expandedPets.filter(p => p.enchants.includes("determination")).slice(0, teamSize);
    const topNonDeterm = expandedPets.filter(p => !p.enchants.includes("determination")).slice(0, teamSize);

    // Step 3: Calculate the best team by mixing Determination and non-Determination pets (0 to teamSize Determination pets).
    let selectedTeam: TeamStatResult | null = null;
    let bestScore = 0;
    for (let d = 0; d <= teamSize; d++) {
      const determSlice = topDeterm.slice(0, d);
      const nonDetermSlice = topNonDeterm.slice(0, teamSize - d);
      const currentTeam = [...determSlice, ...nonDetermSlice];
      const result = calculateTeamStats(currentTeam, currency);
      const score = focus === "bubbles" ? result.total.bubbles : focus === "gems" ? result.total.gems : result.total.currency;

      if (score > bestScore) {
        bestScore = score;
        selectedTeam = result;
      }
    }

    // Step 4: Calculate final team stats
    if (selectedTeam) {
      setTeamResult(selectedTeam);
    }
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

  if (!profile || !profiles) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="h6">Loading...</Typography>
      </Box>
    )
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
                      //saveProfiles(newProfiles);
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
                          //saveProfiles(updated);
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
                          //saveProfiles(newProfiles);
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
                      //saveProfiles(updated);
                    }}
                  >
                    Rename
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => {
                      if (!window.confirm("Import owned pets from Pet Index? This will ensure that each pet from Pet Index is owned at least once.")) return;

                      try {
                        const saved = localStorage.getItem("petTrackerState");
                        if (!saved) {
                          alert("No saved data found from Pet Index.");
                          return;
                        }
                    
                        const indexOwned = JSON.parse(saved) as Record<string, boolean>;
                    
                        let newPets: Record<PetKey, number> = { ...profile.pets };
                        for (const key in indexOwned) {
                          if (indexOwned[key]) {
                            newPets[key as PetKey] = Math.max(newPets[key as PetKey] || 0, 1);
                          }
                        }

                        //newPets = sortProfilePets(newPets);
                    
                        const updatedProfile = { ...profile, pets: newPets };
                        const updatedProfiles = profiles.map((p) =>
                          p.name === profile.name ? updatedProfile : p
                        );
                    
                        setProfile(updatedProfile);
                        setProfiles(updatedProfiles);
                        //saveProfiles(updatedProfiles);
                    
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
                  <Tab label="Edit Pets" />
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
                        const total = ownedList.length; // use the renderable list length
                        if (
                          target.scrollTop + target.clientHeight >= target.scrollHeight - 100 &&
                          visibleCount < total
                        ) {
                          setVisibleCount((v) => Math.min(v + 20, total));
                        }
                      }}
                    >
                      {ownedList
                        .slice(0, visibleCount)
                        .map(({ key, count, pet, variant }) => {
                          const updateCount = (value: number) => {
                            const newPets = { ...profile.pets, [key]: Math.max(0, value) };
                            const updatedProfile = { ...profile, pets: newPets };
                            const updatedProfiles = profiles.map((p) =>
                              p.name === profile.name ? updatedProfile : p
                            );
                            setProfile(updatedProfile);
                            setProfiles(updatedProfiles);
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
                                value={count === 0 ? "" : count}
                                onChange={(e) => {
                                  const raw = e.target.value.trim();
                                  if (!/^\d*$/.test(raw)) return; // digits only
                                  const newValue = raw === "" ? 0 : parseInt(raw, 10);
                                  updateCount(newValue);
                                }}
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
                            //saveProfiles(updatedProfiles);
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
                                {
                                  const newValue = parseInt(e.target.value || "0");
                                  if (isNaN(newValue) || newValue < 0) {
                                      return;
                                  }
                                  updateCount(newValue);
                                }
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
                        <MenuItem value="bubbles">
                          {imgIcon("https://static.wikia.nocookie.net/bgs-infinity/images/0/0c/Bubbles.png", 25)}{' '}
                          Bubbles
                        </MenuItem>
                        <MenuItem value="currency">
                          {imgIcon(currencyImages[focusStat === 'currency' ? focusCurrency : 'coins'], 25)}{' '}
                          Currency
                        </MenuItem>
                        <MenuItem value="gems">
                          {imgIcon("https://static.wikia.nocookie.net/bgs-infinity/images/d/d5/Gems.png", 25)}{' '}
                          Gems
                        </MenuItem>
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
                          <MenuItem value="coins">{imgIcon(currencyImages['coins'])}{' '}Coins</MenuItem>
                          <MenuItem value="tickets">{imgIcon(currencyImages['tickets'])}{' '}Tickets</MenuItem>
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
                          //saveProfiles(updatedProfiles);
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
            <Box display='flex' flexDirection='row' alignItems='center' justifyContent='space-between' mb={2}>
              <Typography sx={{flexShrink: 99}} variant="h6" gutterBottom>Team Result</Typography>
              <Paper elevation={2} sx={{ml: 2, mr: 'auto', display:'flex', flexDirection:'row', alignItems:'center', gap:1, flexGrow: 0, padding: 1 }}>
                <span style={{paddingRight: 10, fontSize: '0.9em'}}>
                  {imgIcon("https://static.wikia.nocookie.net/bgs-infinity/images/0/0c/Bubbles.png", 25)}{' +'}
                  {teamResult?.total.bubbles.toLocaleString()}
                </span>
                <span style={{paddingRight: 10, fontSize: '0.9em'}}>
                  {imgIcon(currencyImages[focusStat === 'currency' ? focusCurrency : 'coins'], 25)}{' x'}
                  {teamResult?.total.currency.toLocaleString()}
                </span>
                <span style={{paddingRight: 10, fontSize: '0.9em'}}>
                  {imgIcon("https://static.wikia.nocookie.net/bgs-infinity/images/d/d5/Gems.png", 25)}{' x'}
                  {teamResult?.total.gems.toLocaleString()}
                </span>
              </Paper>
            </Box>
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
                        {imgIcon("https://static.wikia.nocookie.net/bgs-infinity/images/0/0c/Bubbles.png")}{' +'}
                        {result.bubbles.toLocaleString()}
                    </Typography>
                    <Typography variant="body2">
                        {imgIcon(currencyImages[focusStat === 'currency' ? focusCurrency : result.pet.currencyVariant])}{' x'}
                        {result.currency.toLocaleString()}
                    </Typography>
                    <Typography variant="body2">
                        {imgIcon("https://static.wikia.nocookie.net/bgs-infinity/images/d/d5/Gems.png")}{' x'}
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