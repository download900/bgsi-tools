import { JSX, useEffect, useRef, useState } from "react";
import { Box, Button, capitalize, Container, Typography } from "@mui/material";
import { Pet, Rarity, PetVariant, CurrencyVariant, Egg, PetData, Category } from "../util/DataUtil";
import * as cheerio from 'cheerio';
const { format, parse } = require('lua-json')

// ---------------------------------------------------------------
//                        Helper Functions
// ---------------------------------------------------------------

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

// ---------------------------------------------------------------
//                          Orchestrator
// ---------------------------------------------------------------

export async function scrapeWiki(data: PetData, debug: (msg: string) => void): Promise<void> {
  debug('Fetching pet data from Lua modules...');
  const ctgLua  = `return ${(await fetchWikitext('Module:Category_Data')).match(/return processData\((\{[\s\S]*?\})\)/)?.[1]}` || '{}';
  const eggsLua = `return ${(await fetchWikitext('Module:Egg_Data')).match(/return processData\((\{[\s\S]*?\})\)/)?.[1]}` || '{}';
  const petsLua = `return ${(await fetchWikitext('Module:Pet_Data')).match(/return processData\((\{[\s\S]*?\})\)/)?.[1]}` || '{}';

  debug('Parsing Lua data...');
  const categoriesData = parse(ctgLua) as any[];
  const eggsData = parse(eggsLua) as { [key: string]: any };
  const petsData = parse(petsLua) as { [key: string]: any };

  debug(`Found ${Object.keys(categoriesData).length} categories, ${Object.keys(petsData).length} pets and ${Object.keys(eggsData).length} eggs in Lua modules.`);

  // Process categories
  debug('Processing categories...');
  const categories: Category[] = [];
  const categoryLookup: { [key: string]: Category } = {};

  function processCategory(catData: any): Category | undefined {
    try {
      if (catData.name === 'Inferno Egg' || catData.name === 'Infinity Egg') {
        return undefined;
      }
      debug(`Processing category: ${catData.name || catData.egg}`);
      const cat: Category = {
        name: catData.name,
        image: catData.image
      } as any;
      if (catData.egg) {
        cat.egg = catData.egg;
      }
      if (catData.pets) {
        cat.pets = catData.pets;
      }
      if (catData.groups) {
        cat.categories = catData.groups.map((subCat: any) => {
          return processCategory(subCat);
        });
      }
      return cat;
    } catch {
      return undefined;
    }
  }

  for (const category of categoriesData) {
    const cat = processCategory(category);
    if (cat) {
      categories.push(cat);
      categoryLookup[cat.name] = cat;
    }
  }
  debug(`Processed ${categories.length} categories.`);

  // Process eggs
  debug('Processing eggs...');
  const eggs: Egg[] = [];
  const eggLookup: { [key: string]: Egg } = {};
  for (const eggName in eggsData) {
    if (eggName === 'Inferno Egg' || eggName === 'Infinity Egg') {
      continue;
    }
    debug(`Processing egg: ${eggName}`);
    const eggInfo = eggsData[eggName];
    const egg: Egg = {
      name: eggName,
      image: eggInfo.image || '',
      pets: eggInfo.pets,
      luckIgnored: eggInfo.luckIgnored || false,
      infinityEgg: eggInfo.infinityEgg || undefined,
      canSpawnAsRift: eggInfo.hasEggRift || false,
      secretBountyRotation: eggInfo.secretBountyRotation || false,
      dateAdded: eggInfo.dateAdded || '',
      dateRemoved: eggInfo.dateUnavailable || '',
    } as any;
    // Add egg to the lookup
    eggs.push(egg);
    eggLookup[eggName] = egg;
  }

  // Process pets
  debug('Processing pets...');
  const pets: Pet[] = [];
  const petLookup: { [key: string]: Pet } = {};
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
      hatchable: petInfo.hatchable !== undefined ? petInfo.hatchable : true,
      obtainedFrom: petInfo.obtainedFrom || '',
      obtainedFromImage: '',
      obtainedFromInfo: petInfo.obtainedFromInfo || '',
      image: [],
      dateAdded: petInfo.dateAdded || '',
      dateRemoved: petInfo.dateUnavailable || '',
    };

    // Add pet to the lookup
    pets.push(pet);
    petLookup[petName] = pet;
  }

  // await Promise.all for getting pet images:
  debug('Fetching pet images...');
  const petImagePromises = pets.map(async (pet) => {
    try {
      return await getPetImages(pet);
    }
    catch (error) {
      debug(`Error fetching images for pet ${pet.name}: ${error}`);
      return pet; // Return the pet without images if there's an error
    }
  }
  );
  await Promise.all(petImagePromises);

  debug(`Processed ${pets.length} pets.`);

  // Add data to the existing PetData structure
  data.categories = categories;
  data.categoryLookup = categoryLookup;
  data.eggs = eggs;
  data.eggLookup = eggLookup;
  data.pets = pets;
  data.petLookup = petLookup;

  debug('Scraping completed successfully.');
}

async function getPetImages(pet: Pet): Promise<Pet> {
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

  variantDataSourceMap.forEach(([ds, _]) => {
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
// ---------------------------------------------------------------
//                      Data Processing
// ---------------------------------------------------------------

const processNewData = (wikiData: PetData, existingData: PetData) => {
  for (const cat of wikiData.categories) {
    processCategory(cat, existingData, wikiData);
  }
  for (const egg of wikiData.eggs) {
    processEgg(egg, existingData, wikiData);
  }
  for (const pet of wikiData.pets) {
    processPet(pet, existingData, wikiData);
  }

  exportDataToJson(existingData);
}

function processCategory(cat: Category, existingData: PetData, newData: PetData) {
  // Check if the category already exists in the existing data
  const existingCat = existingData.categoryLookup[cat.name];
  if (existingCat) {
    // Update existing category properties
    for (const key of Object.keys(cat) as (keyof Category)[]) {
      const value = cat[key];
      if (value != '' && value !== undefined && value !== null) {
        // @ts-ignore
        existingCat[key] = value;
      }
    }
  }
  else {
    // Push the new category to the existing data
    existingData.categories.push(cat);
    existingData.categoryLookup[cat.name] = cat;
  }
}

function processEgg(egg: Egg, existingData: PetData, newData: PetData) {
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
  }
  else {
    // Push the new egg to the existing data
    existingData.eggs.push(egg);
    existingData.eggLookup[egg.name] = egg;
  }
}

function processPet(pet: Pet, existingData: PetData, newData: PetData) {
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
  }
  else {
    // Push the new pet to the existing data
    existingData.pets.push(pet);
    existingData.petLookup[pet.name] = pet;
  }
}

// ---------------------------------------------------------------
//                      Export Functions
// ---------------------------------------------------------------

function exportDataToJson(data: PetData): void {
  saveJSON(data.pets, `pets`);
  saveJSON(data.eggs, `eggs`);
  saveJSON(data.categories, `categories`);
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
    const newData = {} as any as PetData;
    await scrapeWiki(newData, debugLog);
    processNewData(newData, props.data!);
  }

  const handlePetsJsonExport = () => {
    exportDataToJson(props.data!);
  };

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