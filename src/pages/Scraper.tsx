// import { JSX, useEffect, useState } from "react";

// import * as cheerio from 'cheerio';
// import { Button, Container, FormControl, Input, Typography } from "@mui/material";

// export interface Pet {
//   name: string;
//   chance: string;
//   rarity: Rarity;
//   bubbleStat: number;
//   currencyStat: number;
//   gemsStat: number;
//   variant: PetVariant;
//   image: string;
//   eggName: string;
//   eggImage: string;
// }
// export type PetVariant = 'Normal' | 'Shiny' | 'Mythic' | 'Shiny Mythic';
// export type Rarity = 'Common' | 'Unique' | 'Rare' | 'Epic' | 'Legendary' | 'Secret';

// // fetch raw HTML
// async function fetchHTML(url: string): Promise<string> {
//   const res = await fetch(url);
//   if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
//   return res.text();
// }

// interface EggEntry {
//   petName: string;
//   eggName:  string;
// }

// function parseEggEntries(src: string): EggEntry[] {
//   const entries: EggEntry[] = [];
//   const openTag = '{{#tag:tabber|';
//   let pos = 0;

//   while (true) {
//     // find the next "{{#tag:tabber|"
//     const start = src.indexOf(openTag, pos);
//     if (start === -1) {
//         break;
//     }

//     // walk forward, counting {{ vs }} so we stop at the matching close
//     let depth = 1;
//     let i     = start + openTag.length;
//     while (i < src.length && depth > 0) {
//       if (src.startsWith('{{', i)) { depth++; i += 2; }
//       else if (src.startsWith('}}', i)) { depth--; i += 2; }
//       else { i++; }
//     }

//     // now [start+openTag.length .. i-2] is the full inner content
//     const block = src.slice(start + openTag.length, i - 2);
//     pos = i;

//     // split on "{{!}}-{{!}}" and extract eggName + petName
//     for (const section of block.split('{{!}}-{{!}}')) {
//       // first line like "Common Egg="
//       const eggMatch = section.match(/^([^=\n]+)=/m);
//       if (!eggMatch) continue;
//       const eggName = eggMatch[1].trim();

//       // find the Pet-List in that chunk
//       // This isn't working, but I don't know why
//       const listMatch = section.match(/\{\{Pet-List\s*\|([\s\S]+?)\}\}/);
//       if (!listMatch) continue;

//       for (const item of listMatch[1].split('|').map(s => s.trim())) {
//         const m = item.match(/name:([^;]+);/);
//         if (m) entries.push({
//           petName: m[1].trim(),
//           eggName
//         });
//       }
//     }
//   }

//   return entries;
// }

// function extractNumber(str: string): number {
//   const num = str.replace(/[^\d]/g, '');
//   return parseInt(num, 10) || 0;
// }
// function formatWithCommas(n: number): string {
//   return n.toLocaleString();
// }
// function computeChance(base: string, mult: number): string {
//   if (base.includes('/')) {
//     const denom = parseInt(base.split('/')[1].replace(/,/g, ''), 10);
//     return `1/${formatWithCommas(denom * mult)}`;
//   } else if (base.includes('%')) {
//     const pct = parseFloat(base.replace('%',''));
//     return `${(pct * mult).toFixed(3)}%`;
//   }
//   return base;
// }

// async function fetchPetHTML(petName: string): Promise<string> {
//     const api =
//       `https://bubblegum-simulator.fandom.com/api.php` +
//       `?action=parse` +
//       `&page=${encodeURIComponent(petName)}` +
//       `&prop=text` +
//       `&format=json` +
//       `&origin=*`;
//     const res  = await fetch(api);
//     const json = await res.json() as any;
//     if (json.error) {
//         console.error(`Error fetching ${petName}: ${json.error}`);
//         return '';
//     }
//     return json.parse.text['*'];  // the HTML fragment you can feed into cheerio.load()
// }

// // 2) Fetch each pet page and scrape rarity + egg info
// async function fetchPetVariants(entry: EggEntry): Promise<Pet[]> {
//     const html = await fetchPetHTML(entry.petName);
//     const $ = cheerio.load(html);

//     console.log(html);

//     // We need to iterate through the "<div class="pi-item pi-data pi-item-spacing pi-border-color">" elements and check the h3 title to determine the data.
//     // This will be used for Rarity, Bubble stat, Currency stat and Gems stat.

//     // For example, for Rarity, we have:
//     // HTML will look like this:
//     // <div class="pi-item pi-data pi-item-spacing pi-border-color">
//     // 		<h3 class="pi-data-label pi-secondary-font">Rarity</h3>
//     // 	<div class="pi-data-value pi-font"><span class="common">Common</span></div>
//     // </div>
//     // And we want the "Common" part (may say something else)
//     // We need to get the pi-item pi-data pi-item-spacing pi-border-color class and check the h3 title to determine the data.
//     // Then, we can get the value from the <div class="pi-data-value pi-font"> span element.

