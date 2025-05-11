// src/pages/CompletionTracker.tsx
import React, { use, useEffect, useState } from "react";
import {
  Box,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Avatar,
  Typography,
  Paper,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Checkbox,
  Link,
  Button,
  Select,
  MenuItem,
  Input
} from "@mui/material";

import {
  CategoryData,
  SubCategoryData,
  Egg,
  Pet,
  PetVariant,
  variantScales,
  CurrencyVariant,
  Rarity,
  variantChanceMultipliers,
  currencyImages,
  variantLevelScales
} from "../App";
import {
  getNameAndChanceStyle,
  getPercentStyle,
  variants
} from "../util/StyleUtil";
import { get } from "http";

const STORAGE_KEY = "petTrackerState";
type PetKey = `${string}__${PetVariant}`;
type OwnedPets = Record<PetKey, boolean>;

const SETTINGS_KEY = "petTrackerSettings";

interface PetListProps {
  data: CategoryData[];
}

interface PetInstance { name: string; chance: number; rarity: Rarity; bubbles: number; currencyVariant: CurrencyVariant; currency: number; gems: number; variantIndex: number; variant: PetVariant; image: string[]; egg: Egg; }

const variantStyles: { [key in PetVariant]: React.CSSProperties } = {
  Normal: { color: "#ffffff" },
  Shiny: { color: "#feffd4" },
  Mythic: { color: "#d674b7" },
  "Shiny Mythic": { color: "#9b74d6" },
};

