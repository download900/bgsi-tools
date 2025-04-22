import React, { useEffect, useState } from "react";
import {
  AppBar,
  Toolbar,
  Tabs,
  Tab,
  Container,
  Box,
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
  Paper
} from "@mui/material";
import { BrowserRouter, Routes, Route, Link, useLocation } from "react-router-dom";
import headerImage from "./assets/Bubble_Gum.webp";
import { CompletionTracker } from "./pages/CompletionTracker";
import { OddsCalculator } from "./pages/OddsCalculator";
import petJson from "./assets/pets.json";
const typedPetJson = petJson as CategoryData[];

// Types
export type PetVariant = "Normal" | "Shiny" | "Mythic" | "Shiny Mythic";
export type Rarity = "Common" | "Unique" | "Rare" | "Epic" | "Legendary" | "Secret";

export interface PetEntry { name: string; chance: string; rarity: Rarity; variants: PetVariant[]; image: string; }
export interface Egg { name: string; image: string; pets: PetEntry[] }
export interface CategoryData { name: string; eggs: Egg[] }

export default function App() {
  const [data, setData] = useState<CategoryData[]>([]);
  const location = useLocation();
  const current = location.pathname === '/' ? '/bgsi-completionist' : location.pathname;
  console.log(location.pathname, current);

  useEffect(() => {
    setData(typedPetJson);
  }, []);

  return (
    <>
      <AppBar position="static">
        <Toolbar>
          { /* header and logo (link to /) */ }
          <Link to="/" style={{ flexGrow: 1, display: 'flex', textDecoration: "none", color: "inherit" }}>
          <img src={headerImage} alt="Logo" style={{ width:32, height:32, marginRight:8 }} />
          <Typography variant="h6" sx={{ flexGrow:1 }}>BGSI Tools</Typography>
          </Link>
          <Tabs value={current} textColor="inherit" indicatorColor="secondary">
            <Tab label="Completion Tracker" value="/bgsi-completionist" component={Link} to="/bgsi-completionist" />
            <Tab label="Odds Calculator" value="/odds" component={Link} to="/odds" />
          </Tabs>
        </Toolbar>
      </AppBar>
      <Box sx={{ mt:2 }}>
        <Routes>
          <Route path="/" element={<CompletionTracker data={data} />} />
          <Route path="/bgsi-completionist" element={<CompletionTracker data={data} />} />
          <Route path="/odds" element={<OddsCalculator />} />
        </Routes>
      </Box>
    </>
  );
}

// export default function RootApp() {
//   return (
//     <ThemeProvider theme={theme}>
//       <CssBaseline />
//       <BrowserRouter>
//         <App />
//       </BrowserRouter>
//     </ThemeProvider>
//   );
// }
