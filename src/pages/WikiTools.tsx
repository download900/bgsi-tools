import { JSX, useEffect, useRef, useState } from "react";
import { Box, Button, capitalize, Container, Typography } from "@mui/material";
import { Pet, Rarity, PetVariant, CurrencyVariant, Egg, PetData } from "../util/DataUtil";
import Decimal from "decimal.js";
import * as cheerio from 'cheerio';
const { format, parse } = require('lua-json')


// New scraper: Items

export async function scrapeItems(debug: (msg: string) => void): Promise<void> {
  debug('Fetching item data from Lua modules...');
  // Fetch "Category:Items" pages
  const itemPages = await fetchCategoryPages('Category:Items');
  debug(`Found ${itemPages.length} item pages.`);
  const items: { [key: string]: any } = {};
  for (const page of itemPages) {
    const item: any = {
      name: page,
      description: '',
      type: '',
      rarity: 'Common',
      effects: '',
      duration: '',
    };
    debug('Fetching HTML for item: ' + page);
    const html = await fetchHTML(page);
    const $ = cheerio.load(html);
    // Extract item properties from HTML

    const descriptionMatch = $('figure.pi-item.pi-image[data-source="item-image"] figcaption.pi-caption').text().trim();
    if (descriptionMatch) {
      item.description = descriptionMatch;
    }

    const typeMatch = $('div.pi-item.pi-data.pi-item-spacing.pi-border-color[data-source="type"] .pi-data-value span').text().trim();
    if (typeMatch) {
      item.type = typeMatch;
    }

    const rarityMatch = $('div.pi-item.pi-data.pi-item-spacing.pi-border-color[data-source="rarity"] .pi-data-value span').text().trim();
    if (rarityMatch) {
      item.rarity = rarityMatch;
    }

    const durationMatch = $('div.pi-item.pi-data.pi-item-spacing.pi-border-color[data-source="duration"] .pi-data-value').text().trim();
    if (durationMatch) {
      // Convert "23 minutes" to seconds
      const durationParts = durationMatch.split(' ');
      const durationValue = parseInt(durationParts[0]);
      const durationUnit = durationParts[1];
      if (durationUnit === 'minutes') {
        item.duration = durationValue * 60;
      } else if (durationUnit === 'seconds') {
        item.duration = durationValue;
      }
    }

    items[item.name] = item;
  }

  // export to Lua
  let lua = 'return {\n';
  for (const itemName in items) {
    const item = items[itemName];
    lua += `  ["${itemName}"] = {\n`;
    lua += `    description = "${item.description}",\n`;
    lua += `    type = "${item.type}",\n`;
    lua += `    rarity = "${item.rarity}",\n`;
    lua += `    effects = "${item.effects}",\n`;
    lua += `    duration = "${item.duration}",\n`;
    lua += '  },\n';
  }
  lua += '}\n';
  debug('Exporting item data to Lua file...');
  const blob = new Blob([lua], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'item_data.lua';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  debug('Item data exported successfully.');
}


// ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

function isAvailable(dateRemoved: string | undefined): boolean {
  if (!dateRemoved) return true; // If no dateRemoved, pet is available
  // Date format is YYYY-MM-DD, so we clear time components for a proper comparison
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const removedDate = new Date(dateRemoved);
  removedDate.setHours(0, 0, 0, 0);
  return removedDate > today; // If removed date is in the future, pet is available
}

// (1) Orchestrator
export async function scrapeWiki(data: PetData, debug: (msg: string) => void): Promise<void> {
  debug('Fetching pet data from Lua modules...');
  // Result will be a function, and then "return processData({ <MATCH ALL OF THIS> })"
  const petsLua = `return ${(await fetchWikitext('Module:Pet_Data')).match(/return processData\((\{[\s\S]*?\})\)/)?.[1]}` || '{}';
  const eggsLua = `return ${(await fetchWikitext('Module:Egg_Data')).match(/return processData\((\{[\s\S]*?\})\)/)?.[1]}` || '{}';
  debug('Parsing Lua data...');
  const petsData = parse(petsLua) as { [key: string]: any };
  const eggsData = parse(eggsLua) as { [key: string]: any };
  debug(`Found ${Object.keys(petsData).length} pets and ${Object.keys(eggsData).length} eggs in Lua modules.`);

  // Convert Lua data to our PetData structure
  const pets: Pet[] = [];
  const petLookup: { [key: string]: Pet } = {};
  const eggs: Egg[] = [];
  const eggLookup: { [key: string]: Egg } = {};

  for (const petName in petsData) {
    debug(`Processing pet: ${petName}`);
    const petInfo = petsData[petName];
    let pet: Pet = {
      name: petName,
      rarity: petInfo.rarity.toLowerCase() as Rarity,
      chance: petInfo.chance,
      bubbles: petInfo.bubbles || 0,
      gems: petInfo.gems || 0,
      currency: petInfo.currency || 0,
      currencyVariant: (petInfo.currencyType || 'coins').toLowerCase() as CurrencyVariant,
      hasMythic: petInfo.hasMythic || false,
      tags: petInfo.tag ? petInfo.tag.split(',').map((tag: string) => tag.trim()) : [],
      limited: petInfo.limited || false,
      available: isAvailable(petInfo.dateUnavailable),
      hatchable: petInfo.hatchable !== undefined ? petInfo.hatchable : true,
      obtainedFrom: petInfo.obtainedFrom || '',
      obtainedFromImage: '',
      obtainedFromInfo: petInfo.obtainedFromInfo || '',
      image: [],
      dateAdded: petInfo.dateAdded || '',
      dateRemoved: petInfo.dateUnavailable || '',
    };

    pet = await parsePet(pet); // Fetch additional info from the pet page

    // add obtainedFrom as new Egg property
    if (eggLookup[pet.obtainedFrom]) {
      const egg = eggLookup[pet.obtainedFrom];
      egg.pets.push(pet);
    }
    else {
      // If the egg doesn't exist, create a new one
      const egg = {
        name: pet.obtainedFrom,
        image: pet.obtainedFromImage || '',
        pets: [pet],
      } as Egg;
      eggs.push(egg);
      eggLookup[pet.obtainedFrom] = egg;
    }

    pets.push(pet);
    petLookup[petName] = pet;
  }

  debug(`Parsed ${pets.length} pets from Lua modules.`);

  // Convert eggs data to our Egg structure
  for (const eggName in eggsData) {
    debug(`Processing egg: ${eggName}`);
    const eggInfo = eggsData[eggName];
    const egg = eggLookup[eggName];
    if (!egg) {
      debug(`Egg ${eggName} not found in pet data. Skipping...`);
      continue; // Skip if egg is not found
    }
    // Update egg properties from eggInfo
    egg.name = eggName;
    egg.pets.sort((a, b) => { return b.chance - a.chance; });
    egg.hatchCost = eggInfo.hatchCost || 0;
    egg.hatchCurrency = (eggInfo.hatchCurrency?.toLowerCase() as CurrencyVariant) || undefined;
    egg.world = eggInfo.world || '';
    egg.zone = eggInfo.zone || '';
    egg.limited = eggInfo.limited || false;
    egg.available = isAvailable(eggInfo.dateUnavailable);
    egg.luckIgnored = eggInfo.luckIgnored || false;
    egg.infinityEgg = eggInfo.infinityEgg || '';
    egg.canSpawnAsRift = eggInfo.hasEggRift || false;
    egg.secretBountyRotation = eggInfo.secretBountyRotation || false;
    egg.dateAdded = eggInfo.dateAdded || '';
    egg.dateRemoved = eggInfo.dateUnavailable || '';
    egg.riftChance = eggInfo.riftChance || 0; // Default to 0, can be updated later
  }

  debug(`Parsed ${eggs.length} eggs from Lua modules.`);

  // Add data to the existing PetData structure
  data.pets = pets;
  data.petLookup = petLookup;
  data.eggs = eggs;
  data.eggLookup = eggLookup;
}

async function fetchCategoryPages(categoryName: string, continueToken?: string): Promise<string[]> {
  try {
    const api =
      `https://bgs-infinity.fandom.com/api.php` +
      `?action=query` +
      `&list=categorymembers` +
      `&cmtitle=${encodeURIComponent(categoryName)}` +
      `&cmlimit=max` +
      `&format=json` +
      `&origin=*` +
      (continueToken ? `&cmcontinue=${encodeURIComponent(continueToken)}` : '');

    const res = await fetch(api);
    const json = await res.json() as any;
    const pages = json.query.categorymembers;
    // Limit is 500, check if there are more pages
    if (json.continue) {
      const morePages = await fetchCategoryPages(categoryName, json.continue);
      pages.push(...morePages);
    }
    return pages.map((page: any) => page.title);
  } catch (error) {
    console.error(`Error fetching category pages for ${categoryName}:`, error);
    return [];
  }
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

// (4) Fetch each pet page and scrape pet and egg info
async function parsePet(pet: Pet): Promise<Pet> {
  const petName = pet.name;

  // Load HTML to find more info not included in wikitext
  const html = await fetchHTML(petName);
  const $ = cheerio.load(html);

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
const processEggs = (wikiData: PetData, existingData: PetData) => {

  for (const egg of wikiData.eggs) {
    processEgg(egg, existingData, wikiData);
  }

  // Save JSONs
  exportDataToJson(existingData, '');
  if (wikiData.eggs.length > 0) {
    exportDataToJson(wikiData, '-new');
  }
}

const processEgg = (egg: Egg, existingData: PetData, newData: PetData) => {
  for (const newPet of egg.pets) {
    // Check if the pet already exists in the existing data
    const existingPet = existingData.petLookup[newPet.name];
    if (existingPet) {
      // Update existing pet properties
      for (const key of Object.keys(newPet) as (keyof Pet)[]) {
        const value = newPet[key];
        if (value != '' && value !== undefined && value !== null) {
          // @ts-ignore
          existingPet[key] = value;
        }
      }
      existingPet.available = existingPet.available && isAvailable(newPet.dateRemoved);

      // remove the pet from the pets arrays if it already exists
      egg.pets = egg.pets.filter(p => p.name !== newPet.name);
      newData.pets = newData.pets.filter(p => p.name !== newPet.name);
    }
  }

  // Check if the egg already exists in the existing data
  const existingEgg = existingData.eggLookup[egg.name];
  if (existingEgg) {
    // Update existing egg properties
    for (const key of Object.keys(egg) as (keyof Egg)[]) {
      if (key == 'pets') continue; // Skip pets, they are handled separately
      if (key == 'available') continue; // Skip available, it is handled separately
      const value = egg[key];
      if (value != '' && value !== undefined && value !== null) {
        // @ts-ignore
        existingEgg[key] = value;
      }
    }

    existingEgg.available = existingEgg.available && isAvailable(egg.dateRemoved);
    existingEgg.pets.push(...egg.pets); // Add new pets to existing egg
    existingEgg.pets.sort((a, b) => { return b.chance - a.chance; });

    // remove the egg from the eggs array if it already exists
    newData.eggs = newData.eggs.filter(e => e.name !== egg.name);
  }
  else if (egg.pets.length === 0) {
    newData.eggs = newData.eggs.filter(e => e.name !== egg.name);
    return;
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
  lua += `    pets = { ${egg.pets.map((pet) => `"${pet.name}"`).join(', ')} },\n`;
  egg.limited          && (lua += `    limited = true,\n`);
  egg.limited          && (lua += `    available = ${egg.available},\n`);
  lua += `    dateAdded = "${egg.dateAdded === undefined ? '????-??-??' : egg.dateAdded}",\n`;
  egg.dateRemoved      && (lua += `    dateUnavailable = "${egg.dateRemoved}",\n`);
  egg.hatchCost        && (lua += `    hatchCost = ${egg.hatchCost},\n`);
  egg.hatchCost        && (lua += `    hatchCurrency = "${capitalizeFirstLetter(egg.hatchCurrency)}",\n`);
  egg.world            && (lua += `    world = "${egg.world || ''}",\n`);
  egg.zone             && (lua += `    zone = "${egg.zone || ''}",\n`);
  egg.luckIgnored      && (lua += `    luckIgnored = ${egg.luckIgnored},\n`);
  egg.canSpawnAsRift   && (lua += `    hasEggRift = ${egg.canSpawnAsRift === undefined ? false : egg.canSpawnAsRift},\n`);
  egg.secretBountyRotation && (lua += `    secretBountyRotation = ${egg.secretBountyRotation},\n`);
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
  lua += `    rarity = "${capitalizeFirstLetter(pet.rarity)}",\n`;
  lua += `    chance = ${pet.hatchable ? pet.chance : '100'},\n`;
  lua += `    hatchable = ${pet.hatchable == undefined ? true : pet.hatchable},\n`;
  lua += `    hasMythic = ${pet.hasMythic == undefined ? false : pet.hasMythic},\n`;
  lua += `    bubbles = ${pet.bubbles},\n`;
  lua += `    gems = ${pet.gems},\n`;
  lua += `    currency = ${pet.currency},\n`;
  lua += `    currencyType = "${capitalizeFirstLetter(pet.currencyVariant)}",\n`;
  pet.limited && (lua += `    limited = true,\n`);
  pet.limited && (lua += `    available = ${pet.available},\n`);
  lua += `    dateAdded = "${pet.dateAdded || egg.dateAdded}",\n`;
  const dateRemoved = pet.dateRemoved || egg.dateRemoved;
  dateRemoved && (lua += `    dateUnavailable = "${dateRemoved}",\n`);
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

  const handleScrape = async () => {
    setDebug([ 'Scraping...' ]);
    const newData = {
      pets: [],
      petLookup: {},
      eggs: [],
      eggLookup: {},
      categories: [],
    } as any as PetData;
    await scrapeWiki(newData, debugLog);
    processEggs(newData, props.data!);
  }

  const handleScrapeItems = async () => {
    setDebug([ 'Scraping items...' ]);
    await scrapeItems(debugLog);
    setDebug((prev) => [...prev, 'Item data scraped and exported to item_data.lua']);
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
      <Button
        variant="contained"
        onClick={handleScrapeItems}
        sx={{ mb: 2 }}
        style={{ maxWidth: '200px' }}
      >
        Scrape Item Pages
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