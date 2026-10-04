# Vesper — Evening Dining, Riga

A cinematic restaurant website concept. Scrolling is walking: the camera crosses a quiet Old Town street, passes through an arched glass door into a vaulted dining room, approaches a table, and the signature dish lifts out of its own photograph before settling into the menu.

**Concept, art direction, UX/UI and imagery:** Marta Jakovleva. Vesper is a fictional restaurant.

## Structure
- `index.html`, `styles.css`, `fonts.css`, `main.js`: the site (no framework, no build step)
- `assets/web/`: optimised WebP images, dish cut-out and depth map
- `assets/fonts/`: Instrument Serif + Inter (self-hosted)
- `docs/visual-bible.md`: reference analysis, visual bible, asset plan, prompts
- `tools/process.py`: raw images → web sizes, plate cut-out, depth map (needs `assets/raw/`, kept out of git)

## Run locally
Any static server, e.g. `npx serve .`

## Signature interactions
1. **Street → door → room**: one camera depth drives the whole walk-in. The exterior and the closer door photo are locked to the same door, so swapping them is invisible. The arched doorway then becomes the mask that reveals the dining room.
2. **Table → dish**: the plate is cut out of the same table photograph, so lifting it off the table has no seam. A WebGL depth-parallax shader (a hand-built depth map) gives it volume and a moving highlight. Steam is drawn in canvas.
3. **Dish → menu**: the plate shrinks into the opening of the menu as tonight's signature.

Respects `prefers-reduced-motion` (dissolves instead of camera moves).
