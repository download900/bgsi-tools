-- Module:PetData

-- Data module for calculators to use.
-- Provides a list of all currently hatchable Legendary and Secret pets which are affected by luck (ie. suitable for calculators).
-- Pet data generated with borngame.github.io/bgsi-tools (run locally, Wiki Tools tab)

-- Usage:
-- require('Module:PetData').main(frame)
-- OR
-- {{#invoke:PetData|main}}

-- Lua table output:
-- {
--   { 
--     name = "Egg Name"     -- The name of the egg
--     index = "Index Name"  -- If defined, this egg contributes to this Index, and benefits from the Index completion bonus.
--     infinityEgg = "Name"  -- If defined, this egg is hatchable by the Infinity Egg. The value is the name of the world.
--     pets = {              -- The list of pets in this egg
--       { 
--         name = "Pet Name" -- The name of the pet
--         rarity = "Rarity" -- The rarity of the pet. Can be "Common", "Unique", "Rare", "Epic", "Legendary", "Secret"
--         droprate = Number -- The droprate of the pet, in 1/x format. For example, a value of 100 means the pet has a 1/100 chance to be hatched.
--       }, ... (more pets)
--     }, ... (more eggs)
--   }
-- }


local p = {}
local lang = mw.language.getContentLanguage()
local args   = require('Module:ProcessArgs').merge(true)

local eggs = {
  { name = "Common Egg", index = "The Overworld", infinityEgg = "The Overworld", pets = {
    { name = "King Doggy", rarity = "Secret", droprate = 100000000},
  } },
  { name = "Spikey Egg", index = "The Overworld", infinityEgg = "The Overworld", pets = {
    { name = "Emerald Golem", rarity = "Legendary", droprate = 200},
  } },
  { name = "Magma Egg", index = "The Overworld", infinityEgg = "The Overworld", pets = {
    { name = "Inferno Dragon", rarity = "Legendary", droprate = 400},
  } },
  { name = "Crystal Egg", index = "The Overworld", infinityEgg = "The Overworld", pets = {
    { name = "Unicorn", rarity = "Legendary", droprate = 400},
    { name = "Flying Pig", rarity = "Legendary", droprate = 1000},
  } },
  { name = "Lunar Egg", index = "The Overworld", infinityEgg = "The Overworld", pets = {
    { name = "Lunar Serpent", rarity = "Legendary", droprate = 400},
    { name = "Electra", rarity = "Legendary", droprate = 1000},
  } },
  { name = "Void Egg", index = "The Overworld", infinityEgg = "The Overworld", pets = {
    { name = "Dark Phoenix", rarity = "Legendary", droprate = 2000},
    { name = "Neon Elemental", rarity = "Legendary", droprate = 5000},
    { name = "NULLVoid", rarity = "Legendary", droprate = 1000000},
  } },
  { name = "Hell Egg", index = "The Overworld", infinityEgg = "The Overworld", pets = {
    { name = "Inferno Cube", rarity = "Legendary", droprate = 4000},
    { name = "Virus", rarity = "Legendary", droprate = 50000},
  } },
  { name = "Nightmare Egg", index = "The Overworld", infinityEgg = "The Overworld", pets = {
    { name = "Green Hydra", rarity = "Legendary", droprate = 25000},
    { name = "Demonic Hydra", rarity = "Legendary", droprate = 100000},
    { name = "The Overlord", rarity = "Secret", droprate = 50000000},
  } },
  { name = "Rainbow Egg", index = "The Overworld", infinityEgg = "The Overworld", pets = {
    { name = "Hexarium", rarity = "Legendary", droprate = 100000},
    { name = "Rainbow Shock", rarity = "Legendary", droprate = 200000},
  } },
  { name = "Mining Egg", index = "Minigame Paradise", infinityEgg = "Minigame Paradise", pets = {
    { name = "Crystal Unicorn", rarity = "Legendary", droprate = 200},
    { name = "Stone Gargoyle", rarity = "Legendary", droprate = 20000},
  } },
  { name = "Cyber Egg", index = "Minigame Paradise", infinityEgg = "Minigame Paradise", pets = {
    { name = "Cyborg Phoenix", rarity = "Legendary", droprate = 2500},
    { name = "Space Invader", rarity = "Legendary", droprate = 50000},
    { name = "Bionic Shard", rarity = "Legendary", droprate = 666666},
    { name = "Mech Robot", rarity = "Secret", droprate = 66666666},
  } },
  { name = "Underworld Egg", index = "Minigame Paradise", pets = {
    { name = "Crimson Butterfly", rarity = "Legendary", droprate = 2000},
    { name = "Demonweb", rarity = "Legendary", droprate = 40000},
    { name = "Crimson Bloodmoon", rarity = "Legendary", droprate = 833333},
    { name = "Lord Shock", rarity = "Secret", droprate = 500000000},
  } },
  { name = "Game Egg", pets = {
    { name = "Game Master", rarity = "Legendary", droprate = 100000},
    { name = "Jackpot", rarity = "Legendary", droprate = 20000000},
  } },
  { name = "200M Egg", infinityEgg = "The Overworld", pets = {
    { name = "Prismatic", rarity = "Legendary", droprate = 2500},
    { name = "Darkness Creature", rarity = "Legendary", droprate = 50000},
    { name = "Corrupt Glitch", rarity = "Legendary", droprate = 800000},
    { name = "Wolflord", rarity = "Secret", droprate = 100000000},
  } },
  { name = "Silly Egg", pets = {
    { name = "DOOF", rarity = "Legendary", droprate = 10000},
    { name = "ROUND", rarity = "Legendary", droprate = 250000},
    { name = "Silly Doggy :)", rarity = "Secret", droprate = 1000000},
  } },

}

-- helper to build one Infinity Egg for a given world/name
local function buildInfinityEgg(world)
    local legendaryRate, secretRate = 200, 40000000
    local allPets = {}
    -- 1) gather all pets from every egg whose infinityEgg == world
    for _, egg in ipairs(eggs) do
        if egg.infinityEgg == world then
            for _, pet in ipairs(egg.pets) do
                table.insert(allPets, pet)
            end
        end
    end

    -- 2) compute sum of 1/droprate per rarity‐group
    local totals = { Legendary = 0, Secret = 0 }
    for _, pet in ipairs(allPets) do
        local dec = 1 / pet.droprate
        local key = (pet.rarity == "Secret") and "Secret" or "Legendary"
        totals[key] = totals[key] + dec
    end

    -- 3) rescale each pet’s droprate
    local rateMap = { Legendary = legendaryRate, Secret = secretRate }
    local updated = {}
    for _, pet in ipairs(allPets) do
        local key = (pet.rarity == "Secret") and "Secret" or "Legendary"
        local newRate = pet.droprate * totals[key] / (1 / rateMap[key])
        -- copy original pet and overwrite droprate
        local copy = {}
        for k, v in pairs(pet) do copy[k] = v end
        copy.droprate = newRate
        table.insert(updated, copy)
    end

    -- 4) sort by ascending droprate
    table.sort(updated, function(a, b) return a.droprate < b.droprate end)

    -- 5) prepend “Any Legendary” and “Any Secret”
    local finalPets = {
        { name = "Any Legendary", droprate = legendaryRate, rarity='Legendary' },
        { name = "Any Secret",    droprate = secretRate,    rarity='Secret' },
    }
    for _, pet in ipairs(updated) do
        table.insert(finalPets, pet)
    end

    return {
        name        = "Infinity Egg (" .. world .. ")",
        pets        = finalPets,
        subcategory = world,
    }
