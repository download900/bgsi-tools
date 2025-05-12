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
  Paper,
  Drawer
} from "@mui/material";
import { BrowserRouter, Routes, Route, Link, useLocation } from "react-router-dom";
import headerImage from "./assets/Bubble_Gum.webp";
import { PetList } from "./pages/PetList";
import { OddsCalculator } from "./pages/OddsCalculator";
import petJson from "./assets/pets.json";
import { CompletionTracker } from "./pages/CompletionTracker";

// Types
export type Rarity = "Common" | "Unique" | "Rare" | "Epic" | "Legendary" | "Secret";
export type PetVariant = "Normal" | "Shiny" | "Mythic" | "Shiny Mythic";
export type CurrencyVariant = "Coins" | "Tickets";

export const variantScales: { [key in PetVariant]: number } = {
  Normal: 1,
  Shiny: 1.5,
  Mythic: 1.75,
  "Shiny Mythic": 2.25,
};

export const variantLevelScales: { [key in PetVariant]: number } = {
  Normal: 1.35,
  Shiny: 1.233333,
  Mythic: 1.2,
  "Shiny Mythic": 1.1556,
};

export const variantChanceMultipliers: { [key in PetVariant]: number } = {
  Normal: 1,
  Shiny: 40,
  Mythic: 100,
  "Shiny Mythic": 4000,
};

export const currencyImages: { [key in CurrencyVariant]: string } = {
  Coins: "https://static.wikia.nocookie.net/bgs-infinity/images/f/f0/Coins.png",
  Tickets: "https://static.wikia.nocookie.net/bgs-infinity/images/1/14/Tickets.png",
};

export interface CategoryData { name: string, categories: SubCategoryData[], ignoreCalculator: boolean }
export interface SubCategoryData { name: string; eggs: Egg[], category: CategoryData; ignoreCalculator: boolean }
export interface Egg { name: string; image: string; pets: Pet[], subcategory: SubCategoryData; ignoreCalculator: boolean }
export interface Pet { name: string; chance: string; rarity: Rarity; bubbles: number; currencyVariant: CurrencyVariant; currency: number; gems: number; variants: PetVariant[]; image: string[]; egg: Egg; ignoreCalculator: boolean }

// Data
const petData = petJson as CategoryData[];

// Tabs
export type Tabs = "Completion" | "Stats" | "Odds";

export default function App() {
  const [data, setData] = useState<CategoryData[]>([]);
  const [currentTab, setCurrentTab] = useState<"Completion" | "Odds" | "Stats">("Completion");

  useEffect(() => {

    petData.forEach((cat) => {
      cat.categories.forEach((subcat) => {
        subcat.category = cat;
        if (cat.ignoreCalculator) subcat.ignoreCalculator = true;
        if (!subcat.eggs) {
          console.error(`Eggs not found for subcategory: ${subcat.name}`);
          return;
        }
        subcat.eggs.forEach((egg) => {
          egg.subcategory = subcat;
          if (subcat.ignoreCalculator) egg.ignoreCalculator = true;
          egg.pets.forEach((pet) => {
            pet.egg = egg;
            if (egg.ignoreCalculator) pet.ignoreCalculator = true;
            if (!pet.currencyVariant) pet.currencyVariant = "Coins";
          });
        });
     });
   });
   
   setData(petData);
   
  }, []);

  return (
    <>
      <AppBar position="static" sx={{ position: "sticky", top: 0, zIndex: 1000 }}>
        <Toolbar>
          <img src={headerImage} alt="Logo" style={{ width:32, height:32, marginRight:8 }} />
          <Typography variant="h6" sx={{ flexGrow:1 }}>BGSI Tools</Typography>
          <Tabs value={currentTab} onChange={(event, newValue) => setCurrentTab(newValue)} sx={{ flexGrow: 1 }}>
            <Tab label="Index" value="Completion" /> 
            <Tab label="Stats" value="Stats" /> 
            <Tab label="Calculator" value="Odds" />
          </Tabs>
        </Toolbar>
      </AppBar>
      <Box sx={{ mt:2 }}>
        {/* <Scraper /> */}
        <Container sx={{ mt: 4, display: 'flex', flexDirection: 'row', justifyContent: 'center', alignItems: 'middle', maxWidth: '100% !important' }}>
          <Box sx={{ display: currentTab === 'Completion' ? 'flex' : 'none', flexGrow: '1', justifyContent: 'center', alignItems: 'middle', maxWidth: '100% !important' }}>
            <CompletionTracker data={data} />
          </Box>
          <Box sx={{ display: currentTab === 'Stats' ? 'flex' : 'none', flexGrow: '1', justifyContent: 'center', alignItems: 'middle', maxWidth: '100% !important' }}>
            <PetList data={data} />
          </Box>
          <Box sx={{ display: currentTab === 'Odds' ? 'flex' : 'none', flexGrow: '1', justifyContent: 'center', alignItems: 'middle', maxWidth: '100% !important' }}>
            <OddsCalculator data={data} />
          </Box>
        </Container>
      </Box>
    </>
  );
}