//     // Iterate through the <div class="pi-item pi-data pi-item-spacing pi-border-color"> elements and check the h3 title to determine the data.

//     // Rarity


//     // Obtained-from → eggName + eggImage
//     const obt = $('div.pi-item[data-source="obtained-from"] .pi-data-value');
//     const eggImage = obt.find('img').attr('data-src') || '';
//     const eggName  = obt.find('a').first().text().trim();

//     // Base stats
//     const bubbleStat   = extractNumber($('div.pi-item[data-source="bubbles"] b').text());
//     const currencyStat = extractNumber($('div.pi-item[data-source="tickets"] b').text());
//     const gemsStat     = extractNumber($('div.pi-item[data-source="gems"] b').text() || '0');

//     // Base chance text: prefer the “1 in X”
//     const chanceRaw = $('div.pi-item[data-source="norm-petchance"] .pi-data-value b').text();
//     const baseChance = (
//       chanceRaw.match(/\(1 in ([\d,]+)\)/)?.[1] ? `1/${chanceRaw.match(/\(1 in ([\d,]+)\)/)![1]}` :
//       chanceRaw.match(/[\d.]+%/)?.[0] || ''
//     );

//     // 3) Build one Pet object per variant if its image exists
//     const variants: [string, PetVariant, number][] = [
//       ['normal-image',      'Normal',       1],
//       ['shiny-image',       'Shiny',       40],
//       ['mythic-image',      'Mythic',     100],
//       ['shiny-mythic-image','Shiny Mythic',4000],
//     ];

//     return variants
//       .map(([ds, variant, mult]) => {
//         const img = $(`figure.pi-item.pi-image[data-source="${ds}"] a.image-thumbnail`)
//                       .attr('href');
//         if (!img) return null;
//         return {
//           name: entry.petName,
//           rarity,
//           bubbleStat,
//           currencyStat,
//           gemsStat,
//           variant,
//           image: img,
//           eggName,
//           eggImage,
//           chance: computeChance(baseChance, mult),
//         } as Pet;
//       })
//       .filter((p): p is Pet => !!p);
// }

// // 4) Orchestrator
// export async function scrapeAllPets(input: string): Promise<Pet[]> {
//     if (!input) {
//         console.error('No input provided');
//         return [];
//     }
//     console.log('Scraping pet list...');
//     const entries    = parseEggEntries(input);
//     const all: Pet[] = [];
//     console.log(`Found ${entries.length} entries`);
//     console.log('Scraping pet variants...');

//     for (const e of entries) {
//         console.log(`Scraping ${e.petName}...`);
//         const pets = await fetchPetVariants(e);
//         all.push(...pets);

//         break; // ← REMOVE THIS LINE TO SCRAPE ALL PETS

//         // ← consider a small delay here to be polite to the server
//         await new Promise(resolve => setTimeout(resolve, 10000));
//     }

//     return all;
// }

// export function Scraper(): JSX.Element {
//     const [input, setInput] = useState<string>('');

//     const handleScrape = async () => {
//         scrapeAllPets(input).then((pets) => {
//             if (pets.length === 0) {
//                 console.error('No pets found');
//                 return;
//             }

//             // save pets to json to downloads folder via Document.click
//             const blob = new Blob([JSON.stringify(pets, null, 2)], { type: 'application/json' });
//             const url = URL.createObjectURL(blob);
//             const a = document.createElement('a');
//             a.href = url;
//             a.download = 'pets.json';
//             document.body.appendChild(a);
//             a.click();
//             document.body.removeChild(a);
//         });
//     }

//     return (
//         <Container sx={{ mt: 4, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'middle', maxWidth: '600px' }}>
//             <Typography variant="h4" sx={{ mb: 2 }}>Scraper</Typography>
//             <FormControl sx={{ mb: 2 }}>
//                 {/* MAKE THIS MULTILINE INPUT, ALIGNED TO TOP LEFT: */}
//                 <Input
//                     type="text"
//                     value={input}
//                     onChange={(e) => setInput(e.target.value)}
//                     style={{ width: '100%', height: '200px', backgroundColor: '#444444', borderRadius: '4px', padding: '8px' }}
//                     multiline
//                     rows={8}
//                 />
//             </FormControl>
//             <Button
//                 variant="contained"
//                 onClick={handleScrape}
//                 sx={{ mb: 2 }}
//                 style={{ maxWidth: '200px' }}
//             >
//                 Scrape Pets
//             </Button>
//         </Container>
//     );
// }

export default function Scraper() {
    return <>   </>;
}