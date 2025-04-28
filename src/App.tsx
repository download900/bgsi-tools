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
import { CompletionTracker } from "./pages/CompletionTracker";
import { OddsCalculator } from "./pages/OddsCalculator";
import petJson from "./assets/pets.json";
import { Home } from "./pages/Home";

// Types
export type PetVariant = "Normal" | "Shiny" | "Mythic" | "Shiny Mythic";
export type Rarity = "Common" | "Unique" | "Rare" | "Epic" | "Legendary" | "Secret";

export interface CategoryData { name: string, categories: SubCategoryData[]}
export interface SubCategoryData { name: string; eggs: Egg[], category: CategoryData; discontinued: boolean }
export interface Egg { name: string; image: string; pets: Pet[], subcategory: SubCategoryData; discontinued: boolean }
export interface Pet { name: string; chance: string; rarity: Rarity; variants: PetVariant[]; image: string; egg: Egg; discontinued: boolean }

// Data
const petData = petJson as CategoryData[];

// Tabs
export type Tabs = "Completion" | "Odds";

export default function App() {
  const [data, setData] = useState<CategoryData[]>([]);
  const [showOdds, setShowOdds] = useState<Boolean>();
  const [currentTab, setCurrentTab] = useState<"Completion" | "Odds">("Completion");

  useEffect(() => {

    petData.forEach((cat => {
      cat.categories.forEach((subcat) => {
        subcat.category = cat;
        subcat.eggs.forEach((egg) => {
          egg.subcategory = subcat;
          if (subcat.discontinued) {
            egg.discontinued = true;
          }
          egg.pets.forEach((pet) => {
            pet.egg = egg;
            if (egg.discontinued) {
              pet.discontinued = true;
            }
          })
        })
      })
    }))
    
    setData(petData);
    
  }, []);

  // NOTE: We are NOT using Router / URL location because this is a Github Pages site, and that is not supported.
  // Tabs are controlled by the state of the currentTab variable.
  // Therefore, <Link> is not used for the tabs, but rather the onChange event of the Tabs component.

  return (
    <>
      <AppBar position="static" sx={{ position: "sticky", top: 0, zIndex: 1000 }}>
        <Toolbar>
          <img src={headerImage} alt="Logo" style={{ width:32, height:32, marginRight:8 }} />
          <Typography variant="h6" sx={{ flexGrow:1 }}>BGSI Tools</Typography>
          <Tabs value={currentTab} onChange={(event, newValue) => setCurrentTab(newValue)} sx={{ flexGrow: 1 }}>
            <Tab label="Completion Tracker" value="Completion" /> 
            <Tab label="Odds Calculator" value="Odds" />
          </Tabs>
        </Toolbar>
      </AppBar>
      <Box sx={{ mt:2 }}>
        <Container sx={{ mt: 4, display: 'flex', flexDirection: 'row', justifyContent: 'center', alignItems: 'middle', maxWidth: '100% !important' }}>
          <Box sx={{ display: currentTab === 'Completion' ? 'flex' : 'none', flexGrow: '1', justifyContent: 'center', alignItems: 'middle' }}>
            <CompletionTracker data={data} />
          </Box>
          <Box sx={{ display: currentTab === 'Odds' ? 'flex' : 'none', flexGrow: '1', justifyContent: 'center', alignItems: 'middle' }}>
            <OddsCalculator data={data} />
          </Box>
        </Container>
      </Box>
    </>
  );
}