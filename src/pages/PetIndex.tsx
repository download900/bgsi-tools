// src/pages/PetIndex.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Avatar,
  Box,
  Checkbox,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  Link,
} from "@mui/material";

import {
  Category,
  Pet,
  PetData,
  PetVariant,
  Rarity,
  isAvailable,
  petVariants,
} from "../util/DataUtil";
import { getPercentStyle, getRarityStyle } from "../util/StyleUtil";
import { theme } from "..";

const STORAGE_KEY = "petTrackerState";
const drawerWidth = 340;
type PetKey = `${string}__${PetVariant}`;
type OwnedPets = Record<PetKey, boolean>;

/* ---------- helpers ---------- */

/** Remove duplicate pets (by name) while preserving order. */
const uniquePets = (pets: Pet[]): Pet[] => {
  const seen = new Set<string>();
  const out: Pet[] = [];
  for (const p of pets) {
    if (!seen.has(p.name)) {
      seen.add(p.name);
      out.push(p);
    }
  }
  return out;
};

const collectPets = (cat: Category | undefined): Pet[] => {
  if (!cat) return [];
  const out: Pet[] = [];
  const dfs = (c: Category) => {
    if (c.pets?.length) out.push(...c.pets);
    c.categories?.forEach(dfs);
  };
  dfs(cat);
  return uniquePets(out);
};

const getCategoryByPath = (
  root: Category[],
  path: string
): Category | undefined => {
  if (!path || path === "All") return undefined;
  let current: Category | undefined;
  let branch = root;
  for (const segment of path.split("|")) {
    current = branch.find((c) => c.name === segment);
    if (!current) return undefined;
    branch = current.categories ?? [];
  }
  return current;
};

const rarityOrder: Rarity[] = [
  "common",
  "unique",
  "rare",
  "epic",
  "legendary",
  "secret",
];

const calcCompletion = (pets: Pet[], owned: OwnedPets) => {
  const totals: Record<PetVariant, number> = {
    Normal: 0,
    Shiny: 0,
    Mythic: 0,
    "Shiny Mythic": 0,
  };
  const ownedTotals: Record<PetVariant, number> = { ...totals };

  for (const pet of pets) {
    for (const v of petVariants) {
      if (!pet.hasMythic && v.includes("Mythic")) continue;
      totals[v]++;
      if (owned[`${pet.name}__${v}`]) ownedTotals[v]++;
    }
  }

  const totalAll = Object.values(totals).reduce((a, b) => a + b, 0);
  const ownedAll = Object.values(ownedTotals).reduce(
    (a, b) => a + b,
    0
  );

  return {
    overall: totalAll
      ? Math.round((ownedAll / totalAll) * 100)
      : 0,
    perVariant: Object.fromEntries(
      petVariants.map((v) => [
        v,
        totals[v]
          ? Math.round((ownedTotals[v] / totals[v]) * 100)
          : 0,
      ])
    ) as Record<PetVariant, number>,
    raw: {
      owned: ownedAll,
      total: totalAll,
      perVariant: ownedTotals,
      totals,
    },
  };
};

/* ---------- component ---------- */
interface Props {
  data: PetData | undefined;
}

