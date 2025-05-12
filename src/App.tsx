import React, { useEffect, useState } from "react";
import {
  AppBar,
  Toolbar,
  Tabs,
  Tab,
  Container,
  Box,
  Typography,
  Link} from "@mui/material";
import headerImage from "./assets/Bubble_Gum.webp";
import { PetList } from "./pages/PetList";
import { OddsCalculator } from "./pages/OddsCalculator";
import { CompletionTracker } from "./pages/CompletionTracker";
import { CategoryData, loadPetData } from "./util/PetUtil";
import { SiGithub } from "react-icons/si";

// Tabs
export type Tabs = "Completion" | "Stats" | "Odds";

export default function App() {
  const [data, setData] = useState<CategoryData[]>([]);
  const [currentTab, setCurrentTab] = useState<"Completion" | "Odds" | "Stats">("Completion");

  useEffect(() => {
    const petData = loadPetData();
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
          <Link href="https://github.com/borngame/bgsi-tools" target="_blank" rel="noopener noreferrer" sx={{ color: "white", textDecoration: "none", marginLeft: 2 }}>
            <Typography variant="h5"><SiGithub /></Typography>
          </Link>
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