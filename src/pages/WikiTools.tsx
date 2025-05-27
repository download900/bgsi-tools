import { JSX, SetStateAction, useEffect, useRef, useState } from "react";

import * as cheerio from 'cheerio';
import { Box, Button, Container, FormControl, Input, Typography } from "@mui/material";

import { Pet, Rarity, PetVariant, CurrencyVariant, Egg, Category } from "../util/PetUtil";
import Decimal from "decimal.js";

interface CategoryResult {
  name:   string;        // e.g. "The Overworld", "Minigame Paradise", …
  eggs:   EggResult[];   // one per egg in that subcategory
}

interface EggResult {
  eggName:  string;      // e.g. "Common Egg"
  petNames: string[];    // e.g. ["Doggy","Kitty","Bunny",…]
}

// (1) Orchestrator
export async function scrapeWiki(data: Category[], debug: (msg: string) => void): Promise<void> {
  debug('Fetching pet data page...');
  const petsData = await fetchWikitext('Bubble_Gum_Simulator_INFINITY_Wiki:Data/Pets');

  debug('Scraping pet list...');
  const entries = parsePetList(petsData);

  const all: Category[] = [];
  debug('Scraping pets...');
  
  for (const s of entries) {
    debug(`Scraping ${s.name}... [${s.eggs.length} eggs]`);
    const category = { name: s.name, eggs: [] } as any as Category;

    for (const e of s.eggs) {
      debug(`Scraping ${e.eggName}... [${e.petNames.length} pets]`);
      const egg = { name: e.eggName, image: '', pets: [] } as any as Egg;

      for (const petName of e.petNames) {
        debug(`Scraping ${petName}...`);
        const result = await parsePet(petName);
        egg.pets.push(result);
        if (!egg.image) {
          egg.image = result.obtainedFromImage;
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

        if (nameM) {
          out.push({ eggName, petName: nameM[1].trim() });
        }
      }
    }
  }

  return out;
}

// (4) Fetch each pet page and scrape pet and egg info
async function parsePet(petName: string): Promise<Pet> {
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
  const ticketsMatch = $('td.pi-horizontal-group-item[data-source="tickets"] b');
  if (ticketsMatch.length > 0) {
    currencyStat = extractNumber(ticketsMatch.first().text());
    currencyVariant = 'Tickets' as CurrencyVariant;
  }
  const seashellsMatch = $('td.pi-horizontal-group-item[data-source="seashells"] b');
  if (seashellsMatch.length > 0) {
    currencyStat = extractNumber(seashellsMatch.first().text());
    currencyVariant = 'Seashells' as CurrencyVariant;
  }

  // Rarity
  const rarityMatch = $('div.pi-item[data-source="rarity"] .pi-data-value b');
  let rarity = rarityMatch.first().text().trim();
  if (rarity.includes('Legendary')) rarity = 'Legendary';

  // Base chance text
  let baseChance: number = 1;
  const chanceRaw = $('div.pi-item[data-source="norm-petchance"] .pi-data-value')?.first().text();
  if (chanceRaw) {
    // ChanceRaw will either by like "60% (1 in 2)" or "1.5e-06% (1 in 66,666,666)", etc.
    // We just want the percent.
    // Check if scientific notation
    if (chanceRaw.includes('e')) {
      // Scientific notation, e.g. "1.5e-06%"
      const match = chanceRaw.match(/([\d.]+)e([+-]?\d+)%/);
      if (match) {
        const base = parseFloat(match[1]);
        const exponent = parseInt(match[2], 10);
        baseChance = Decimal(base).times(Decimal(10).pow(exponent)).toNumber();
      }
    }
    else {
      // Regular percentage, e.g. "60%"
      const match = chanceRaw.match(/([\d.]+)%/);
      if (match) {
        baseChance = Number(match[1]);
      }
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
  let hasMythic = false;

  variantDataSourceMap.forEach(([ds, variant]) => {
    const img = $(`figure.pi-item.pi-image[data-source="${ds}"] a.image-thumbnail`);
    if (img.length > 0) {
      if (variant === 'Mythic') hasMythic = true; // Track if Mythic variant exists
      const imgSrc = img.attr('href')?.split('/revision')[0];
      if (imgSrc) petVariants.push([variant, imgSrc]);
    }
  });

  // Pull the raw wikitext for the pet
  const petWikitext = await fetchWikitext(petName);
  let limited = false;
  let available = true;
  // Find |limited= yes/no or | limited=yes/no
  const limitedMatch = petWikitext.match(/\|\s*limited\s*=\s*(yes|no|exclusive)/);
  if (limitedMatch) {
    const t = limitedMatch[1].trim();
    limited = t === 'yes' || t === 'exclusive';
  }
  // Find |available= yes/no
  const availableMatch = petWikitext.match(/\|\s*available\s*=\s*(yes|no)/);
  if (availableMatch) {
    available = availableMatch[1].trim() === 'yes';
  }
  // Find Tags
  const tags: string[] = [];
  $('div.pi-item[data-source="tags"] .pi-data-value span').each((_, el) => {
    const tag = $(el).first().text().trim();
    if (tag && !tags.find((t) => t === tag)) tags.push(tag);
  });
  
  return {
    name: petName,
    rarity: rarity as Rarity,
    chance: baseChance,
    bubbles: bubbleStat,
    gems: gemsStat,
    currency: currencyStat,
    currencyVariant,
    hasMythic,
    tags,
    limited,
    available,
    obtainedFrom: obt.first().text().trim(),
    obtainedFromImage: eggImage || '',
    image: petVariants.map(([, img]) => img),
  } as Pet;
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
const processEggs = (wikiData: Category[], existingData: Category[]) => {
  const processEgg = (egg: Egg) => {
    for (const pet of egg.pets) {
      const existingPet = findExistingPet(pet.name, existingData);
      if (existingPet) {
        // update existing pet
        existingPet.chance = pet.chance;
        existingPet.bubbles = pet.bubbles;
        existingPet.gems = pet.gems;
        existingPet.currency = pet.currency;
        existingPet.currencyVariant = pet.currencyVariant;
        existingPet.hasMythic = pet.hasMythic;
        existingPet.tags = pet.tags;
        existingPet.image = pet.image;
        existingPet.limited = pet.limited;
        existingPet.available = pet.available;
        existingPet.obtainedFrom = pet.obtainedFrom;
        existingPet.obtainedFromImage = pet.obtainedFromImage;
      } else {
        // add new pet
        const existingEgg = newPets.find((egg) => egg.name === pet.obtainedFrom);
        if (existingEgg) {
          existingEgg.pets.push(pet);
        } else {
          newPets.push({
            name: pet.obtainedFrom,
            image: pet.obtainedFromImage,
            pets: [pet],
            luckIgnored: false, // default value, can be updated later
            infinityEgg: '',
            index: '',
            limited: pet.limited,
            available: pet.available,
            canSpawnAsRift: false, // default value, can be updated later
            secretBountyExcluded: false // default value, can be updated later
          });
        }
      }
    }
  }

  const newPets: Egg[] = [];
  for (const cat of wikiData) {
    cat.eggs?.forEach(egg => {
      processEgg(egg);
    });
  }
  
  // Process existingData JSON - remove "pet.variants", set to undefined.
  const existing = existingData as any;
  for (const category of existing) {
    for (const egg of category.eggs || []) {
      for (const pet of egg.pets) {
        pet.droprate = undefined;
      }
    }
    for (const subCategory of category.categories || []) {
      for (const egg of subCategory.eggs) {
        for (const pet of egg.pets) {
          pet.droprate = undefined;
        }
      }
    }
  }

  // Save JSONs
  saveJSON(existing, 'pets');
  if (newPets.length > 0) {
    saveJSON(newPets, 'new_pets');
  }
}

const findExistingPet = (petName: string, data: Category[]) => {
  for (const category of data) {
    if (category.eggs) {
      for (const egg of category.eggs) {
        for (const pet of egg.pets) {
          if (pet.name === petName) {
            return pet;
          }
        }
      }
    }
    if (category.categories) {
      for (const subCategory of category.categories) {
        if (subCategory.eggs) {
          for (const egg of subCategory.eggs) {
            for (const pet of egg.pets) {
              if (pet.name === petName) {
                return pet;
              }
            }
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

export interface WikiToolsProps {
    data: Category[];
}

// ────────────────────────────────────────────────────────────
// Export the data as a Lua *lookup* table keyed by pet name
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

  // Serialize as Lua and prepend `return `
  return lua;
}

const exportPetToLua = (pet: Pet): string => {
  let lua = "";
  lua += `  ["${pet.name}"] = {\n`;
  lua += `    ["Rarity"] = "${pet.rarity}",\n`;
  lua += `    ["Chance"] = ${pet.chance},\n`;
  lua += `    ["Stats"] = {\n`;
  lua += `      ["Bubbles"] = ${pet.bubbles},\n`;
  lua += `      ["${pet.currencyVariant}"] = ${pet.currency},\n`;
  pet.gems > 0 && (lua += `      ["Gems"] = ${pet.gems},\n`);
  lua += `    },\n`;
  lua += `    ["Mythic"] = ${pet.hasMythic ? '"yes"' : '"no"'},\n`;
  pet.tags?.length > 0 && (lua += `    ["Tag"] = "${pet.tags.join(', ')}",\n`);
  pet.limited && (lua += `    ["Limited"] = ${pet.limited && pet.obtainedFrom === "Robux Shop" ? '"exclusive"' : '"yes"'},\n`);
  pet.limited && (lua += `    ["Available"] = ${pet.available ? '"yes"' : '"no"'},\n`);
  lua += `    ["Source"] = "${pet.obtainedFrom}",\n`;
  lua += '  }'
  return lua;
}

export function exportSourcesToLua(data: Category[]): string {
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
  //${egg.pets.map((pet) => `"${pet.name}"`).join(', ')}
  let lua = '';
  lua += `  ["${egg.name}"] = {\n`;
  lua += `    ["Pets"] = [ ${egg.pets.map((pet) => `"${pet.name}"`).join(', ')} ],\n`;
  egg.luckIgnored           && (lua += `    ["LuckIgnored"] = ${egg.luckIgnored ? '"yes"' : '"no"'},\n`);
  egg.infinityEgg           && (lua += `    ["InfinityEgg"] = "${egg.infinityEgg}",\n`);
  egg.index                 && (lua += `    ["Index"] = "${egg.index}",\n`);
  egg.limited               && (lua += `    ["Limited"] = ${egg.limited ? '"yes"' : '"no"'},\n`);
  egg.limited               && (lua += `    ["Available"] = ${egg.available ? '"yes"' : '"no"'},\n`);
  egg.canSpawnAsRift        && (lua += `    ["CanSpawnAsRift"] = ${egg.canSpawnAsRift ? '"yes"' : '"no"'},\n`);
  !egg.secretBountyExcluded 
      && egg.canSpawnAsRift && (lua += `    ["CanHaveSecretBounty"] = ${!egg.secretBountyExcluded ? '"yes"' : '"no"'},\n`);
  lua += `  },\n`;
  return lua;
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
    exportLuaToFile(lua, 'pets');
  }

  const handleEggsLuaExport = () => {
    const lua = exportSourcesToLua(props.data);
    exportLuaToFile(lua, 'eggs');
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
      <Typography variant="h5" sx={{ m: 1 }}>Pets</Typography>
      <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
        <Button
          variant="contained"
          onClick={handlePetsLuaExport}
          sx={{ mt: 2, mr: 2 }}
          style={{ maxWidth: '200px' }}
        >
          Export LUA
        </Button>
        <Button
          variant="contained"
          onClick={() => handlePetsJsonExport}
          sx={{ mt: 2 }}
          style={{ maxWidth: '200px' }}
        >
          Export JSON
        </Button>
      </Box>
      <Typography variant="h5" sx={{ m: 1 }}>Eggs</Typography>
      <Button
        variant="contained"
        onClick={handleEggsLuaExport}
        sx={{ mt: 2 }}
        style={{ maxWidth: '200px' }}
      >
        Export LUA
      </Button>
    </Container>
  );
}