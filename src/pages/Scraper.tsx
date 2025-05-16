import { JSX, SetStateAction, useEffect, useState } from "react";

import * as cheerio from 'cheerio';
import { Button, Container, FormControl, Input, Typography } from "@mui/material";

import { Pet, Rarity, PetVariant, CurrencyVariant, Egg, SubCategoryData, CategoryData } from "../util/PetUtil";

interface CategoryResult {
  name:   string;        // e.g. "The Overworld", "Minigame Paradise", …
  eggs:   EggResult[];   // one per egg in that subcategory
}

interface EggResult {
  eggName:  string;      // e.g. "Common Egg"
  petNames: string[];    // e.g. ["Doggy","Kitty","Bunny",…]
}

// (1) Orchestrator
export async function scrapeWiki(data: CategoryData[], debug: (msg: string) => void): Promise<void> {
  debug('Fetching pet data page...');
  const petsData = await fetchWikitext('Bubble_Gum_Simulator_INFINITY_Wiki:Data/Pets');

  debug('Scraping pet list...');
  const entries = parsePetList(petsData);

  const all: SubCategoryData[] = [];
  debug('Scraping pets...');
  
  for (const s of entries) {
    debug(`Scraping ${s.name}... [${s.eggs.length} eggs]`);
    const category = { name: s.name, eggs: [] } as any as SubCategoryData;

    for (const e of s.eggs) {
      debug(`Scraping ${e.eggName}... [${e.petNames.length} pets]`);
      const egg = { name: e.eggName, image: '', pets: [] } as any as Egg;

      for (const petName of e.petNames) {
        debug(`Scraping ${petName}...`);
        const result = await parsePet(petName);
        egg.pets.push(result.pet);
        if (!egg.image) {
          egg.image = result.eggImage;
        }
      }

      if (egg.pets.length > 0) {
        category.eggs.push(egg);
      }
    }

    if (category.eggs.length > 0) {
      all.push(category);
    }
  }

  debug('Processing scraped data...');
  processEggs(all, data);

  debug('Scraping complete!');
}

// (2) This function scans the Project:Data/Pets page
function parsePetList(src: string): CategoryResult[] {
  const subs: CategoryResult[] = [];
  const outerRE = /\|\-\|([^\n=]+)=/g;
  const markers: { name: string; idx: number }[] = [];
  let m: RegExpExecArray | null;

  // find every sub-category marker (“|-|Secret Bounty=” etc)
  while ((m = outerRE.exec(src))) {
    markers.push({ name: m[1].trim(), idx: m.index });
  }

  // for each sub-category slice out its chunk
  for (let i = 0; i < markers.length; i++) {
    const { name, idx } = markers[i];
    const endIdx = (i + 1 < markers.length ? markers[i+1].idx : src.length);
    const chunk  = src.slice(idx, endIdx);

    // primary parse via #tag:tabber
    const pairs = parseEggEntries(chunk);
    const eggs: EggResult[] = [];

    if (pairs.length > 0) {
      // group by eggName
      const byEgg: Record<string, string[]> = {};
      for (const { eggName, petName } of pairs) {
        (byEgg[eggName] ??= []).push(petName);
      }
      for (const [eggName, petNames] of Object.entries(byEgg)) {
        eggs.push({ eggName, petNames });
      }
    } else {
      // fallback: look for any standalone Pet-List blocks
      const petListRE = /\{\{Pet-List\s*\|([\s\S]+?)\}\}/g;
      for (const listM of chunk.matchAll(petListRE)) {
        const inner = listM[1];
        const petNames = inner
          .split(/\n\|/)           // split on leading pipe
          .map(s => s.trim())
          .map(item => item.match(/name:([^;]+);/))
          .filter((x): x is RegExpMatchArray => !!x)
          .map(x => x[1].trim());

        if (petNames.length) {
          // use the sub-category name itself as the egg name
          eggs.push({ eggName: name, petNames });
        }
      }
    }

    subs.push({ name, eggs });
  }

  return subs;
}

