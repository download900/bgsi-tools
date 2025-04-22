import React, { useEffect, useRef, useState } from "react";
import {
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
  Paper,
  Select,
  MenuItem,
  Fab
} from "@mui/material";
import { Rarity, PetVariant, CategoryData, PetEntry } from "../App";
import { getNameAndChanceStyle, getPercentStyle, variants } from "../util/StyleUtil";
import { ScrollTop } from './ScrollTop';import { FaArrowAltCircleUp } from "react-icons/fa";

// Types

type PetKey = `${string}__${PetVariant}`;
type OwnedPets = Record<PetKey, boolean>;

const STORAGE_KEY = "petTrackerState";

export interface CompletionTrackerProps {
    data: CategoryData[];
}

export function CompletionTracker(props: CompletionTrackerProps) {
    const [selectedCategory, setSelectedCategory] = useState<string>();
    const [ownedPets, setOwnedPets] = useState<OwnedPets>({});

    useEffect(() => {
        setSelectedCategory(props.data[0]?.name || "");
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) setOwnedPets(JSON.parse(saved));
        } catch {}

    }, [props.data]);

    const saveState = (pets: OwnedPets) => {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(pets)); } catch {}
    };

    const togglePet = (pet: string, variant: PetVariant) => {
      const key: PetKey = `${pet}__${variant}`;
      setOwnedPets(prev => {
        const updated = { ...prev, [key]: !prev[key] };
        saveState(updated);
        return updated;
      });
    };

    const calculateCompletion = (pets: PetEntry[]) => {
      const totals: Record<PetVariant, number> = { Normal: 0, Shiny: 0, Mythic: 0, "Shiny Mythic": 0 };
      const owned: Record<PetVariant, number> = { ...totals };
      pets.forEach(pet => pet.variants.forEach(v => { totals[v]++; if (ownedPets[`${pet.name}__${v}`]) owned[v]++; }));
      const overall = Math.round((Object.values(owned).reduce((a,b)=>a+b,0) / Object.values(totals).reduce((a,b)=>a+b,0)) * 100) || 0;
      const perVariant = Object.fromEntries(variants.map(v => [v, totals[v] ? Math.round((owned[v]/totals[v])*100) : 0]));
      return { overall, perVariant } as { overall: number; perVariant: Record<PetVariant, number> };
    };

    const selectedData = props.data.find(cat => cat.name === selectedCategory);

    return (
        <Container sx={{ display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", mb: 4, maxWidth: "1200px" }}>
            

            <Box id="back-to-top-anchor" />
            {/* <Typography variant="h4" textAlign={"center"} pb={2}>Pet Completion</Typography> */}
            { /* All Pets */}
            <Box sx={{ display:'flex', justifyContent:'center', mb: 2 }}>
                <Paper sx={{ p:1 }} elevation={2}>
                    <Table size="small">
                        <TableHead><TableRow>
                            <TableCell sx={{ p:0.5, width:100 }}><b>All Pets</b></TableCell>
                            {variants.map(v=><TableCell key={v} sx={{ p:0.5,width:80 }}><b>{v}</b></TableCell>)}
                        </TableRow></TableHead>
                        <TableBody><TableRow>{(() => {
                            const stats = calculateCompletion(props.data.flatMap(cat => cat.eggs.flatMap(e=>e.pets)));
                            return (<>
                                <TableCell sx={{ ...getPercentStyle(stats.overall), p:0.5 }}>{stats.overall}%</TableCell>
                                {variants.map(v=><TableCell key={v} sx={{ ...getPercentStyle(stats.perVariant[v]), p:0.5 }}>{stats.perVariant[v]}%</TableCell>)}
                            </>);
                        }
                        )()}</TableRow></TableBody> 

                    </Table>
                    
                </Paper>
            </Box>
            { /* Horizontal line */ }
            <Box sx={{ width: '100%', height: "1px", backgroundColor: 'grey.700', mb: 2 }} />
            { /* Category */ }
            <Box sx={{ display:'flex', justifyContent:'center', mb: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 'bold', mt:0.5, mr:3 }}>Category:</Typography>
                <Select 
                    value={selectedCategory || ""}
                    size="small"
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    displayEmpty
                    sx={{ width: 200 }}
                >
                    {props.data.map(cat => {
                        const stats = calculateCompletion(cat.eggs.flatMap(e=>e.pets));
                        return (
                            <MenuItem key={cat.name} value={cat.name}>
                                <Typography variant="body1" sx={{ fontWeight: selectedCategory === cat.name ? 'bold' : 'normal' }}>
                                    {cat.name} ({stats.overall}%)
                                </Typography>
                            </MenuItem>
                        );
                    }
                    )}
                </Select>
            </Box>
            {selectedData && (
                <Box sx={{ display:'flex', justifyContent:'center', mb:4 }}>
                    <Paper sx={{ p:1 }}>
                        <Typography variant="h5">{selectedCategory} Completion</Typography>
                        <Table size="small">
                            <TableHead><TableRow>
                                <TableCell sx={{ p:0.5, width:100 }}><b>Overall</b></TableCell>
                                {variants.map(v=><TableCell key={v} sx={{ p:0.5,width:80 }}><b>{v}</b></TableCell>)}
                            </TableRow></TableHead>
                            <TableBody><TableRow>{(() => {
                                const stats = calculateCompletion(selectedData.eggs.flatMap(e=>e.pets));
                                return (<>
                                    <TableCell sx={{ ...getPercentStyle(stats.overall), p:0.5 }}>{stats.overall}%</TableCell>
                                    {variants.map(v=><TableCell key={v} sx={{ ...getPercentStyle(stats.perVariant[v]), p:0.5 }}>{stats.perVariant[v]}%</TableCell>)}
                                </>);
                            })()}</TableRow></TableBody>
                        </Table>
                    </Paper>
                </Box>
            )}

            {selectedData?.eggs.map(egg => {
                const stats = calculateCompletion(egg.pets);
                const id = egg.name.replace(/\s+/g, "_");
                return (
                    <Box
                        id={id}
                        key={id}
                        sx={{ mb: 4 }}
                    >
                        <Box sx={{ display:'flex', flexDirection:{xs:'column',sm:'row'}, alignItems:'center', mb:1 }}>
                            <img src={egg.image} alt={egg.name} style={{width:40,height:40,marginRight:8}} />
                            <Typography variant="h6">{egg.name} <Typography component="span" sx={getPercentStyle(stats.overall)}>({stats.overall}%)</Typography></Typography>
                        </Box>
                        <Paper sx={{ p:1 }} elevation={2}>
                            <Table size="small" sx={{ '& .MuiTableCell-root':{p:0.2}, width: '800px' }}>
                                <TableHead><TableRow>
                                <TableCell sx={{ p:0.5,width:24 }} />
                                <TableCell sx={{ p:0.5,width:100,fontWeight:'bold' }}>Pet</TableCell>
                                <TableCell sx={{ p:0.5,width:100,fontWeight:'bold' }}>Chance</TableCell>
                                {variants.map(v=><TableCell key={v} sx={{ p:0.5,width:40,fontWeight:'bold' }}>{v}</TableCell>)}
                                </TableRow></TableHead>
                                <TableBody>{egg.pets.map(pet=>{
                                const style=getNameAndChanceStyle(pet.rarity);
                                return (<TableRow key={pet.name}>
                                    <TableCell sx={{ p:0.5 }}><img src={pet.image} alt={pet.name} style={{width:30,height:30}}/></TableCell>
                                    <TableCell sx={{ p:0.5 }}><Typography sx={style} variant="body2">{pet.name}</Typography></TableCell>
                                    <TableCell sx={{ p:0.5 }}><Typography sx={style} variant="body2">{pet.chance}</Typography></TableCell>
                                    {variants.map(v=><TableCell key={v} sx={{ p:0.5 }}>{pet.variants.includes(v)&&<Checkbox size="small" checked={!!ownedPets[`${pet.name}__${v}`]} onChange={()=>togglePet(pet.name,v)}/>}</TableCell>)}
                                </TableRow>);
                                })}</TableBody>
                            </Table>
                        </Paper>
                    </Box>
                );
            })}
            <ScrollTop>
                <Button variant="contained" color="primary" size="small" sx={{ position: 'fixed', bottom: 64, right: 64 }}>
                    ▲ Scroll to Top
                </Button>
            </ScrollTop>
      </Container>
  );
}