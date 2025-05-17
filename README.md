# 🫧 BGSI Tools

Various tools for Bubble Gum Simulator Infinity.
- Odds Calculator
- Full Pet Index
- Pet Stat Table

Live site: [borngame.github.io/bgsi-tools](https://borngame.github.io/bgsi-tools)

### Odds Calculator

- Calculates accurate drop rates, drop times and luck stats
- Will give you the same chances displayed on the Egg Boards

Uses the formula `(1 / droprate) * (1 + (luckyBuff / 100))`
  
Note: Infinity Egg may not be calculated correctly, we are unsure how the game handles luck with that egg. It seems like the Egg Board for the Infinity Egg might be glitched (it adds up to more than 100% and doesn't follow the same formula for luck as other eggs). We assume that the back-end server calculation is the same as other eggs and that it's just the Egg Board that is glitched.

### Full Pet Index

- Index for all pets and their variants

### Pet Stat Table

- Compare the stats of all Legendary and Secret pets
- Preview Max Level and with Enchants (Team Up, Bubbler, Looter)