end

function p.main(frame)
    -- Add Infinity Eggs for each world
    local worlds = { "The Overworld", "Minigame Paradise" }
    for _, world in ipairs(worlds) do
        table.insert(eggs, buildInfinityEgg(world))
    end

    -- Sort the eggs by name
    table.sort(eggs, function(a, b)
        return a.name < b.name
    end)

    -- return the table
    return eggs
end

function p.table(frame)
    local eggs = p.main(frame)
    -- Build wikitext table
    local lines = {}
    for _, egg in ipairs(eggs) do
        -- Add egg header
        table.insert(lines, '== ' .. egg.name .. ' ==\n')
        if egg.index then
            table.insert(lines, 'Index: ' .. egg.index .. '\n\n')
        end
        if egg.infinityEgg then
            table.insert(lines, 'Infinity Egg: ' .. egg.infinityEgg .. '\n\n')
        end
        table.insert(lines, '<table class="fandom-table">')
        table.insert(lines, '<tr><th>Pet</th><th>Rarity</th><th>Droprate</th></tr>')
        for _, pet in ipairs(egg.pets) do
            table.insert(lines, '<tr>')
            table.insert(lines, '<td>' .. pet.name .. '</td>')
            table.insert(lines, '<td>' .. pet.rarity .. '</td>')
            table.insert(lines, '<td>' .. pet.droprate .. '</td>')
            table.insert(lines, '</tr>')
        end
        table.insert(lines, '</table>\n\n')
    end
    return table.concat(lines)
end

return p