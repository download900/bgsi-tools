import { JSX, SetStateAction, useEffect, useRef, useState } from "react";

import * as cheerio from 'cheerio';
import { Box, Button, Container, FormControl, Input, Typography } from "@mui/material";

import { Pet, Rarity, PetVariant, CurrencyVariant, Egg, Category, PetData } from "../util/DataUtil";
import Decimal from "decimal.js";
import { data, val } from "cheerio/dist/commonjs/api/attributes";

// (1) Orchestrator
export async function scrapeWiki(data: PetData, debug: (msg: string) => void): Promise<void> {
  debug('Fetching pets...');
  const petList = await fetchCategoryPages('Pets');
  debug(`Found ${petList.length} pets to scrape.`);

  const eggs: Egg[] = [];

  for (const petName of petList) {
    if (petName.includes('Template') || petName.includes('User') || petName === 'Pets') {
      continue; // Skip templates and eggs
    }
    debug(`Scraping ${petName}...`);
    const result = await parsePet(petName);
    if (result) {
      // Check if the pet already exists in the eggs array
      const existingEgg = eggs.find(egg => egg.name === result.obtainedFrom);
      if (existingEgg) {
        existingEgg.pets.push(result);
      } else {
        // Create a new egg entry if it doesn't exist
        const egg = await parseEgg(result.obtainedFrom);
        egg.image = result.obtainedFromImage; // Set the egg image from the pet
        egg.pets.push(result);
        eggs.push(egg);
      }
    }
  }

  debug('Processing scraped data...');
  processEggs(eggs, data);

  debug('Scraping complete!');
}

async function fetchCategoryPages(categoryName: string): Promise<string[]> {
  const api = 
    `https://bgs-infinity.fandom.com/api.php` +
    `?action=query` +
    `&list=categorymembers` +
    `&cmtitle=${encodeURIComponent(`Category:${categoryName}`)}` +
    `&cmlimit=max` + // max is 500, but we can fetch more in batches
    `&format=json` +
    `&origin=*`;

  const res  = await fetch(api);
  const json = await res.json() as any;
  const pages = json.query.categorymembers;

  // Check if we got all pages, if not, fetch more
  if (json.continue) {
    let continueApi = api + `&cmcontinue=${json.continue.cmcontinue}`;
    while (json.continue) {
      const res = await fetch(continueApi);
      const json = await res.json() as any;
      pages.push(...json.query.categorymembers);
      if (json.continue) {
        continueApi = api + `&cmcontinue=${json.continue.cmcontinue}`;
      } else {
        break;
      }
    }
  }

  return pages.map((page: any) => page.title);
}

async function fetchWikitext(pageName: string): Promise<string> {
  try {
    const api = 
      `https://bgs-infinity.fandom.com/api.php` +
      `?action=query` +
      `&prop=revisions` +
      `&rvprop=content` +
      `&format=json` +
      `&titles=${encodeURIComponent(pageName)}` +
      `&origin=*`;

    console.log(`Fetching wikitext for ${pageName} from ${api}`);

    const res  = await fetch(api);
    const json = await res.json() as any;
    console.log(`Received response for ${pageName}:`, json);
    const pages = json.query.pages;
    const pageId = Object.keys(pages)[0];
    return pages[pageId].revisions[0]['*'];         // the raw wikitext
  }
  catch (error) {
    console.error(`Error fetching wikitext for ${pageName}:`, error);
    return '';
  }
}

async function fetchHTML(petName: string): Promise<string> {
    const api =
      `https://bgs-infinity.fandom.com/api.php` +
      `?action=parse` +
      `&page=${encodeURIComponent(petName)}` +
      `&prop=text` +
      `&format=json` +
      `&origin=*`;
    const res  = await fetch(api);
    const json = await res.json() as any;
    if (json.error) {
        console.error(`Error fetching ${petName}: ${json.error}`);
        return '';
    }
    return json.parse.text['*'];  // the HTML fragment you can feed into cheerio.load()
}

