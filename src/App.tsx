import React, { useEffect, useState } from "react";
import {
  Container,
  Button,
  ButtonGroup,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Checkbox,
  Typography,
  createTheme,
  ThemeProvider,
  CssBaseline,
  Box,
  Paper
} from "@mui/material";
import petJson from "./assets/pets.json";
import headerImage from "./assets/Bubble_Gum.webp";

// Types
const typedPetJson = petJson as CategoryData[];
const theme = createTheme({ palette: { mode: "dark" } });

type PetVariant = "Normal" | "Shiny" | "Mythic" | "Shiny Mythic";
type Rarity = "Common" | "Unique" | "Rare" | "Epic" | "Legendary" | "Secret";

interface PetEntry {
  name: string;
  chance: string;
  rarity: Rarity;
  variants: PetVariant[];
  image: string;
}

interface Egg { name: string; image: string; pets: PetEntry[] }
interface CategoryData { name: string; eggs: Egg[] }
type PetKey = `${string}__${PetVariant}`;
type OwnedPets = Record<PetKey, boolean>;

// Constants
const STORAGE_KEY = "petTrackerState";
const variants: PetVariant[] = ["Normal", "Shiny", "Mythic", "Shiny Mythic"];

const rarityColorMap: Record<Rarity, string> = {
  Common: "#ffffff",
  Unique: "#fdc394",
  Rare: "#ff6161",
  Epic: "#d166fd",
  Legendary: "rainbow",
  Secret: "#ff9900"
};

// Helper functions
const getNameAndChanceStyle = (rarity: Rarity): React.CSSProperties => {
  const color = rarityColorMap[rarity];
  if (rarity === "Legendary") {
    return {
      background: "linear-gradient(90deg, #ff9999, #ffd699, #fffd99, #99ffb4, #99ffff, #99b3ff, #c599ff)",
      WebkitBackgroundClip: "text" as const,
      color: "transparent", fontWeight: "bold"
    };
  }
  if (rarity === "Secret") {
    return { color, fontWeight: "bold" };
  }
  return { color };
};

const getPercentStyle = (percent: number): React.CSSProperties => {
  if (percent === 100) {
    return { color: "#39ff14", fontWeight: "bold" };
  }
  const hue = Math.round((percent / 100) * 120);
  return { color: `hsl(${hue},100%,40%)` };
};

