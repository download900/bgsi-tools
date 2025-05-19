import { JSX, SetStateAction, useEffect, useRef, useState } from "react";

import * as cheerio from 'cheerio';
import { Button, Container, FormControl, Input, Typography } from "@mui/material";

import { Pet, Rarity, PetVariant, CurrencyVariant, Egg, Category } from "../util/PetUtil";

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
  else {
    const ticketsMatch = $('td.pi-horizontal-group-item[data-source="tickets"] b');
    currencyStat = extractNumber(ticketsMatch.first().text());
    currencyVariant = 'Tickets' as CurrencyVariant;
  }

  // Rarity
  const rarityMatch = $('div.pi-item[data-source="rarity"] .pi-data-value b');
  let rarity = rarityMatch.first().text().trim();
  if (rarity.includes('Legendary')) rarity = 'Legendary';

  // Base chance text
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

  // Pull the raw wikitext for the pet
  const petWikitext = await fetchWikitext(petName);
  let limited = false;
  let available = true;
  // Find |limited= yes/no or | limited=yes/no
  const limitedMatch = petWikitext.match(/\|\s*limited\s*=\s*(yes|no)/);
  if (limitedMatch) {
    limited = limitedMatch[1].trim() === 'yes';
  }
  // Find |available= yes/no
  const availableMatch = petWikitext.match(/\|\s*available\s*=\s*(yes|no)/);
  if (availableMatch) {
    available = availableMatch[1].trim() === 'yes';
  }
  
  return {
    name: petName,
    rarity: rarity as Rarity,
    droprate: baseChance,
    bubbles: bubbleStat,
    gems: gemsStat,
    currency: currencyStat,
    currencyVariant,
    limited,
    available,
    obtainedFrom: obt.first().text().trim(),
    obtainedFromImage: eggImage || '',
    variants: petVariants.map(([variant]) => variant as PetVariant),
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
  const newPets: Pet[] = [];
  // update current data
  for (const cat of wikiData) {
    for (const egg of cat.eggs) {
      for (const pet of egg.pets) {
        const existingPet = findExistingPet(pet.name, existingData);
        if (existingPet) {
          // update existing pet
          existingPet.droprate = pet.droprate;
          existingPet.bubbles = pet.bubbles;
          existingPet.gems = pet.gems;
          existingPet.currency = pet.currency;
          existingPet.currencyVariant = pet.currencyVariant;
          existingPet.variants = pet.variants;
          existingPet.image = pet.image;
          existingPet.limited = pet.limited;
          existingPet.available = pet.available;
          existingPet.obtainedFrom = pet.obtainedFrom;
          existingPet.obtainedFromImage = pet.obtainedFromImage;
        } else {
          // add new pet
          newPets.push(pet);
        }
      }
    }
  }

  // Save JSONs
  saveJSON(existingData, 'pets');
  saveJSON(newPets, 'new_pets');
}

const findExistingPet = (petName: string, data: Category[]) => {
  for (const category of data) {
    for (const egg of category.eggs) {
      for (const pet of egg.pets) {
        if (pet.name === petName) {
          return pet;
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

// 2) Build your “eggs” array purely in JS,
export function exportToLua(data: Category[]): string {
  const pets: any[] = [];

  for (const cat of data) {
    const c: any = { name: cat.name, eggs: [] }
    for (const egg of cat.eggs) {
      for (const pet of egg.pets) {
        const p: any = {
          name: pet.name,
          obtainedFrom: pet.obtainedFrom,
          rarity: pet.rarity === 'Legendary' ? pet.droprate <= 5000 ? 'Legendary' : pet.droprate <= 49999 ? 'Legendary II' : 'Legendary III' : pet.rarity,
          chance:
            pet.droprate < 100
              ? `${100 / pet.droprate}%`
              : `1/${pet.droprate}`,
          bubbles: pet.bubbles,
          gems: pet.gems,
          currency: pet.currency,
          currencyType: pet.currencyVariant,
          hasMythic: pet.variants.includes("Mythic"),
          ...(pet.limited !== false && { limited: pet.limited }),
          ...(pet.limited !== false && { available: pet.available }),
        }
        pets.push(p);
      }
    }
  }

  // 3) Serialize it all as Lua
  const body = luaStringify(pets, "");
  return `local data = ${body}`;
}

// 1) Serialize any JS value into a pretty-printed Lua literal.
function luaStringify(value: any, indent = ""): string {
  const nextIndent = indent + "  ";

  if (Array.isArray(value)) {
    if (value.length === 0) return "{}";
    const items = value
      .map(v => nextIndent + luaStringify(v, nextIndent))
      .join(",\n");
    return `{\n${items}\n${indent}}`;
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value)
      // skip undefined
      .filter(([, v]) => v !== undefined)
      .map(
        ([k, v]) =>
          `${nextIndent}${k} = ${luaStringify(v, nextIndent)}`
      )
      .join(",\n");
    return `{\n${entries}\n${indent}}`;
  }

  if (typeof value === "string") {
    // escape quotes/backslashes
    const esc = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    return `"${esc}"`;
  }

  if (typeof value === "boolean" || typeof value === "number") {
    return String(value);
  }

  // fallback
  return "nil";
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

  const handleLuaExport = () => {
    const lua = exportToLua(props.data); 
    const blob = new Blob([lua], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pets.lua';
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
      <Typography variant="h4" sx={{ mb: 2 }}>Scraper</Typography>
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
      <Button
        variant="contained"
        onClick={handleLuaExport}
        sx={{ mt: 2 }}
        style={{ maxWidth: '200px' }}
      >
        Export Pets.lua
      </Button>
      <Button
        variant="contained"
        onClick={() => saveJSON(props.data, 'pets')}
        sx={{ mt: 2 }}
        style={{ maxWidth: '200px' }}
      >
        Export Pets.json
      </Button>
    </Container>
  );
}