async function parseEgg(eggname: string): Promise<Egg> {
  const egg: Egg = {
    name: eggname,
    pets: [],
    dateAdded: '',
    dateRemoved: '',
    luckIgnored: false,
    infinityEgg: '',
    index: '',
    canSpawnAsRift: false,
    secretBountyExcluded: false,
  } as any as Egg;

  const wikitext = await fetchWikitext(eggname);

  if (!wikitext) {
    console.error(`No wikitext found for egg: ${eggname}`);
    return egg; // Return empty egg if no wikitext found
  }

  // Find |limited= yes/no or | limited=yes/no
  const limitedMatch = wikitext.toLowerCase().match(/\|\s*limited\s*=\s*(yes|no|exclusive)/);
  if (limitedMatch) {
    const t = limitedMatch[1].trim();
    egg.limited = t === 'yes' || t === 'exclusive';
  }
  // Find |available= yes/no
  const availableMatch = wikitext.toLowerCase().match(/\|\s*available\s*=\s*(yes|no)/);
  if (availableMatch) {
    egg.available = availableMatch[1].trim() === 'yes';
  }
  else {
    egg.available = true; // Default to true if not specified
  }
  // Find |currency= <>
  const currencyMatch = wikitext.toLowerCase().match(/\|\s*currency\s*=\s*(\w+)/);
  if (currencyMatch) {
    egg.hatchCurrency = currencyMatch[1].trim().toLowerCase() as CurrencyVariant;
  }
  // Find |cost= <number>
  const costMatch = wikitext.toLowerCase().match(/\|\s*cost\s*=\s*([\d.,]+)/);
  if (costMatch) {
    egg.hatchCost = Number(costMatch[1].trim().replaceAll(',', ''));
  }

  // Find |world= <World>
  const worldMatch = wikitext.match(/\|\s*world\s*=\s*([\w\s]+)/);
  if (worldMatch) {
    egg.world = worldMatch[1].trim();
  }
  // Find |zone= <Zone>
  const zoneMatch = wikitext.match(/\|\s*zone\s*=\s*([\w\s]+)/);
  if (zoneMatch) {
    egg.zone = zoneMatch[1].trim();
  }
  
  // Fetch HTML
  const html = await fetchHTML(eggname);
  const $ = cheerio.load(html);

  const updateRelease = $('td[data-source="update-release"]');
  if (updateRelease.length > 0) {
    egg.dateAdded = convertDateToISO(updateRelease.text());
  }
  const updateRemoved = $('td[data-source="update-removed"]');
  if (updateRemoved.length > 0) {
    egg.dateRemoved = convertDateToISO(updateRemoved.text());
  }

  return egg;
}

const convertDateToISO = (dateStr: string): string => {
  // match the date in parentheses
  const dateMatch = dateStr.match(/\(([^)]+)\)/);
  if (dateMatch && dateMatch?.length > 0) {
    // convert April 11th, 2025 to ISO format YYYY-MM-DD
    const date = dateMatch[1].trim();
    const parts = date.split(' ');
    if (parts.length < 3) {
      return ''; // return empty string if date format is unexpected
    }
    
    const monthMap: { [key: string]: string } = {
      'January':   '01',
      'February':  '02',
      'March':     '03',
      'April':     '04',
      'May':       '05',
      'June':      '06',
      'July':      '07',
      'August':    '08',
      'September': '09',
      'October':   '10',
      'November':  '11',
      'December':  '12'
    };
    const month = monthMap[parts[0]]; // e.g. 'April' -> '04'
    const day = parts[1].replace(/[^0-9]/g, '').padStart(2, '0'); // e.g. '11th' -> '11'
    const year = parts[2]; // e.g. '2025'

    return `${year}-${month}-${day}`;
  }
  return ''; // return empty string if no date found
}