// (3) This scans a chunk for ALL inner {{#tag:tabber|…}} blocks
//     and returns a flat list of { eggName, petName } entries.
function parseEggEntries(src: string): { eggName: string; petName: string }[] {
  const out: { eggName: string; petName: string }[] = [];
  const openTag = '{{#tag:tabber|';
  let pos = 0;

  while (true) {
    const start = src.indexOf(openTag, pos);
    if (start === -1) break;

    // find matching closing “}}”
    let depth = 1, i = start + openTag.length;
    while (i < src.length && depth > 0) {
      if (src.startsWith('{{', i)) { depth++; i += 2; }
      else if (src.startsWith('}}', i)) { depth--; i += 2; }
      else { i++; }
    }

    // inner of this tabber
    const block = src.slice(start + openTag.length, i - 2);
    pos = i;

    // each “{{!}}-{{!}}” section is one egg
    for (const section of block.split('{{!}}-{{!}}')) {
      const eggM = section.match(/^([^=\n]+)=/m);
      if (!eggM) continue;
      const eggName = eggM[1].trim();

      // allow newline between "Pet-List" and "|"
      const listM = section.match(/\{\{Pet-List\s*\|([\s\S]+?)\}\}/);
      if (!listM) continue;

      // split on lines beginning with "|" → each pet entry
      const items = listM[1]
        .split(/\n\|/)
        .map(s => s.trim())
        .filter(s => s);

      for (const item of items) {
        const nameM = item.match(/name:([^;]+);/);

        //// If we want to filter by rarity, uncomment this
        // const rarity = item.match(/rarity:([^;\n]+)(;|\n|$)/);
        // if (!rarity) continue;
        // if (rarity[1].trim() !== 'Legendary' && rarity[1].trim() !== 'Secret') continue;

        if (nameM) {
          out.push({ eggName, petName: nameM[1].trim() });
        }
      }
    }
  }

  return out;
}

// (4) Fetch each pet page and scrape pet and egg info
async function parsePet(petName: string): Promise<{pet: Pet, eggImage: string}> {
  const html = await fetchHTML(petName);
  const $ = cheerio.load(html);

  // Obtained-from → eggName
  const obt = $('div.pi-item[data-source="obtained-from"] .pi-data-value');
  const eggImage = obt.find('img').attr('src')?.split('/revision')[0];

  // Base stats
  const bubbleStat = extractNumber($('td.pi-horizontal-group-item[data-source="bubbles"] b').first().text() || '0');
  const gemsStat = extractNumber($('td.pi-horizontal-group-item[data-source="gems"] b').first().text() || '0');
  let currencyStat = 0;
  let currencyVariant = 'Coins' as CurrencyVariant;
  const coinsMatch = $('td.pi-horizontal-group-item[data-source="coins"] b');
  if (coinsMatch.length > 0) {
    currencyStat = extractNumber(coinsMatch.first().text());
  }
  else {
    const ticketsMatch = $('td.pi-horizontal-group-item[data-source="tickets"] b');
    currencyStat = extractNumber(ticketsMatch.first().text());
    currencyVariant = 'Tickets' as CurrencyVariant;
  }

  // Rarity
  const rarityMatch = $('div.pi-item[data-source="rarity"] .pi-data-value b');
  let rarity = rarityMatch.first().text().trim();
  if (rarity.includes('Legendary')) rarity = 'Legendary';

  // Base chance text: find the “1 in X”
  let baseChance: number = 1;
  const chanceRaw = $('div.pi-item[data-source="norm-petchance"] .pi-data-value')?.first().text();
  if (chanceRaw) {
    const oddsMatch = chanceRaw.match(/1 in ([\d,]+)/);
    if (oddsMatch) {
      baseChance = extractNumber(oddsMatch![1]);
    }
    else {
      const percentMatch = chanceRaw.match(/(\d+(\.\d+)?)%/);
      baseChance = 100 / (percentMatch![1] as unknown as number);
    }
  }

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
  
  return { pet: {
    name: petName,
    rarity: rarity as Rarity,
    droprate: baseChance,
    bubbles: bubbleStat,
    gems: gemsStat,
    currency: currencyStat,
    currencyVariant,
    variants: petVariants.map(([variant]) => variant as PetVariant),
    image: petVariants.map(([, img]) => img),
  }, eggImage } as { pet: Pet, eggImage: string };
}