// App component
function App() {
  const [data, setData] = useState<CategoryData[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [ownedPets, setOwnedPets] = useState<OwnedPets>({});

  // Load JSON and initial selection
  useEffect(() => {
    setData(typedPetJson);
    setSelectedCategory(typedPetJson[0]?.name || "");
  }, []);

  // Load saved state from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setOwnedPets(JSON.parse(saved));
      }
    } catch {
      setOwnedPets({});
    }
  }, []);


  // Save to localStorage
  const saveState = (pets: OwnedPets) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pets));
    } catch {
      // silent fail
    }
  };

  // Toggle an owned pet
  const togglePet = (pet: string, variant: PetVariant) => {
    const key: PetKey = `${pet}__${variant}`;
    setOwnedPets((prev) => {
      const updated = { ...prev, [key]: !prev[key] };
      saveState(updated);
      return updated;
    });
  };

  // Calculate completion percentages
  const calculateCompletion = (pets: PetEntry[]) => {
    const totals: Record<PetVariant, number> = { Normal: 0, Shiny: 0, Mythic: 0, "Shiny Mythic": 0 };
    const owned: Record<PetVariant, number> = { Normal: 0, Shiny: 0, Mythic: 0, "Shiny Mythic": 0 };
    pets.forEach((pet) => {
      pet.variants.forEach((v) => {
        totals[v]++;
        if (ownedPets[`${pet.name}__${v}`]) owned[v]++;
      });
    });
    const totalAll = Object.values(totals).reduce((a, b) => a + b, 0);
    const ownedAll = Object.values(owned).reduce((a, b) => a + b, 0);
    return {
      overall: totalAll ? Math.round((ownedAll / totalAll) * 100) : 0,
      perVariant: Object.fromEntries(
        variants.map((v) => [v, totals[v] ? Math.round((owned[v] / totals[v]) * 100) : 0])
      ) as Record<PetVariant, number>
    };
  };

  const selectedData = data.find((cat) => cat.name === selectedCategory);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Container sx={{ textAlign: 'center' }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', mb: 2, marginTop: 2 }}>
          <img src={headerImage} alt="Tracker Logo" style={{ width: 48, height: 48, marginRight: 8, marginTop: -10 }} />
          <Typography variant="h4" gutterBottom>
            BGSI Completionist Tracker
          </Typography>
        </Box>

        {/* Category selector with overall percent */}
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
          <ButtonGroup variant="outlined" sx={{ flexWrap: 'wrap' }}>
            {data.map((cat) => {
              const stats = calculateCompletion(cat.eggs.flatMap((e) => e.pets));
              return (
                <Button
                  key={cat.name}
                  variant={selectedCategory === cat.name ? 'contained' : 'outlined'}
                  onClick={() => setSelectedCategory(cat.name)}
                >
                  {cat.name} ({stats.overall}% )
                </Button>
              );
            })}
          </ButtonGroup>
        </Box>

        {/* Category completion table */}
        {selectedData && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 4 }}>
            <Paper sx={{ p: 2, width: 'fit-content' }}>
              <Typography variant="h6" gutterBottom>
                {selectedCategory} Completion
              </Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ width: '80px' }}>Overall</TableCell>
                    {variants.map((v) => (
                      <TableCell key={v} sx={{ width: '80px' }}>{v}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  <TableRow>
                    {(() => {
                      const stats = calculateCompletion(selectedData.eggs.flatMap((e) => e.pets));
                      return (
                        <>
                          <TableCell sx={getPercentStyle(stats.overall)}>{stats.overall}%</TableCell>
                          {variants.map((v) => (
                            <TableCell key={v} sx={getPercentStyle(stats.perVariant[v])}>
                              {stats.perVariant[v]}%
                            </TableCell>
                          ))}
                        </>
                      );
                    })()}
                  </TableRow>
                </TableBody>
              </Table>
            </Paper>
          </Box>
        )}

        {/* Egg tables with image and title+percent */}
        {selectedData?.eggs.map((egg) => {
          const stats = calculateCompletion(egg.pets);
          return (
            <Box key={egg.name} sx={{ mb: 2, maxWidth: 800, marginLeft: 'auto', marginRight: 'auto' }}>
              <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: 'center', justifyContent: 'left', mb: 1 }}>
                <img src={egg.image} alt={`${egg.name} image`} style={{ width: 32, height: 32, marginRight: 4 }} />
                <Typography variant="h5">
                  {egg.name}{' '}
                  <Typography component="span" sx={getPercentStyle(stats.overall)}>
                    ({stats.overall}%)
                  </Typography>
                </Typography>
              </Box>

              {/* Pet table */}
              <Table size="small" sx={{ '& .MuiTableCell-root': { p: 0.2 }, marginBottom: 5 }}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ width: 20, p: 0.5 }} />
                    <TableCell sx={{ width: 100, p: 0.5, fontWeight:'bold' }}>Pet</TableCell>
                    <TableCell sx={{ width: 100, p: 0.5, fontWeight:'bold' }}>Chance / Source</TableCell>
                    {variants.map((v) => (
                      <TableCell key={v} sx={{ width: 40, p: 0.5, fontWeight:'bold' }}>{v}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {egg.pets.map((pet) => {
                    const style = getNameAndChanceStyle(pet.rarity);
                    return (
                      <TableRow key={pet.name}>
                        <TableCell sx={{ p: 0.5 }}>
                          <img src={pet.image} alt={pet.name} style={{ width: 24, height: 24, objectFit: 'contain' }} />
                        </TableCell>
                        <TableCell sx={{ p: 0.5 }}>
                          <Typography component="span" sx={style} variant="body2">
                            {pet.name}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ p: 0.5 }}>
                          <Typography component="span" sx={style} variant="body2">
                            {pet.chance}
                          </Typography>
                        </TableCell>
                        {variants.map((v) => (
                          <TableCell key={v} sx={{ p: 0.5 }}>
                            {pet.variants.includes(v) && (
                              <Checkbox
                                size="small"
                                checked={!!ownedPets[`${pet.name}__${v}`]}
                                onChange={() => togglePet(pet.name, v)}
                              />
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Box>
          );
        })}
      </Container>
    </ThemeProvider>
  );
}

export default App;