// (4) Fetch each pet page and scrape pet and egg info
async function parsePet(petName: string): Promise<Pet> {
  const pet = { name: petName } as Pet;

  const petWikitext = (await fetchWikitext(petName));

  // Find |rarity= <Rarity>
  const rarityMatch = petWikitext.match(/\|\s*rarity\s*=\s*(\w+)/);
  if (rarityMatch) {
    const rarity = rarityMatch[1].trim().toLowerCase();
    // legendaries can have -t2 or -t3 suffixes, so we remove those
    if (rarity.endsWith('-t2') || rarity.endsWith('-t3')) {
      pet.name = pet.name.replace(/-t[23]$/, '');
    }
    pet.rarity = rarity as Rarity;
  } else {
    pet.rarity = 'common';
  }

  // Find |norm-petchance. Can be scientific notation, e.g. 1.23e-4
  const chanceMatch = petWikitext.match(/\|\s*norm-petchance\s*=\s*([\d.e-]+)/);
  if (chanceMatch) {
    const chanceStr = chanceMatch[1].trim();
    pet.chance = new Decimal(chanceStr).toNumber();
  } else {
    pet.chance = 1;
  }

  // Find |bubbles= <number>.<number>
  const bubblesMatch = petWikitext.match(/\|\s*bubbles\s*=\s*([\d.,]+)/);
  if (bubblesMatch) {
    pet.bubbles = Number(bubblesMatch[1].trim().replaceAll(',', ''));
  } else {
    pet.bubbles = 0; 
  }
  
  // Find |gems= <number>.<number>
  const gemsMatch = petWikitext.match(/\|\s*gems\s*=\s*([\d.,]+)/);
  if (gemsMatch) {
    pet.gems = Number(gemsMatch[1].trim().replaceAll(',', ''));
  } else {
    pet.gems = 0;
  }

  // Find |coins=1.1 or | tickets=1.1 or | seashells=1.1
  const currencyMatch = petWikitext.match(/\|\s*(coins|tickets|seashells)\s*=\s*([\d.,]+)/);
  if (currencyMatch) {
    const currencyType = currencyMatch[1].trim().toLowerCase() as CurrencyVariant;
    const currencyValue = Number(currencyMatch[2].trim().replaceAll(',', ''));
    pet.currency = currencyValue;
    pet.currencyVariant = currencyType;
  } else {
    pet.currency = 0;
    pet.currencyVariant = 'coins'; // default to coins
  }

  // Find |has-mythic= yes/no
  const mythicMatch = petWikitext.match(/\|\s*has-mythic\s*=\s*(yes|no)/);
  if (mythicMatch) {
    pet.hasMythic = mythicMatch[1].trim().toLowerCase() === 'yes';
  } else {
    pet.hasMythic = false;
  }

  // Find |limited= yes/no or | limited=yes/no
  const limitedMatch = petWikitext.match(/\|\s*limited\s*=\s*(yes|no|exclusive)/);
  if (limitedMatch) {
    const t = limitedMatch[1].trim().toLowerCase();
    pet.limited = t === 'yes' || t === 'exclusive';
  }
  // Find |available= yes/no
  const availableMatch = petWikitext.match(/\|\s*available\s*=\s*(yes|no)/);
  if (availableMatch) {
    pet.available = availableMatch[1].trim().toLowerCase() === 'yes';
  }
  else {
    pet.available = true; // Default to true if not specified
  }
  // Find |hatchable= yes/no
  const hatchableMatch = petWikitext.match(/\|\s*hatchable\s*=\s*(yes|no)/);
  if (hatchableMatch) {
    pet.hatchable = hatchableMatch[1].trim().toLowerCase() === 'yes';
  }
  else {
    pet.hatchable = true; // Default to true if not specified
  }

  // Find |obtained-from= <egg name>
  const obtainedFromMatch = petWikitext.match(/\|\s*obtained-from\s*=\s*([^|]+)/);
  if (obtainedFromMatch) {
    pet.obtainedFrom = obtainedFromMatch[1].trim();
  }
  // Find |obtained-from-info=<info>
  const obtainedFromInfoMatch = petWikitext.match(/\|\s*obtained-from-info\s*=\s*([^|]+)/);
  if (obtainedFromInfoMatch) {
    pet.obtainedFromInfo = obtainedFromInfoMatch[1].trim();
  }

  // Load HTML to find more info not included in wikitext
  const html = await fetchHTML(petName);
  const $ = cheerio.load(html);

  // Find Tags
  pet.tags = [];
  $('div.pi-item[data-source="tags"] .pi-data-value span').each((_, el) => {
    const tag = $(el).first().text().trim();
    if (tag && !pet.tags.find((t) => t === tag)) pet.tags.push(tag);
  });

  // Obtained-from image
  const obt = $('div.pi-item[data-source="obtained-from"] .pi-data-value');
  const eggImage = obt.find('img').attr('src')?.split('/revision')[0];
  pet.obtainedFromImage = eggImage || '';

  // Get variants and their images
  const variantDataSourceMap: [string, PetVariant][] = [
    ['normal-image', 'Normal'],
    ['shiny-image', 'Shiny'],
    ['mythic-image', 'Mythic'],
    ['shiny-mythic-image', 'Shiny Mythic'],
  ];

  variantDataSourceMap.forEach(([ds, variant]) => {
    const img = $(`figure.pi-item.pi-image[data-source="${ds}"] a.image-thumbnail`);
    if (img.length > 0) {
      const imgSrc = img.attr('href')?.split('/revision')[0];
      if (imgSrc) {
        if (!pet.image) pet.image = [];
        pet.image.push(imgSrc);
      }
    }
  });


  return pet;
}