function extractNumber(str: string): number {
  // 1. Remove commas so "1,234.56" → "1234.56"
  // 2. Find the first integer or decimal, including an optional leading “-”
  const match = str
    .replace(/,/g, '')
    .match(/-?\d+(\.\d+)?/);

  // 3. parseFloat the match, or return 0 if none found
  return match ? parseFloat(match[0]) : 0;
}

async function fetchWikitext(pageName: string): Promise<string> {
  const api = 
    `https://bgs-infinity.fandom.com/api.php` +
    `?action=query` +
    `&prop=revisions` +
    `&rvprop=content` +
    `&format=json` +
    `&titles=${encodeURIComponent(pageName)}` +
    `&origin=*`;

  const res  = await fetch(api);
  const json = await res.json() as any;
  const pages = json.query.pages;
  const pageId = Object.keys(pages)[0];
  return pages[pageId].revisions[0]['*'];         // the raw wikitext
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
const processEggs = (cats: SubCategoryData[], data: CategoryData[]) => {
  const newPets: Pet[] = [];
  // update current data
  for (const cat of cats) {
    for (const egg of cat.eggs) {
      for (const pet of egg.pets) {
        const existingPet = findExistingPet(pet.name, data);
        if (existingPet) {
          // update existing pet
          existingPet.droprate = pet.droprate;
          existingPet.bubbles = pet.bubbles;
          existingPet.gems = pet.gems;
          existingPet.currency = pet.currency;
          existingPet.currencyVariant = pet.currencyVariant;
          existingPet.variants = pet.variants;
          existingPet.image = pet.image;
        } else {
          // add new pet
          newPets.push(pet);
        }
      }
    }
  }

  // Remove cyclic references from current data
  const newData = data as any;
  for (const category of newData) {
    for (const subcat of category.categories) {
      subcat.category = undefined;
      for (const egg of subcat.eggs) {
        egg.subcategory = undefined;
        for (const pet of egg.pets) {
          pet.egg = undefined;
        } 
      }
    }
  }

  // Save JSONs
  saveJSON(newData, 'pets');
  saveJSON(newPets, 'new_pets');
}

const findExistingPet = (petName: string, data: CategoryData[]) => {
  for (const category of data) {
    for (const subcat of category.categories) {
      for (const egg of subcat.eggs) {
        for (const pet of egg.pets) {
          if (pet.name === petName) {
            return pet;
          }
        }
      }
    }
  }
  return false;
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

export interface ScraperProps {
    data: CategoryData[];
}

export function Scraper(props: ScraperProps): JSX.Element {
  const [debug, setDebug] = useState<string[]>([ 'Ready to scrape...' ]);
  
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

  return (
    <Container sx={{ mt: 4, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'middle', maxWidth: '600px' }}>
      <Typography variant="h4" sx={{ mb: 2 }}>Scraper</Typography>
      <Button
        variant="contained"
        onClick={handleScrape}
        sx={{ mb: 2 }}
        style={{ maxWidth: '200px' }}
      >
        Scrape Pets
      </Button>
      <pre style={{ maxHeight: '400px', overflowY: 'auto', width: '100%', backgroundColor: '#333', color: '#fff', padding: '10px', borderRadius: '5px' }}>
        <code>
          {debug.map((line, index) => (
            <div key={index}>{line}</div>
          ))}
        </code>
      </pre>
    </Container>
  );
}