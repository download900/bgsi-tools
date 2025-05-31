import { JSX, SetStateAction, useEffect, useRef, useState } from "react";

import * as cheerio from 'cheerio';
import { Box, Button, Container, FormControl, Input, Typography } from "@mui/material";

import { Pet, Rarity, PetVariant, CurrencyVariant, Egg, Category } from "../util/DataUtil";
import Decimal from "decimal.js";

// (1) Orchestrator
export async function scrapeWiki(data: Category[], debug: (msg: string) => void): Promise<void> {
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

async function parseEgg(eggname: string): Promise<Egg> {
  const egg: Egg = {
    name: eggname,
    pets: [],
    // dateAdded: '',
    // dateRemoved: '',
    luckIgnored: false,
    infinityEgg: '',
    index: '',
    canSpawnAsRift: false,
    secretBountyExcluded: false,
  } as any as Egg;

  const wikitext = (await fetchWikitext(eggname)).toLowerCase();

  if (!wikitext) {
    console.error(`No wikitext found for egg: ${eggname}`);
    return egg; // Return empty egg if no wikitext found
  }

  // Find |limited= yes/no or | limited=yes/no
  const limitedMatch = wikitext.match(/\|\s*limited\s*=\s*(yes|no|exclusive)/);
  if (limitedMatch) {
    const t = limitedMatch[1].trim();
    egg.limited = t === 'yes' || t === 'exclusive';
  }
  // Find |available= yes/no
  const availableMatch = wikitext.match(/\|\s*available\s*=\s*(yes|no)/);
  if (availableMatch) {
    egg.available = availableMatch[1].trim() === 'yes';
  }
  else {
    egg.available = true; // Default to true if not specified
  }
  // Find |currency= <>
  const currencyMatch = wikitext.match(/\|\s*currency\s*=\s*(\w+)/);
  if (currencyMatch) {
    egg.hatchCurrency = currencyMatch[1].trim().toLowerCase() as CurrencyVariant;
  }
  // Find |cost= <number>
  const costMatch = wikitext.match(/\|\s*cost\s*=\s*([\d.,]+)/);
  if (costMatch) {
    egg.hatchCost = Number(costMatch[1].trim().replaceAll(',', ''));
  }
  
  // // Fetch HTML
  // const html = await fetchHTML(eggname);
  // const $ = cheerio.load(html);

  // const updateRelease = $('td.pi-horizontal-group-item[data-source="update-release"] pi-data-value a');
  // if (updateRelease.length > 0) {
  //   egg.dateAdded = convertDateToISO(updateRelease.text());
  // }
  // const updateRemoved = $('td.pi-horizontal-group-item[data-source="update-removed"] pi-data-value a');
  // if (updateRemoved.length > 0) {
  //   egg.dateRemoved = convertDateToISO(updateRemoved.text());
  // }

  return egg;
}

// const convertDateToISO = (dateStr: string): string => {
//   // match the date in parentheses
//   const dateMatch = dateStr.match(/\(([^)]+)\)/);
//   if (dateMatch) {
//     // convert to YYYY-MM-DD format
//     const dateParts = dateMatch[1].split(',')[0].trim().split(' ');
//     const monthMap: { [key: string]: string } = {
//       'January':   '01',
//       'February':  '02',
//       'March':     '03',
//       'April':     '04',
//       'May':       '05',
//       'June':      '06',
//       'July':      '07',
//       'August':    '08',
//       'September': '09',
//       'October':   '10',
//       'November':  '11',
//       'December':  '12'
//     };
//     const month = monthMap[dateParts[0]];
//     const day = dateParts[1].padStart(2, '0'); // pad with zero if single digit
//     const year = dateParts[2];
//     return `${year}-${month}-${day}`;
//   }
//   return ''; // return empty string if no date found
// }

// (4) Fetch each pet page and scrape pet and egg info
async function parsePet(petName: string): Promise<Pet> {
  const pet = { name: petName } as Pet;

  const petWikitext = (await fetchWikitext(petName)).toLowerCase();

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
    pet.hasMythic = mythicMatch[1].trim() === 'yes';
  } else {
    pet.hasMythic = false;
  }

  // Find |limited= yes/no or | limited=yes/no
  const limitedMatch = petWikitext.match(/\|\s*limited\s*=\s*(yes|no|exclusive)/);
  if (limitedMatch) {
    const t = limitedMatch[1].trim();
    pet.limited = t === 'yes' || t === 'exclusive';
  }
  // Find |available= yes/no
  const availableMatch = petWikitext.match(/\|\s*available\s*=\s*(yes|no)/);
  if (availableMatch) {
    pet.available = availableMatch[1].trim() === 'yes';
  }
  else {
    pet.available = true; // Default to true if not specified
  }
  // Find |hatchable= yes/no
  const hatchableMatch = petWikitext.match(/\|\s*hatchable\s*=\s*(yes|no)/);
  if (hatchableMatch) {
    pet.hatchable = hatchableMatch[1].trim() === 'yes';
  }
  else {
    pet.hatchable = true; // Default to true if not specified
  }
  const html = await fetchHTML(petName);
  const $ = cheerio.load(html);

  // Find Tags
  pet.tags = [];
  $('div.pi-item[data-source="tags"] .pi-data-value span').each((_, el) => {
    const tag = $(el).first().text().trim();
    if (tag && !pet.tags.find((t) => t === tag)) pet.tags.push(tag);
  });

  // Obtained-from → eggName
  const obt = $('div.pi-item[data-source="obtained-from"] .pi-data-value');
  const eggImage = obt.find('img').attr('src')?.split('/revision')[0];
  pet.obtainedFromImage = eggImage || '';
  const eggName = obt.first().text().trim();
  pet.obtainedFrom = eggName || 'Unknown';

  // Get variants and their images
  const variantDataSourceMap: [string, PetVariant][] = [
    ['normal-image', 'Normal'],
    ['shiny-image', 'Shiny'],
    ['mythic-image', 'Mythic'],
    ['shiny-mythic-image', 'Shiny Mythic'],
  ];

  const petVariants: [string, string][] = []; // PetVariant, image url

  variantDataSourceMap.forEach(([ds, variant]) => {
    const img = $(`figure.pi-item.pi-image[data-source="${ds}"] a.image-thumbnail`);
    if (img.length > 0) {
      const imgSrc = img.attr('href')?.split('/revision')[0];
      if (imgSrc) petVariants.push([variant, imgSrc]);
    }
  });


  return pet;
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

// (5) This function processes the scraped data. First it updates our current data and saves that,
//     then it saves the remaining new pets to a JSON file.
const processEggs = (wikiData: Egg[], existingData: Category[]) => {
  const newPets: Egg[] = [];
  for (const egg of wikiData) {
    processEgg(egg, existingData, newPets);
  }

  // Save JSONs
  saveJSON(existingData, 'pets');
  if (newPets.length > 0) {
    saveJSON(newPets, 'new_pets');
  }
}

const processEgg = (egg: Egg, existingData: Category[], newPets: Egg[]) => {
  for (const pet of egg.pets) {
    // Check if the pet already exists in the existing data
    const existingPet = findExistingPet(pet.name, existingData);
    if (existingPet) {
      // Update existing pet properties
      existingPet.chance = pet.chance;
      existingPet.rarity = pet.rarity;
      existingPet.bubbles = pet.bubbles;
      existingPet.currency = pet.currency;
      existingPet.currencyVariant = pet.currencyVariant;
      existingPet.gems = pet.gems;
      existingPet.hasMythic = pet.hasMythic;
      existingPet.tags = pet.tags || [];
      existingPet.limited = pet.limited;
      existingPet.available = pet.available;
      existingPet.hatchable = pet.hatchable;
      existingPet.obtainedFrom = pet.obtainedFrom;
      existingPet.obtainedFromImage = pet.obtainedFromImage;

      // remove the pet from the egg's pets array if it already exists
      egg.pets = egg.pets.filter(p => p.name !== pet.name);
    }
  }

  // Check if the egg already exists in the existing data
  const existingEgg = findExistingEgg(egg.name, existingData);
  if (existingEgg) {
    // Update existing egg properties
    existingEgg.hatchCost = egg.hatchCost;
    existingEgg.hatchCurrency = egg.hatchCurrency;
    existingEgg.limited = egg.limited;
    existingEgg.available = egg.available;
  }
  else if (egg.pets?.length > 0) {
    newPets.push(egg);
  } 
}

const findExistingEgg = (eggName: string, data: Category[]): Egg | undefined => {
  for (const category of data) {
    const egg = category.eggs?.find(e => e.name === eggName);
    if (egg) return egg;
    for (const subCategory of category.categories || []) {
      const subEgg = subCategory.eggs.find(e => e.name === eggName);
      if (subEgg) return subEgg;
    }
  }
  return undefined;
}

const findExistingPet = (petName: string, data: Category[]): Pet | undefined => {
  for (const category of data) {
    for (const egg of category.eggs || []) {
      const pet = egg.pets.find(p => p.name === petName);
      if (pet) return pet;
    }
    for (const subCategory of category.categories || []) {
      for (const egg of subCategory.eggs || []) {
        const pet = egg.pets.find(p => p.name === petName);
        if (pet) return pet;
      }
    }
  }
  return undefined;
}

const saveJSON = (data: any, filename: string) => {
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
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function exportEggsToLua(data: Category[]): string {
  let lua = '';
  for (const cat of data) {
    lua += `\n-- ${cat.name}\n`;
    for (const egg of cat.eggs || []) {
      lua += exportEggToLua(egg);
    }
    for (const subCat of cat.categories || []) {
      lua += `\n-- ${subCat.name}\n`;
      for (const egg of subCat.eggs || []) {
        lua += exportEggToLua(egg);
      }
    }
  }
  return lua;
}

export function exportEggToLua(egg: Egg): string {
  if (!egg.name.includes("Egg"))
    return '';
  //${egg.pets.map((pet) => `"${pet.name}"`).join(', ')}
  let lua = '';
  lua += `  ["${egg.name}"] = {\n`;
  lua += `    Name = "${egg.name}",\n`;
  lua += `    Pets = { ${egg.pets.map((pet) => `"${pet.name}"`).join(', ')} },\n`;
  egg.hatchCost             && (lua += `    HatchCost = ${egg.hatchCost},\n`);
  egg.hatchCurrency         && (lua += `    HatchCurrency = "${capitalizeFirstLetter(egg.hatchCurrency)}",\n`);
  egg.limited               && (lua += `    Limited = ${egg.limited ? '"yes"' : '"no"'},\n`);
  egg.limited               && (lua += `    Available = ${egg.available ? '"yes"' : '"no"'},\n`);
  egg.luckIgnored           && (lua += `    LuckIgnored = ${egg.luckIgnored ? '"yes"' : '"no"'},\n`);
  egg.canSpawnAsRift        && (lua += `    CanSpawnAsRift = ${egg.canSpawnAsRift ? '"yes"' : '"no"'},\n`);
  !egg.secretBountyExcluded && egg.canSpawnAsRift && (lua += `    CanHaveSecretBounty = ${!egg.secretBountyExcluded ? '"yes"' : '"no"'},\n`);
  egg.infinityEgg           && (lua += `    InfinityEgg = "${egg.infinityEgg}",\n`);
  lua += `  },\n`;
  return lua;
}

export function exportPetsToLua(data: Category[]): string {
  let lua = '';
  for (const cat of data) {
    for (const egg of cat.eggs || []) {
      lua += `\n-- ${egg.name}\n`;
      const pets = [];
      for (const pet of egg.pets) {
        pets.push(exportPetToLua(pet));
      }
      lua += pets.join(',\n') + ',\n';
    }
    for (const subCat of cat.categories || []) {
      for (const egg of subCat.eggs || []) {
        lua += `\n-- ${egg.name}\n`;
        const pets = [];
        for (const pet of egg.pets) {
          pets.push(exportPetToLua(pet));
        }
        lua += pets.join(',\n') + ',\n';
      }
    }
  }

  return lua;
}

const exportPetToLua = (pet: Pet): string => {
  let lua = "";
  lua += `  ["${pet.name}"] = {\n`;
  lua += `    Name = "${pet.name}",\n`;
  lua += `    Rarity = "${capitalizeFirstLetter(pet.rarity)}",\n`;
  lua += `    Chance = ${pet.chance},\n`;
  lua += `    Bubbles = ${pet.bubbles},\n`;
  lua += `    Currency = ${pet.currency},\n`;
  lua += `    CurrencyType = "${capitalizeFirstLetter(pet.currencyVariant)}",\n`;
  lua += `    Gems = ${pet.gems},\n`;
  lua += `    Mythic = ${pet.hasMythic ? '"yes"' : '"no"'},\n`;
  lua += `    Hatchable = ${pet.hatchable ? '"yes"' : '"no"'},\n`;
  lua += `    Source = "${pet.obtainedFrom}",\n`;
  pet.tags?.length > 0 && (lua += `    Tag = "${pet.tags.join(', ')}",\n`);
  pet.limited && (lua += `    Limited = ${pet.limited && pet.obtainedFrom === "Robux Shop" ? '"exclusive"' : '"yes"'},\n`);
  pet.limited && (lua += `    Available = ${pet.available ? '"yes"' : '"no"'},\n`);
  lua += '  }'
  return lua;
}

// ────────────────────────────────────────────────────────────

export interface WikiToolsProps {
    data: Category[];
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
    scrapeWiki(props.data, debugLog);
  }

  const handlePetsLuaExport = () => {
    const lua = exportPetsToLua(props.data);
    exportLuaToFile(lua, 'Pet_Data');
  }

  const handleEggsLuaExport = () => {
    const lua = exportEggsToLua(props.data);
    exportLuaToFile(lua, 'Egg_Data');
  }

  const handlePetsJsonExport = () => {
    saveJSON(props.data, 'pets');
  }

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
      <Typography variant="h4" sx={{ mb: 2 }}>Data Export</Typography>
      <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
        <Button
          variant="contained"
          onClick={handlePetsLuaExport}
          sx={{ mr: 2, maxWidth: '300px' }}
        >
          Export Pet_Data.lua
        </Button>
        <Button
          variant="contained"
          onClick={() => handlePetsJsonExport}
          sx={{ mr: 2, maxWidth: '300px' }}
        >
          Export pets.JSON
        </Button>
      <Button
        variant="contained"
        onClick={handleEggsLuaExport}
        sx={{ mr: 2, maxWidth: '300px' }}
      >
        Export Egg_Data.LUA
      </Button>
      </Box>
    </Container>
  );
}