// (5) This function processes the scraped data. First it updates our current data and saves that,
//     then it saves the remaining new pets to a JSON file.
const processEggs = (wikiData: Egg[], existingData: PetData) => {
  const newData: PetData = {
    categories: [],
    categoryLookup: {},
    eggs: [],
    eggLookup: {},
    pets: [],
    petLookup: {}
  };
  for (const egg of wikiData) {
    processEgg(egg, existingData, newData);
  }

  // Save JSONs
  exportDataToJson(existingData, '-existing');
  if (newData.eggs.length > 0) {
    exportDataToJson(newData, '-new');
  }
}

const processEgg = (egg: Egg, existingData: PetData, newData: PetData) => {
  for (const pet of egg.pets) {
    // Check if the pet already exists in the existing data
    const existingPet = existingData.petLookup[pet.name];
    if (existingPet) {
      // Update existing pet properties
      for (const key of Object.keys(pet) as (keyof Pet)[]) {
        const value = pet[key];
        if (value != '' && value !== undefined && value !== null) {
          // @ts-ignore
          existingPet[key] = value;
        }
      }

      // remove the pet from the egg's pets array if it already exists
      egg.pets = egg.pets.filter(p => p.name !== pet.name);
    }
  }

  // Check if the egg already exists in the existing data
  const existingEgg = existingData.eggLookup[egg.name];
  if (existingEgg) {
    // Update existing egg properties
    for (const key of Object.keys(egg) as (keyof Egg)[]) {
      const value = egg[key];
      if (value != '' && value !== undefined && value !== null) {
        // @ts-ignore
        existingEgg[key] = value;
      }
    }

    existingEgg.pets.push(...egg.pets); // Add new pets to existing egg
    existingEgg.pets.sort((a, b) => { return b.chance - a.chance; });
  }
  else if (egg.pets?.length > 0) {
    newData.eggs.push(egg);
    newData.pets.push(...egg.pets);
    egg.pets.sort((a, b) => { return b.chance - a.chance; });
  } 
}

// ────────────────────────────────────────────────────────────