export function PetIndex({ data }: Props) {
  const [ownedPets, setOwnedPets] = useState<OwnedPets>({});
  const [selectedPath, setSelectedPath] = useState<string>("All");
  const [visibleCount, setVisibleCount] = useState(20);

  /* restore */
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setOwnedPets(JSON.parse(saved));
    } catch {}
  }, []);

  const saveState = (o: OwnedPets) =>
    localStorage.setItem(STORAGE_KEY, JSON.stringify(o));

  const togglePet = (pet: string, v: PetVariant) => {
    const key: PetKey = `${pet}__${v}`;
    setOwnedPets((prv) => {
      const nxt = { ...prv, [key]: !prv[key] };
      saveState(nxt);
      return nxt;
    });
  };

  /* data */
  const allPets = uniquePets(data?.pets ?? []);
  const allStats = useMemo(
    () => calcCompletion(allPets, ownedPets),
    [allPets, ownedPets]
  );

  const currentCat = getCategoryByPath(
    data?.categories ?? [],
    selectedPath
  );
  const petsToShow =
    selectedPath === "All"
      ? allPets
      : collectPets(currentCat);

  const sortedPets = useMemo(
    () =>
      [...petsToShow].sort((a, b) => {
        if (a.obtainedFrom !== b.obtainedFrom) {
          return -1;
        }
        if (a.dateAdded !== b.dateAdded) {
          return a.dateAdded < b.dateAdded ? -1 : 1;
        }
        if (a.rarity !== b.rarity) {
          return rarityOrder.indexOf(a.rarity) -
            rarityOrder.indexOf(b.rarity);
        }
        return b.chance - a.chance;
      }),
    [petsToShow]
  );

  const headerStats = useMemo(
    () => calcCompletion(petsToShow, ownedPets),
    [petsToShow, ownedPets]
  );

  /* scroll */
  useEffect(() => {
    setVisibleCount(20);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [selectedPath]);

  useEffect(() => {
    const onScroll = () => {
      if (
        window.innerHeight + window.scrollY >=
          document.documentElement.scrollHeight - 150 &&
        visibleCount < sortedPets.length
      ) {
        setVisibleCount((c) =>
          Math.min(c + 20, sortedPets.length)
        );
      }
    };
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, [visibleCount, sortedPets.length]);

  /* drawer */
  const renderItem = (
    cat: Category,
    depth: number,
    parentPath = ""
  ) => {
    const path = parentPath
      ? `${parentPath}|${cat.name}`
      : cat.name;

    const selected = path === selectedPath;
    const isAncestor = selectedPath.startsWith(`${path}|`);
    const expanded = selected || isAncestor;

    const stats = calcCompletion(collectPets(cat), ownedPets);
    const bg = selected ? "#111122" : depth === 0 ? "#111" : "#222";

    return (
      <Box key={path}>
        <ListItemButton
          sx={{ pl: (depth + 1) * 2, backgroundColor: bg }}
          selected={selected}
          onClick={() =>
            setSelectedPath(selected ? "All" : path)
          }
        >
          <ListItemIcon>
        <Avatar
          src={cat.image}
          variant="square"
          sx={{ width: 24, height: 24 }}
        />
          </ListItemIcon>
          <ListItemText>
        <Typography sx={{ fontWeight: "bold" }}>
          {cat.name} ({stats.overall}%)
        </Typography>
          </ListItemText>
        </ListItemButton>

        {expanded &&
          (cat.reverseTabs
        ? [...(cat.categories || [])]
            .reverse()
            .map((sub) =>
              renderItem(sub, depth + 1, path)
            )
        : cat.categories?.map((sub) =>
            renderItem(sub, depth + 1, path)
          ))}
      </Box>
    );
  };

  /* render */
  return (
    <Box sx={{ display: "flex", flexGrow: 1 }}>
      {/* drawer */}
      <Drawer
        variant="permanent"
        anchor="left"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          "& .MuiDrawer-paper": {
            width: drawerWidth,
            boxSizing: "border-box",
            mt: 8,
            height: `calc(100% - ${theme.mixins.toolbar.minHeight}px)`,
            overflowY: "auto",
          },
        }}
      >
        <List disablePadding>
          <ListItemButton
            selected={selectedPath === "All"}
            onClick={() => setSelectedPath("All")}
          >
            <ListItemText
              primary={`All (${allStats.overall}%)`}
            />
          </ListItemButton>

          {data?.categories.map((c) => renderItem(c, 0))}
          <Box sx={{ height: "50px" }} />
        </List>
      </Drawer>

      {/* main */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          mt: 1,
          mx: "auto",
          maxWidth: "1000px",
        }}
      >
        {/* header */}
        <Typography variant="h4" gutterBottom>
          {selectedPath === "All"
            ? "All Pets"
            : selectedPath.replace(/\|/g, " › ")}
          :{" "}
          <span style={getPercentStyle(headerStats.overall)}>
            {headerStats.raw.owned} / {headerStats.raw.total} (
            {headerStats.overall}%)
          </span>
        </Typography>

        {/* variant stats */}
        <Paper sx={{ p: 2, mb: 4, width: "fit-content" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                {petVariants.map((v) => (
                  <TableCell key={v}>
                    <b>{v}</b>
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow>
                {petVariants.map((v) => (
                  <TableCell
                    key={v}
                    sx={getPercentStyle(
                      headerStats.perVariant[v]
                    )}
                  >
                    {headerStats.raw.perVariant[v]} /{" "}
                    {headerStats.raw.totals[v]} (
                    {headerStats.perVariant[v]}%)
                  </TableCell>
                ))}
              </TableRow>
            </TableBody>
          </Table>
        </Paper>

        {/* pet list */}
        <Paper sx={{ p: 1 }} elevation={2}>
          <Table
            size="small"
            sx={{ "& .MuiTableCell-root": { p: 0.5 } }}
          >
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 24 }} />
                <TableCell sx={{ width: 180, fontWeight: "bold" }}>
                  Pet
                </TableCell>
                <TableCell sx={{ width: 120, fontWeight: "bold" }}>
                  Chance
                </TableCell>
                {petVariants.map((v) => (
                  <TableCell
                    key={v}
                    sx={{
                      width: 80,
                      fontWeight: "bold",
                      textAlign: "left",
                    }}
                  >
                    {v}
                  </TableCell>
                ))}
                <TableCell sx={{ width: 24 }} />
                <TableCell sx={{ width: 150, fontWeight: "bold" }}>
                  Source
                </TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {sortedPets.slice(0, visibleCount).map((pet) => {
                const style = getRarityStyle(pet.rarity);
                const discontinued = !isAvailable(pet.dateRemoved);

                const dropDisplay = pet.hatchable
                  ? pet.chance >= 1
                    ? `${pet.chance.toLocaleString(undefined, {
                        maximumFractionDigits: 2,
                      })}%`
                    : `1/${(100 / pet.chance).toLocaleString(
                        undefined,
                        { maximumFractionDigits: 0 }
                      )}`
                  : "100%";

                return (
                  <TableRow key={pet.name}>
                    <TableCell>
                      <Link
                        href={`https://bgs-infinity.fandom.com/wiki/${pet.name}`}
                        target="_blank"
                      >
                        <Avatar
                          src={pet.image[0]}
                          variant="square"
                          sx={{ width: 24, height: 24 }}
                        />
                      </Link>
                    </TableCell>

                    <TableCell>
                      <Link
                        href={`https://bgs-infinity.fandom.com/wiki/${pet.name}`}
                        target="_blank"
                        sx={{ textDecoration: "none" }}
                      >
                        <Typography variant="body2" sx={style}>
                          {pet.name}
                        </Typography>
                        {discontinued && (
                            <span
                              style={{
                                color: "#666",
                                fontSize: "0.8em",
                              }}
                            >
                              {" "}
                              (Discontinued)
                            </span>
                          )}
                      </Link>
                    </TableCell>

                    <TableCell>
                      <Typography variant="body2" sx={style}>
                        {dropDisplay}
                      </Typography>
                    </TableCell>

                    {petVariants.map((v) => (
                      <TableCell key={v}>
                        {(!v.includes("Mythic") ||
                          (v.includes("Mythic") && pet.hasMythic)) && (
                          <Checkbox
                            size="small"
                            checked={!!ownedPets[`${pet.name}__${v}`]}
                            onChange={() => togglePet(pet.name, v)}
                          />
                        )}
                      </TableCell>
                    ))}

                    <TableCell>
                      <Avatar
                        src={pet.obtainedFromImage}
                        alt={pet.obtainedFrom}
                        sx={{ width: 24, height: 24 }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {pet.obtainedFrom}
                      </Typography>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Paper>
      </Box>
    </Box>
  );
}