export function PetList(props: PetListProps) {
  const [ownedPets, setOwnedPets] = useState<OwnedPets>({});
  const [allPets, setAllPets] = useState<PetInstance[]>([]);
  const [sortedPets, setSortedPets] = useState<PetInstance[]>([]);
  const [sortColumn, setSortColumn] = useState<"name" | "chance" | "bubbles" | "coins" | "gems">("bubbles");
  const [nameFilter, setNameFilter] = useState<string>("");
  const [currencyFilter, setCurrencyFilter] = useState<CurrencyVariant | null>(null);
  const [hideUnobtainedSecret, setObtainedFilter] = useState<boolean>(true);
  const [previewMaxLevel, setPreviewMaxLevel] = useState<boolean>(true);
  const [previewEnchant, setPreviewEnchant] = useState<boolean>(true);
  const [enchantPetMultiplier, setEnchantPetMultiplier] = useState<number>(11);
  const [secondEnchant, setSecondEnchant] = useState<"looter" | "bubbler">("bubbler");

  // useEffect(() => {
  //   try {
  //     const saved = localStorage.getItem(SETTINGS_KEY);
  //     if (saved) {
  //       const settings = JSON.parse(saved);
  //       setObtainedFilter(settings.hideUnobtained);
  //       setCurrencyFilter(settings.currency);
  //       setPreviewMaxLevel(settings.previewMaxLevel);
  //       setPreviewEnchant(settings.previewEnchant);
  //       setEnchantPetMultiplier(settings.enchantPetMultiplier);
  //       setSecondEnchant(settings.secondEnchant);
  //     }
  //   } catch {}
  // }, []);

  // useEffect(() => {
  //   if (!props.data) return;
  //   try {
  //     const settings = {
  //       hideUnobtained: obtainedFilter,
  //       currency: currencyFilter,
  //       previewMaxLevel,
  //       previewEnchant,
  //       enchantPetMultiplier,
  //       secondEnchant
  //     };
  //     localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  //   } catch {}
  // }, [obtainedFilter, currencyFilter, previewMaxLevel, previewEnchant, enchantPetMultiplier, secondEnchant]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setOwnedPets(JSON.parse(saved));
    } catch {}

    const allPets = buildPetList();
    setAllPets(allPets);
    sortAndFilterPets(allPets);
  }, [props.data]);

  useEffect(() => {
    if (!props.data) return;
    const allPets = buildPetList();
    setAllPets(allPets);
    sortAndFilterPets(allPets);
  }, [previewMaxLevel, previewEnchant, enchantPetMultiplier]);

  useEffect(() => {
    if (!props.data) return;
    sortAndFilterPets(allPets);
  }, [sortColumn,nameFilter, currencyFilter, hideUnobtainedSecret]);

  const buildPetList = () => {
    const allPets: PetInstance[] = [];
    props.data.forEach((cat) => {
      cat.categories.forEach((subcat) => {
        subcat.eggs.forEach((egg) => {
          egg.pets.forEach((pet) => {
            // allPets.push({
            //   name: pet.name,
            //   chance: getPetChance(pet, "Normal"),
            //   rarity: pet.rarity,
            //   bubbles: getPetStat(pet, "Normal", "bubbles"),
            //   currencyVariant: pet.currencyVariant,
            //   currency: getPetStat(pet, "Normal", "currency"),
            //   gems: getPetStat(pet, "Normal", "gems"),
            //   variantIndex: -1,
            //   variant: "Normal",
            //   image: pet.image,
            //   egg,
            // });
            pet.variants.forEach((variant) => {
              allPets.push({
                name: pet.name,
                chance: getPetChance(pet, variant),
                rarity: pet.rarity,
                bubbles: getPetStat(pet, variant, "bubbles"),
                currencyVariant: pet.currencyVariant,
                currency: getPetStat(pet, variant, "currency"),
                gems: getPetStat(pet, variant, "gems"),
                variant,
                variantIndex: pet.variants.indexOf(variant),
                image: pet.image,
                egg,
              });
            });
          });
        });
      });
    });
    return allPets;
  }

  const sortAndFilterPets = (pets: PetInstance[]) => {
    const filteredPets = pets.filter((pet) => {
      const isOwned = !!ownedPets[`${pet.name}__${pet.variant}`];
      const matchesCurrency = currencyFilter ? currencyFilter.includes(pet.currencyVariant) : true;
      const matchesObtained = hideUnobtainedSecret ? isOwned : true;
      return matchesCurrency && matchesObtained && pet.name.toLowerCase().includes(nameFilter.toLowerCase());
    });

    const sorted = sortPets(filteredPets);

    setSortedPets(sorted);
  }

  const sortPets = (pets: PetInstance[]) => {
    return pets.sort((a, b) => {
      if (sortColumn === "name") {
        return a.name.localeCompare(b.name);
      } else if (sortColumn === "chance") {
        return b.chance - a.chance;
      } else if (sortColumn === "bubbles") {
        return b.bubbles - a.bubbles;
      } else if (sortColumn === "coins") {
        return b.currency - a.currency;
      } else if (sortColumn === "gems") {
        return b.gems - a.gems;
      }
      return 0;
    });
  }

  const saveState = (pets: OwnedPets) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pets));
    } catch {}
  };

  const togglePet = (pet: string, variant: PetVariant) => {
    const key: PetKey = `${pet}__${variant}`;
    setOwnedPets((prev) => {
      const updated = { ...prev, [key]: !prev[key] };
      saveState(updated);
      return updated;
    });
  };

  const getPetChance = (pet: Pet, variant: PetVariant) => {
    if (!pet.chance.startsWith("1/")) {
      return 0;
    }
    // extract the base chance from the string. It will be like "1/1,000" and we want "1000".
    const baseChanceValue = Number(pet.chance.split("/")[1].replaceAll(",", ""));
    const variantChance = baseChanceValue * variantChanceMultipliers[variant];
    return variantChance;
  }

  const getPetImage = (pet: PetInstance, variantIndex: number) => {
    if (variantIndex === -1) {
      return pet.image[0]; // Fallback to the first image if the variant is not found
    }
    return pet.image[variantIndex];
  }

  const getPetStat = (pet: Pet, variant: PetVariant, stat: "bubbles" | "currency" | "gems") => {
    let scale = variantScales[variant];
    if (previewMaxLevel) scale *= variantLevelScales[variant];
    let baseStat = pet[stat];
    let multiplier = 1;
    if (previewEnchant) {
      if (variant === "Shiny" || variant === "Shiny Mythic") {
        if ((secondEnchant === "bubbler" && stat === "bubbles") || (secondEnchant === "looter" && stat === "currency")) {
          multiplier += 0.5;
        }
      }
      multiplier += (enchantPetMultiplier * 0.25);
    }
    return Math.floor(baseStat * scale * multiplier);
  }

  return (
    <Box component="main" sx={{ display: "flex", flexDirection: "column", alignItems: 'center', flexGrow: 1, p: 3, mt: 1, mx: "auto", maxWidth: "1200px" }} >
      { /* Filters */ }
      <Paper sx={{  padding: 2, marginBottom: 2, display: "flex", flexDirection: "column", alignItems: "center" }}>
        <Box sx={{ display: "flex", flexDirection: "row", alignItems: "center", marginBottom: 1, padding: 2 }}>
          <Input
            placeholder="Search pets..."
            value={nameFilter}
            onChange={(event) => setNameFilter(event.target.value)}
            sx={{ marginRight: 1, width: "200px" }}
          />
        </Box>
        <Box sx={{ width: '800px', display: "flex", flexWrap: 'wrap', flexShrink: 0,  flexDirection: "row", justifyContent: 'space-evenly' }}>
          <Box sx={{ display: "flex", flexDirection: "row", alignItems: "center", marginBottom: 1 }}>
            <Typography variant="subtitle1" sx={{ marginRight: 1 }}>Hide unobtained:</Typography>
            <Checkbox
              checked={hideUnobtainedSecret}
              onChange={() => setObtainedFilter(!hideUnobtainedSecret)}
            />
          </Box>
          <Box sx={{ display: "flex", flexDirection: "row", alignItems: "center", marginBottom: 1 }}>
            <Typography variant="subtitle1" sx={{ marginRight: 1 }}>Currency:</Typography>
            <Select
              value={currencyFilter || ""}
              onChange={(event) => setCurrencyFilter(event.target.value as CurrencyVariant)}
              displayEmpty
              sx={{ minWidth: 120 }}
            >
              <MenuItem value="">All</MenuItem>
              {Object.keys(currencyImages).map((currency) => (
                <MenuItem key={currency} value={currency}>
                  <img src={currencyImages[currency as CurrencyVariant]} alt={currency} style={{ width: 16, height: 16, verticalAlign: "middle", marginRight: 4 }} />
                  {currency}
                </MenuItem>
              ))}
            </Select>
          </Box>
          <Box sx={{ display: "flex", flexDirection: "row", alignItems: "center", marginBottom: 1 }}>
            <Typography variant="subtitle1" sx={{ marginRight: 1 }}>Preview max level:</Typography>
            <Checkbox
              checked={previewMaxLevel}
              onChange={() => setPreviewMaxLevel(!previewMaxLevel)}
            />
          </Box>
          <Box sx={{ display: "flex", flexDirection: "row", alignItems: "center", marginBottom: 1 }}>
            <Typography variant="subtitle1" sx={{ marginRight: 1 }}>Preview Enchant:</Typography>
            <Checkbox
              checked={previewEnchant}
              onChange={() => setPreviewEnchant(!previewEnchant)}
            />
          </Box>
        </Box>
      </Paper>
      { /* Table */ }
      <Table size="small" sx={{ "& .MuiTableCell-root": { p: 0.5 } }}>
        <TableHead>
          <TableRow>
            { /* Checkbox column */}
            <TableCell sx={{ width: 24 }} />
            {/* Pet image column */}
            <TableCell sx={{ width: 24 }} />
            <TableCell sx={{ width: 150, fontWeight: "bold" }}>
              <Button
                onClick={() => setSortColumn("name")}
                sx={{ textTransform: "none", fontWeight: "bold" }}
              >
                Pet
              </Button>
            </TableCell>
            <TableCell sx={{ width: 150, fontWeight: "bold" }}>
              <Button
                onClick={() => setSortColumn("chance")}
                sx={{ textTransform: "none", fontWeight: "bold" }}
              >
                Chance
              </Button>
            </TableCell>
            <TableCell sx={{ width: 50, fontWeight: "bold" }}>
              <Button
                onClick={() => setSortColumn("bubbles")}
                sx={{ textTransform: "none", fontWeight: "bold" }}
              >
                <img src="https://static.wikia.nocookie.net/bgs-infinity/images/0/0c/Bubbles.png" alt="Bubbles" style={{ width: 16, height: 16, verticalAlign: "middle", marginLeft: 4 }} />
              </Button>
            </TableCell>
            <TableCell sx={{ width: 50, fontWeight: "bold" }}>
              <Button
                onClick={() => setSortColumn("coins")}
                sx={{ textTransform: "none", fontWeight: "bold" }}
              >
                💰
              </Button>
            </TableCell>
            <TableCell sx={{ width: 50, fontWeight: "bold" }}>
              <Button
                onClick={() => setSortColumn("gems")}
                sx={{ textTransform: "none", fontWeight: "bold" }}
              >
                <img src="https://static.wikia.nocookie.net/bgs-infinity/images/d/d5/Gems.png" alt="Gems" style={{ width: 16, height: 16, verticalAlign: "middle", marginLeft: 4 }} />
              </Button>
            </TableCell>
            {/* Egg image column */}
            <TableCell sx={{ width: 24 }} />
            <TableCell sx={{ width: 150, fontWeight: "bold" }}>
                Source
            </TableCell>
          </TableRow>
        </TableHead>
          <TableBody>
            {
              sortedPets.flatMap((pet) => {
                const variant = pet.variant;
                const petImage = getPetImage(pet, pet.variantIndex);

                return (
                  <>
                  <TableRow key={`${pet.name}-${variant}`} sx={{opacity: ownedPets[`${pet.name}__${variant}`] ? 1 : 0.4 }}>
                    <TableCell>
                      <Checkbox
                        size="small"
                        checked={!!ownedPets[`${pet.name}__${variant}`]}
                        onChange={() => togglePet(pet.name, variant)}
                      />
                    </TableCell>
                    <TableCell>
                      <img
                        src={petImage}
                        alt={pet.name}
                        style={{ width: 24, height: 24 }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        <Link href={`https://bgs-infinity.fandom.com/wiki/${pet.name}`} target="_blank">
                          <span style={{ ...getNameAndChanceStyle(pet.rarity) }}>{variant === "Normal" ? pet.name : `${pet.name}`}</span>{" "}
                          {variant !== "Normal" && <span style={variantStyles[variant]}>{`(${variant})`}</span>}
                        </Link>
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        1/{pet.chance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        +{pet.bubbles} <img src="https://static.wikia.nocookie.net/bgs-infinity/images/0/0c/Bubbles.png" alt="Bubbles" style={{ width: 16, height: 16, verticalAlign: "middle", marginLeft: 4 }} />
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        x{pet.currency} <img src={currencyImages[pet.currencyVariant]} alt={pet.currencyVariant} style={{ width: 16, height: 16, verticalAlign: "middle", marginLeft: 4 }} />
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        x{pet.gems} <img src="https://static.wikia.nocookie.net/bgs-infinity/images/d/d5/Gems.png" alt="Gems" style={{ width: 16, height: 16, verticalAlign: "middle", marginLeft: 4 }} />
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Avatar
                        src={pet.egg.image}
                        alt={pet.egg.name}
                        sx={{ width: 24, height: 24 }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {pet.egg.name}
                      </Typography>
                    </TableCell>
                  </TableRow>
                  </>
                );
              })
            }
          </TableBody>
      </Table>
    </Box>
  );
}