function exportDataToJson(data: PetData, suffix: string ): void {
  saveJSON(data.pets, `pets${suffix}`);
  const eggsJson = data.eggs.map((egg) => {
    return {
      ...egg,
      pets: egg.pets.map((pet) => pet.name)
    };
  });
  saveJSON(eggsJson, `eggs${suffix}`);
  if (data.categories?.length > 0) {
    const categories = data.categories.map((cat) => {
      return {
        name: cat.name,
        image: cat.image,
        eggs: cat.eggs?.map((egg) => egg.name),
        categories: cat.categories?.map((subCat) => {
          return {
            ...subCat,
            eggs: subCat.eggs?.map((egg) => egg.name)
          }
        })
      };
    });
    saveJSON(categories, `categories${suffix}`);
  }
}

export const saveJSON = (data: any, filename: string) => {
  const blob = new Blob([JSON.stringify(data, undefined, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// ────────────────────────────────────────────────────────────

const capitalizeFirstLetter = (str: string): string => {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : str;
}

export function exportEggsToLua(data: PetData): string {
  let lua = '';
  for (const egg of data.eggs) {
    lua += exportEggToLua(egg);
  }
  return lua;
}

export function exportEggToLua(egg: Egg): string {
  if (!egg.name.includes("Egg"))
    return '';
  //${egg.pets.map((pet) => `"${pet.name}"`).join(', ')}
  let lua = '';
  lua += `  ["${egg.name}"] = {\n`;
  lua += `    name = "${egg.name}",\n`;
  lua += `    pets = { ${egg.pets.map((pet) => `"${pet.name}"`).join(', ')} },\n`;
  lua += `    limited = ${egg.limited === undefined ? false : egg.limited},\n`;
  lua += `    available = ${egg.available === undefined ? true : egg.available},\n`;
  lua += `    dateAdded = "${egg.dateAdded === undefined ? '????-??-??' : egg.dateAdded}",\n`;
  egg.dateRemoved      && (lua += `    dateRemoved = "${egg.dateRemoved}",\n`);
  egg.hatchCost        && (lua += `    hatchCost = ${egg.hatchCost},\n`);
  egg.hatchCost        && (lua += `    hatchCurrency = "${capitalizeFirstLetter(egg.hatchCurrency)}",\n`);
  egg.world            && (lua += `    world = "${egg.world || ''}",\n`);
  egg.zone             && (lua += `    zone = "${egg.zone || ''}",\n`);
  egg.luckIgnored      && (lua += `    luckIgnored = ${egg.luckIgnored},\n`);
  egg.canSpawnAsRift   && (lua += `    hasEggRift = ${egg.canSpawnAsRift === undefined ? false : egg.canSpawnAsRift},\n`);
  const secretBountyRotation = egg.secretBountyExcluded === undefined ? egg.canSpawnAsRift === undefined ? false : egg.canSpawnAsRift : !egg.secretBountyExcluded;
  secretBountyRotation && (lua += `    secretBountyRotation = ${secretBountyRotation},\n`);
  egg.infinityEgg      && (lua += `    infinityEgg = "${egg.infinityEgg}",\n`);
  lua += `  },\n`;
  return lua;
}

export function exportPetsToLua(data: PetData): string {
  let lua = '';
  for (const egg of data.eggs) {
    lua += `\n-- ${egg.name}\n`;
    const pets = [];
    for (const pet of egg.pets) {
      pets.push(exportPetToLua(pet, egg));
    }
    lua += pets.join(',\n') + ',\n';
  }

  return lua;
}

const exportPetToLua = (pet: Pet, egg: Egg): string => {
  let lua = "";
  lua += `  ["${pet.name}"] = {\n`;
  lua += `    name = "${pet.name}",\n`;
  lua += `    rarity = "${capitalizeFirstLetter(pet.rarity)}",\n`;
  lua += `    chance = ${pet.hatchable ? pet.chance : '100'},\n`;
  lua += `    hatchable = ${pet.hatchable == undefined ? true : pet.hatchable},\n`;
  lua += `    hasMythic = ${pet.hasMythic == undefined ? false : pet.hasMythic},\n`;
  lua += `    bubbles = ${pet.bubbles},\n`;
  lua += `    gems = ${pet.gems},\n`;
  lua += `    currency = ${pet.currency},\n`;
  lua += `    currencyType = "${capitalizeFirstLetter(pet.currencyVariant)}",\n`;
  lua += `    limited = ${pet.limited == undefined ? false : pet.limited},\n`;
  lua += `    available = ${pet.limited == undefined ? true : pet.limited ? pet.available : true},\n`;
  lua += `    dateAdded = "${pet.dateAdded || egg.dateAdded}",\n`;
  const dateRemoved = pet.dateRemoved || egg.dateRemoved;
  dateRemoved && (lua += `    dateRemoved = "${dateRemoved}",\n`);
  pet.obtainedFrom === 'Robux Shop' && (lua += `    exclusive = true,\n`);
  pet.tags && pet.tags.length > 0 && (lua += `    tag = "${pet.tags?.join(', ')}",\n`);
  lua += `    obtainedFrom = "${pet.obtainedFrom}",\n`;
  pet.obtainedFromInfo && (lua += `    obtainedFromInfo = "${pet.obtainedFromInfo}",\n`);
  lua += '  }'
  return lua;
}

// ────────────────────────────────────────────────────────────

export interface WikiToolsProps {
  data: PetData | undefined;
}

export function WikiTools(props: WikiToolsProps): JSX.Element {
  const [debug, setDebug] = useState<string[]>([ 'Ready to scrape...' ]); 
  const preRef = useRef<HTMLPreElement>(null);
  
  const debugLog = (msg: string) => {
    setDebug((prev) => {
      const newDebug = [...prev, msg];
      return newDebug;
    });
  }

  const handleScrape = () => {
    setDebug([ 'Scraping...' ]);
    scrapeWiki(props.data!, debugLog);
  }

  const handlePetsLuaExport = () => {
    const lua = exportPetsToLua(props.data!);
    exportLuaToFile(lua, 'Pet_Data');
  }

  const handleEggsLuaExport = () => {
    const lua = exportEggsToLua(props.data!);
    exportLuaToFile(lua, 'Egg_Data');
  }

  const handlePetsJsonExport = () => {
    exportDataToJson(props.data!, '');
  };

  const exportLuaToFile = (lua: string, filename: string) => {
    const blob = new Blob([lua], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.lua`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  useEffect(() => {
    const pre = preRef.current;
    if (pre) {
      pre.scrollTop = pre.scrollHeight;
    }
  }, [debug]);


  return (
    <Container sx={{ mt: 4, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'middle', maxWidth: '600px' }}>
      <Typography variant="h4" sx={{ mb: 2, mt: 2 }}>Wiki Scraper</Typography>
      <Button
        variant="contained"
        onClick={handleScrape}
        sx={{ mb: 2 }}
        style={{ maxWidth: '200px' }}
      >
        Scrape Pet Pages
      </Button>
      <pre ref={preRef} style={{ maxHeight: '400px', overflowY: 'auto', width: '100%', backgroundColor: '#333', color: '#fff', padding: '10px', borderRadius: '5px' }}>
        <code style={{ whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}>
          {debug.map((line, index) => (
            <div key={index}>{line}</div>
          ))}
        </code>
      </pre>
      <Typography variant="h4" sx={{ mb: 2 }}>Lua Data Export</Typography>
      <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', mb: 2 }}>
        <Button
          variant="contained"
          onClick={handlePetsLuaExport}
          sx={{ mr: 2, maxWidth: '300px' }}
        >
          Export Pet_Data.lua
        </Button>
        <Button
          variant="contained"
          onClick={handleEggsLuaExport}
          sx={{ mr: 2, maxWidth: '300px' }}
        >
          Export Egg_Data.lua
        </Button>
      </Box>
      <Typography variant="h4" sx={{ mb: 2 }}>JSON Data Export</Typography>
      <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', mb: 2 }}>
        <Button
          variant="contained"
          onClick={() => handlePetsJsonExport}
          sx={{ mr: 2, maxWidth: '300px' }}
        >
          Export JSON Data
        </Button>
      </Box>
    </Container>
  );
}