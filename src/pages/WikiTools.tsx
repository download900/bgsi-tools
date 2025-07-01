import { JSX, useEffect, useRef, useState } from "react";
import { Box, Button, capitalize, Container, Typography } from "@mui/material";
import { Pet, Rarity, PetVariant, CurrencyVariant, Egg, PetData, Category } from "../util/DataUtil";
import * as cheerio from 'cheerio';
import categoriesJson from "../data/categories.json";
import eggsJson from "../data/eggs.json";
import petsJson from "../data/pets.json";

const { format, parse } = require('lua-json')

function loadData(): any {
  // load pets
  const petLookup: { [key: string]: Pet } = {};
  const pets: Pet[] = [];
  (petsJson as unknown as any).forEach((pet: any) => {
    petLookup[pet.name] = pet;
    pets.push(pet);
  });
  // load eggs
  const eggLookup: { [key: string]: Egg } = {};
  const eggs: Egg[] = [];
  (eggsJson as unknown as any).forEach((egg: any) => {
    eggLookup[egg.name] = egg;
    eggs.push(egg);
  });
  // load categories
  const categoryLookup: { [key: string]: Category } = {};
  const categories: Category[] = [];
  (categoriesJson as unknown as any).forEach((cat: any) => {
    categoryLookup[cat.name] = cat;
    categories.push(cat);
  });

  let PET_DATA = {
    categories: categories,
    categoryLookup: categoryLookup,
    eggs: eggs,
    eggLookup: eggLookup,
    pets: pets,
    petLookup: petLookup,
  };

  return PET_DATA;
}

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
  const indexLua = `return ${((await fetchWikitext('Module:Index_Data')).match(/return\s+({[\s\S]*})/)?.[1]) || '{}'}`;

  debug('Parsing Lua data...');
  const categoriesData = parse(ctgLua) as any[];
  const eggsData = parse(eggsLua) as { [key: string]: any };
  const petsData = parse(petsLua) as { [key: string]: any };
  const indexData = parse(indexLua) as { [key: string]: any };

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
      } as any;
      cat.egg = catData.egg || undefined;
      cat.pets = catData.pets || undefined;
      cat.reverseTabs = catData.reverseTabs || undefined;
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
    // Check Index_Data and see if any category contains this egg
    for (const index in indexData) {
      const indexInfo = indexData[index];
      if (indexInfo.luckBoost && indexInfo.eggs?.some((e: any) => e[0] === eggName)) {
        egg.index = index;
      }
    }
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
  });
  await Promise.all(petImagePromises);
  debug(`Fetched images for ${pets.length} pets.`);
  
  // await Promise.all for getting egg images:
  debug('Fetching egg images...');
  const eggImagePromises = eggs.map(async (egg) => {
    try {
      return await getEggImages(egg);
    }
    catch (error) {
      debug(`Error fetching images for egg ${egg.name}: ${error}`);
      return egg; // Return the egg without images if there's an error
    }
  });
  await Promise.all(eggImagePromises);
  debug(`Fetched images for ${eggs.length} eggs.`);

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

async function getEggImages(egg: Egg): Promise<Egg> {
  const eggName = egg.name;
  // Load HTML to find more info not included in wikitext
  const html = await fetchHTML(eggName);
  const $ = cheerio.load(html);
  const eggImage = $('figure.pi-item.pi-image[data-source="egg-image"] a.image-thumbnail');
  if (eggImage.length > 0) {
    const imgSrc = eggImage.attr('href')?.split('/revision')[0];
    if (imgSrc) {
      egg.image = imgSrc;
    }
  }
  return egg;
}


// ---------------------------------------------------------------
//                      Data Processing
// ---------------------------------------------------------------

const processNewData = (wikiData: PetData, existingData: any) => {
  for (const cat of wikiData.categories) {
    processCategory(cat, existingData);
  }

  exportDataToJson(wikiData);
}

function processCategory(cat: any, existingData: any) {
  // Check if the category already exists in the existing data
  const existingCat = existingData.categoryLookup[cat.name];
  if (existingCat) {
    processCategoryData(cat, existingCat);
  }
}

function processCategoryData(catData: any, existingCat: any) {
  catData.image = existingCat.image || '';
  if (catData.categories) {
    catData.categories.forEach((subCat: any) => {
      const existingSubCat = existingCat.categories.find((c: Category) => c.name === subCat.name);
      if (existingSubCat) {
        processCategoryData(subCat, existingSubCat);
      }
    });
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

// export interface WikiToolsProps {
//   data: PetData | undefined;
// }

export function WikiTools(): JSX.Element {
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
    processNewData(newData, loadData());
  }

  // const handlePetsJsonExport = () => {
  //   exportDataToJson(props.data!);
  // };

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
      {/* <Typography variant="h4" sx={{ mb: 2 }}>JSON Data Export</Typography>
      <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', mb: 2 }}>
        <Button
          variant="contained"
          onClick={() => handlePetsJsonExport}
          sx={{ mr: 2, maxWidth: '300px' }}
        >
          Export JSON Data
        </Button>
      </Box> */}
    </Container>
  );
}