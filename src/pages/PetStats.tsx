// src/pages/CompletionTracker.tsx
import React, { useEffect, useState, useRef } from "react";
import { Box, Avatar, Typography, Paper, Table, TableHead, TableRow, TableCell, TableBody, Checkbox, Link, Button, Select, MenuItem, Input } from "@mui/material";
import { PetInstance, PetVariant, CurrencyVariant, petVariants, currencyImages, getPetChance, getPetStat, Egg, PetData, Pet } from "../util/DataUtil";
import { capitalize, imgIcon, variantStyle } from "../util/StyleUtil";

const STORAGE_KEY = "petTrackerState";
type PetKey = `${string}__${PetVariant}`;
type OwnedPets = Record<PetKey, boolean>;

const SETTINGS_KEY = "petTrackerSettings";

type ObtainedFilter = "obtained" | "unobtained" | "all";
type RarityFilter = "legendary" | "secret" | "all";
type SortKey = "name" | "chance" | "bubbles" | "coins" | "gems";

interface PetListProps {
    data: PetData | undefined;
}

export function PetList(props: PetListProps) {
  const [ownedPets, setOwnedPets] = useState<OwnedPets>({});

  const [allPets, setAllPets] = useState<PetInstance[]>([]);
  const [sortedPets, setSortedPets] = useState<PetInstance[]>([]);

  const [sortColumn, setSortColumn] = useState<SortKey>("bubbles");
  const [nameFilter, setNameFilter] = useState<string>("");
  const [obtainedFilter, setObtainedFilter] = useState<ObtainedFilter>("all");
  const [rarityFilter, setRarityFilter] = useState<RarityFilter>("all");
  const [variantFilter, setVariantFilter] = useState<PetVariant[]>([]);
  const [currencyFilter, setCurrencyFilter] = useState<CurrencyVariant | null>(null);

  const [previewMaxLevel, setPreviewMaxLevel] = useState<boolean>(true);
  const [previewEnchant, setPreviewEnchant] = useState<boolean>(true);
  const [enchantTeamSize, setEnchantTeamSize] = useState<number>(11);
  const [secondEnchant, setSecondEnchant] = useState<"looter" | "bubbler">("bubbler");

  const [visibleCount, setVisibleCount] = useState(20);

  // ~~~~~~~~~~~ hooks ~~~~~~~~~~~

  useEffect(() => {
    try {
      const saved = localStorage.getItem(SETTINGS_KEY);
      if (saved) {
        const settings = JSON.parse(saved) as {
          obtainedFilter: ObtainedFilter;
          rarityFilter: RarityFilter;
          variantFilter: PetVariant[];
          currency: CurrencyVariant | null;
          previewMaxLevel: boolean;
          previewEnchant: boolean;
          enchantTeamSize: number;
          secondEnchant: "looter" | "bubbler";
        };
        setObtainedFilter(settings.obtainedFilter || "all");
        setRarityFilter(settings.rarityFilter || "all");
        setVariantFilter(settings.variantFilter || []);
        setCurrencyFilter(settings.currency || null);
        setPreviewMaxLevel(settings.previewMaxLevel || true);
        setPreviewEnchant(settings.previewEnchant || true);
        setEnchantTeamSize(settings.enchantTeamSize || 11);
        setSecondEnchant(settings.secondEnchant || "bubbler");
      }
    } catch (e) {
      console.warn("could not load settings", e);
    }
  }, []);

  useEffect(() => {
    if (!props.data || props.data?.eggs.length < 1 || allPets?.length < 1) return;
    try {
      const settings = {
        obtainedFilter: obtainedFilter,
        rarityFilter: rarityFilter,
        variantFilter: variantFilter,
        currency: currencyFilter,
        previewMaxLevel,
        previewEnchant,
        enchantTeamSize: enchantTeamSize,
        secondEnchant
      };
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (e) {
      console.warn("could not save settings", e);
    }
  }, [ obtainedFilter, rarityFilter, variantFilter, currencyFilter, previewMaxLevel, previewEnchant, enchantTeamSize, secondEnchant ]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setOwnedPets(JSON.parse(saved));
    } catch {}

    const pets = buildPetList();
    setAllPets(pets);
    sortAndFilterPets(pets);
  }, [props.data]);

  useEffect(() => {
    if (!props.data || props.data?.eggs.length < 1 || allPets?.length < 1) return;
    const pets = buildPetList();
    setAllPets(pets);
    sortAndFilterPets(pets);
  }, [previewMaxLevel, previewEnchant, enchantTeamSize, secondEnchant]);

  useEffect(() => {
    if (!props.data || props.data?.eggs.length < 1 || allPets?.length < 1) return;
    sortAndFilterPets(allPets);
  }, [sortColumn,nameFilter, currencyFilter, obtainedFilter, rarityFilter, variantFilter]);

  // infinite‐scroll effect
  useEffect(() => {
    const handleScroll = () => {
      // how close to the bottom before loading more (px)
      const threshold = 150;
      const scrolledToBottom =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - threshold;
    
      if (scrolledToBottom && visibleCount < sortedPets.length) {
        setVisibleCount((c) => Math.min(c + 20, sortedPets.length));
      }
    };
  
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [visibleCount, sortedPets]);

  // ~~~~~~~~~~~ functions  ~~~~~~~~~~~

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

  const buildPetList = () => {
    const allPets: PetInstance[] = [];
    if (!props.data || props.data.eggs.length < 1) return [];

    const addPet = (pet: Pet) => {
      if (pet.rarity !== 'legendary' && pet.rarity !== 'secret' && pet.rarity !== 'infinity') return;
      petVariants.forEach((variant) => {
        if (variant.includes("Mythic") && !pet.hasMythic) return; // skip Mythic if pet doesn't have it
        allPets.push({
          name: pet.name,
          chance: getPetChance(pet, variant),
          hatchable: pet.hatchable,
          rarity: pet.rarity,
          bubbles: getPetStat(pet, variant, "bubbles", previewMaxLevel, previewEnchant, enchantTeamSize, secondEnchant),
          currencyVariant: pet.currencyVariant,
          currency: getPetStat(pet, variant, "currency", previewMaxLevel, previewEnchant, enchantTeamSize, secondEnchant),
          gems: getPetStat(pet, variant, "gems", previewMaxLevel, previewEnchant, enchantTeamSize, secondEnchant),
          variant,
          image: pet.image[petVariants.indexOf(variant)],
          obtainedFrom: pet.obtainedFrom,
          obtainedFromImage: pet.obtainedFromImage
        });
      });
    }

    props.data?.pets.forEach((pet) => {
      addPet(pet);
    });
    return allPets;
  }

  const sortAndFilterPets = (pets: PetInstance[]) => {
    const filteredPets = pets.filter((pet) => {
      const isOwned = !!ownedPets[`${pet.name}__${pet.variant}`];
      const matchesCurrency = currencyFilter ? currencyFilter.includes(pet.currencyVariant) : true;
      const matchesObtained = obtainedFilter === "all" || (obtainedFilter === "obtained" && isOwned) || (obtainedFilter === "unobtained" && !isOwned);
      const matchesRarity = rarityFilter === "all" || pet.rarity === rarityFilter;
      const matchesVariant = variantFilter.length === 0 || variantFilter.includes(pet.variant);
      return matchesCurrency && matchesObtained && matchesRarity && matchesVariant && pet.name.toLowerCase().includes(nameFilter.toLowerCase());
    });

    const sorted = sortPets(filteredPets);
    setSortedPets(sorted);
    setVisibleCount(20);
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

  // helper to get header sx
  const headerSx = (col: SortKey) => ({
    width: col === "name" || col === "chance" ? 150 : 50,
    fontWeight: "bold",
    // use the theme’s palette.action.selected token
    bgcolor: sortColumn === col ? "action.selected" : "inherit",
  });

  return (
        <Box component="main" sx={{ display: "flex", flexDirection: "column", alignItems: 'center', flexGrow: 1, p: 3, mt: 1, mx: "auto", maxWidth: "1200px" }} >
      { /* Filters */ }
      <Paper sx={{  padding: 2, marginBottom: 2, display: "flex", flexDirection: "column", alignItems: "center" }}>
        <Box sx={{ display: "flex", flexDirection: "row", alignItems: "center", p: 1 }}>
          <Input
            placeholder="Search pets..."
            value={nameFilter}
            onChange={(event) => setNameFilter(event.target.value)}
            sx={{ marginRight: 1, width: "200px" }}
          />
        </Box>
        <Box sx={{ width: '1100px', display: "flex", flexWrap: 'wrap', flexShrink: 0, flexDirection: "column", }}>
          <Box sx={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: 'space-evenly' }}>
            <Box sx={{ display: "flex", flexDirection: "row", alignItems: "center", p: 1 }}>
              <Typography variant="subtitle1" sx={{ marginRight: 1, fontWeight: 'bold' }}>Obtained:</Typography>
              <Select
                value={obtainedFilter}
                onChange={(event) => setObtainedFilter(event.target.value as ObtainedFilter)}
                displayEmpty
                sx={{ minWidth: 120 }}
              >
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="obtained">Obtained</MenuItem>
                <MenuItem value="unobtained">Unobtained</MenuItem>
              </Select>
            </Box>
            <Box sx={{ display: "flex", flexDirection: "row", alignItems: "center", p: 1 }}>
              <Typography variant="subtitle1" className='legendary' sx={{ marginRight: 1, fontWeight: 'bold' }}>Rarity:</Typography>
              <Select
                value={rarityFilter}
                onChange={(event) => setRarityFilter(event.target.value as RarityFilter)}
                displayEmpty
                sx={{ minWidth: 120 }}
              >
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="legendary" className="legendary">Legendary</MenuItem>
                <MenuItem value="secret" className="secret">Secret</MenuItem>
                <MenuItem value="infinity" className="infinity">Infinity</MenuItem>
              </Select>
            </Box>
            <Box sx={{ display: "flex", flexDirection: "row", alignItems: "center", p: 1 }}>
              <Typography variant="subtitle1" className='shiny-mythic' sx={{ marginRight: 1, fontWeight: 'bold' }}>Variant:</Typography>
              <Select
                value={Array.isArray(variantFilter) && variantFilter.length > 0 ? variantFilter : []}
                renderValue={(selected) => { return selected.length === 0 ? "All" : selected.join(", ").substring(0, 10); }}
                multiple
                onChange={(event) => setVariantFilter(event.target.value as PetVariant[])}
                displayEmpty
                sx={{ minWidth: 120 }}
              >
                {petVariants.map((variant) => (
                  <MenuItem key={variant} value={variant} className={variantStyle(variant)}>
                    <Checkbox checked={variantFilter.includes(variant)} />
                    {variant}
                  </MenuItem>
                ))}
              </Select>
            </Box>
            <Box sx={{ display: "flex", flexDirection: "row", alignItems: "center", p: 1 }}>
              <Typography variant="subtitle1" sx={{ marginRight: 1 }}>{imgIcon(currencyImages['coins'], 25)} Currency:</Typography>
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
                    {capitalize(currency)}
                  </MenuItem>
                ))}
              </Select>
            </Box>
          </Box>
          <Box sx={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: 'space-evenly' }}>
            <Box sx={{ display: "flex", flexDirection: "row", alignItems: "center", p: 1  }}>
              <Typography variant="subtitle1" sx={{ marginRight: 1 }}>
                {imgIcon('https://static.wikia.nocookie.net/bgs-infinity/images/2/29/Experienced_Icon.png', 25)} Level 25:
              </Typography>
              <Checkbox
                checked={previewMaxLevel}
                onChange={() => setPreviewMaxLevel(!previewMaxLevel)}
              />
            </Box>
            <Box sx={{ display: "flex", flexDirection: "row", alignItems: "center", p: 1  }}>
              <Typography variant="subtitle1" sx={{ marginRight: 1 }}>💖 Team Up/Determination:</Typography>
              <Checkbox
                checked={previewEnchant}
                onChange={() => setPreviewEnchant(!previewEnchant)}
              />
            </Box>
            <Box sx={{ display: "flex", flexDirection: "row", alignItems: "center", p: 1  }}>
              <Typography variant="subtitle1" sx={{ marginRight: 1 }}>
                {imgIcon('https://static.wikia.nocookie.net/bgs-infinity/images/5/5e/Pet_Equips_III_Icon.png', 25)} Team Size:
                </Typography>
              <Input
                value={enchantTeamSize}
                onChange={(event) => setEnchantTeamSize(Number(event.target.value))}
                sx={{ width: "50px", marginLeft: 1 }}
              />
            </Box>
            <Box sx={{ display: "flex", flexDirection: "row", alignItems: "center", p: 1  }}>
              <Typography variant="subtitle1" sx={{ marginRight: 1 }}>
                {imgIcon('https://static.wikia.nocookie.net/bgs-infinity/images/2/2f/Special_Enchants.png', 25)} Second Enchant:
                </Typography>
              <Select 
                value={secondEnchant}
                onChange={(event) => setSecondEnchant(event.target.value as "looter" | "bubbler")}
                displayEmpty
                sx={{ minWidth: 120, marginLeft: 1 }}
              >
                <MenuItem value="bubbler">Bubbler</MenuItem>
                <MenuItem value="looter">Looter</MenuItem>
              </Select>
            </Box>
          </Box>
        </Box>
      </Paper>

      <Table size="small" sx={{ "& .MuiTableCell-root": { p: 0.5 } }}>
          <TableHead>
            <TableRow>
              { /* Checkbox column */}
              <TableCell sx={{ width: 24 }} />
              {/* Pet image column */}
              <TableCell sx={{ width: 24 }} />
              <TableCell sx={{ ...headerSx("name") }}>
                <Button
                  onClick={() => setSortColumn("name")}
                  sx={{ textTransform: "none", fontWeight: "bold", width: '100%', textAlign: 'left' }}
                >
                  Pet
                </Button>
              </TableCell>
              <TableCell sx={{ ...headerSx("chance") }}>
                <Button
                  onClick={() => setSortColumn("chance")}
                  sx={{ textTransform: "none", fontWeight: "bold", width: '100%', textAlign: 'left' }}
                >
                  Chance
                </Button>
              </TableCell>
              <TableCell sx={{ ...headerSx("bubbles") }}>
                <Button
                  onClick={() => setSortColumn("bubbles")}
                  sx={{ textTransform: "none", fontWeight: "bold", width: '100%', textAlign: 'left' }}
                >
                  {imgIcon("https://static.wikia.nocookie.net/bgs-infinity/images/0/0c/Bubbles.png")}
                </Button>
              </TableCell>
              <TableCell sx={{ ...headerSx("coins") }}>
                <Button
                  onClick={() => setSortColumn("coins")}
                  sx={{ textTransform: "none", fontWeight: "bold", width: '100%', textAlign: 'left' }}
                >
                  💰
                </Button>
              </TableCell>
              <TableCell sx={{ ...headerSx("gems") }}>
                <Button
                  onClick={() => setSortColumn("gems")}
                  sx={{ textTransform: "none", fontWeight: "bold", width: '100%', textAlign: 'left' }}
                >
                  {imgIcon("https://static.wikia.nocookie.net/bgs-infinity/images/d/d5/Gems.png")}
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
            {sortedPets.slice(0, visibleCount).map(pet => {
              const variant = pet.variant;
              const petImage = pet.image;

              return (
                <>
                <TableRow key={`${pet.name}-${variant}`} sx={{opacity: ownedPets[`${pet.name}__${variant}`] ? 1 : 0.75 }}>
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
                        <span className={pet.rarity}>{pet.name}</span>{" "}
                        {variant !== "Normal" && <span className={variantStyle(variant)}>{`(${variant})`}</span>}
                      </Link>
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      { pet.hatchable ? `1/${(100 / pet.chance).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "100%" }
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {imgIcon("https://static.wikia.nocookie.net/bgs-infinity/images/0/0c/Bubbles.png")} +{pet.bubbles}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {imgIcon(currencyImages[pet.currencyVariant])} x{pet.currency}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {imgIcon("https://static.wikia.nocookie.net/bgs-infinity/images/d/d5/Gems.png")} x{pet.gems}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Avatar
                      src={pet.obtainedFromImage}
                      alt={pet.obtainedFrom}
                      sx={{ width: 24, height: 24 }}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {pet.obtainedFrom}
                    </Typography>
                  </TableCell>
                </TableRow>
                </>)
            })}
          </TableBody>
        </Table>
    </Box>
  );
}
