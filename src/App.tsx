import { useEffect, useState } from "react";
import { AppBar, Toolbar, Tabs, Tab, Container, Box, Typography, Link } from "@mui/material";
import headerImage from "./assets/favicon.png";
import { PetList } from "./pages/PetStats";
import { OddsCalculator } from "./pages/Calculator";
import { PetIndex } from "./pages/PetIndex";
import { PetData, loadData } from "./util/DataUtil";
import { SiGithub } from "react-icons/si";
import { WikiTools } from "./pages/WikiTools";
import { TeamBuilder } from "./pages/TeamBuilder";

// Tabs
export type Tabs = "Completion" | "Stats" | "Odds";

export default function App() {
  const [data, setData] = useState<PetData>();
  const [currentTab, setCurrentTab] = useState<"Calculator" | "Index" | "Stats" | "TeamBuilder" | "WikiTools">("Calculator");

  // only show WikiTools if running in localhost
  const isLocalhost = window.location.hostname === "localhost";

  useEffect(() => {
    setData(loadData());
  }, []);

  return (
    <>
      <AppBar position="static" sx={{ position: "sticky", top: 0, zIndex: 1000 }}>
        <Toolbar>
          <img src={headerImage} alt="Logo" style={{ width:32, height:32, marginRight:8 }} />
          <Typography variant="h6" sx={{ flexGrow:1 }}>BGSI Tools</Typography>
          <Tabs value={currentTab} onChange={(event, newValue) => setCurrentTab(newValue)} sx={{ flexGrow: 1 }}>
            <Tab label="Calculator" value="Calculator" />
            <Tab label="Index" value="Index" />
            <Tab label="Pet Stats" value="Stats" /> 
            <Tab label="Team Builder" value="TeamBuilder" /> 
            <Tab label="Wiki Scraper" value="WikiTools" />
          </Tabs>
          <Link href="https://github.com/borngame/bgsi-tools" target="_blank" rel="noopener noreferrer" sx={{ color: "white", textDecoration: "none", marginLeft: 2 }}>
            <Typography variant="h5"><SiGithub /></Typography>
          </Link>
        </Toolbar>
      </AppBar>
      <Box sx={{ mt:2 }}>
        <Container sx={{ mt: 4, display: 'flex', flexDirection: 'row', justifyContent: 'center', alignItems: 'middle', maxWidth: '100% !important' }}>
          <Box sx={{ display: currentTab === 'Calculator' ? 'flex' : 'none', flexGrow: '1', justifyContent: 'center', alignItems: 'middle', maxWidth: '100% !important' }}>
            <OddsCalculator data={data} />
          </Box>
          <Box sx={{ display: currentTab === 'Index' ? 'flex' : 'none', flexGrow: '1', justifyContent: 'center', alignItems: 'middle', maxWidth: '100% !important' }}>
            <PetIndex data={data} />
          </Box>
          <Box sx={{ display: currentTab === 'Stats' ? 'flex' : 'none', flexGrow: '1', justifyContent: 'center', alignItems: 'middle', maxWidth: '100% !important' }}>
            <PetList data={data} />
          </Box>
          <Box sx={{ display: currentTab === 'TeamBuilder' ? 'flex' : 'none', flexGrow: '1', justifyContent: 'center', alignItems: 'middle', maxWidth: '100% !important' }}>
            <TeamBuilder data={data} />
          </Box>
          <Box sx={{ display: currentTab === 'WikiTools' ? 'flex' : 'none', flexGrow: '1', justifyContent: 'center', alignItems: 'middle', maxWidth: '100% !important' }}>
            <WikiTools />
          </Box>
        </Container>
      </Box>
    </>
  );
}