# VESPER — Evening Dining, Riga
Concept website · creative direction, visual bible & asset plan

---

## 1. Reading the reference (creative-director breakdown)

| t | What happens | The underlying idea | What we keep | What we drop |
|---|---|---|---|---|
| 0–2s | Storefront facade in daylight, small hero type | The building is the first impression | **Architecture as hero** | Daylight, shop-front cliché |
| 2–4s | Camera pushes through the facade into the dining room | Scroll = walking forward. One continuous space, no section breaks | **Camera is the visitor; door → interior frame match** | Literal fly-through blur |
| 4–5s | Interior dissolves to white, a pizza appears isolated, floating | The **environment falls away** and the product becomes an object | **Dish lifts out of its own photo** | White void, pizza, 3D-render look |
| 5–10s | Ingredients burst above the pizza, pizza rotates | Product deconstructed into layers = dimensionality | **Layered dish: plate / food / steam / light / shadow** | Exploding ingredients (too "demo") |
| 10–12s | Pizza shrinks into a product grid | Hero object → catalogue | **Dish → first item in the menu** | E-commerce grid |
| 12–16s | Cartoon character eats the pizza | Desire / appetite moment | Appetite is created by the food itself | **Character — removed entirely** |
| 16–20s | Features, delivery tracker, dark footer | Conversion | **One calm conclusion: reserve a table** | Delivery UI, badges |

**The structural logic:** PLACE → (threshold) → EXPERIENCE → (focus pull) → FOOD → (shrink) → MENU → ACTION.
Each transition is driven by *a shared visual element*, not a fade between unrelated sections. We rebuild that grammar in an evening, architectural, editorial language.

---

## 2. The restaurant

**VESPER** — the evening star; the first light you see after sunset.
Casual fine dining in a converted 19th-century stone merchant house in Riga's Old Town.
Kitchen: Baltic produce cooked over a wood hearth — sea, forest, field. Wine-led bar. Open evenings only.

Voice: quiet, confident, warm, short sentences. Never "BOOK NOW!!!". The CTA is always **Reserve a table →**.

---

## 3. Visual bible (applies to every image)

**ARCHITECTURE** — 19th-c. Riga merchant house. Facade of pale limestone and warm grey lime plaster, deep reveals. A single tall arched opening fitted with a contemporary blackened-bronze steel-framed glass door; two tall mullioned windows either side. Small bronze plaque, no illuminated sign. Wet cobblestones, narrow quiet street. Inside: long room under a low limewashed brick barrel vault.

**MATERIALS** — limewashed plaster (warm stone), smoked oak, travertine, blackened bronze / brushed brass (muted, never shiny gold), dark olive leather, oxblood/burgundy linen, hand-thrown stoneware, thin clear glass.

**LIGHTING** — Exterior: blue hour, ~20 min after sunset, deep blue sky. Interior: 2700K tungsten pools from low bronze pendants + candles in short glass holders. Warm inside / cool outside is the identity.

**PALETTE** — warm black #0E0C0A · charcoal #1A1714 · deep brown #2A211B · stone #B9AE9F · cream #EDE6DA · muted bronze #9C7A55 · amber #D49A5C · burgundy #5E1F22 · dark olive #3E4231.

**FURNITURE** — solid smoked-oak tables (no tablecloths), curved oak chairs with olive leather seats, an olive leather banquette along the wall, a long travertine bar with bronze foot rail.

**TABLEWARE** — off-white speckled stoneware plates with a raw unglazed rim; thin-stemmed glasses; dark bronze cutlery; oxblood linen napkins.

**CAMERA** — full-frame, 35mm for spaces (eye height 150cm, verticals corrected, one-point perspective), 50mm for tables, 85–100mm for food at ~35–45°. Shallow DOF (f/2–2.8). Same photographer, same day.

**GRADE** — warm, low-contrast highlights, deep but not crushed blacks, gentle filmic roll-off, subtle fine grain (Portra 800-like). No HDR, no teal-orange.

**NEVER** — people as subjects, cartoon/illustration, neon, bright red/yellow, excessive gold, ornate/casino luxury, hotel-restaurant blandness, plastic food.

---

## 4. Asset plan (minimum set — each has a job)

| # | File | Used where | Transition it supports | Ratio | Notes |
|---|---|---|---|---|---|
| 1 | `exterior-blue-hour` | Hero (chapter 01) | Push-in toward the door | 16:9 (+9:16 crop) | Door **dead centre**, symmetrical |
| 2 | `entrance-door` | Threshold | Door glass becomes the mask for the interior | 16:9 | Same door, from ~3m, interior glow behind glass |
| 3 | `interior-main` | Inside the door | Door frame → interior frame | 16:9 | One-point perspective down the vault, vanishing point centre |
| 4 | `bar` | Chapter "The Bar" | Editorial | 4:5 | Travertine bar, bottles, bronze |
| 5 | `table-signature` | The Table → Dish | Camera pushes onto the plate | 3:2 (hi-res) | Signature dish on oak table, candle, glass; plate large & sharp |
| 6 | `dish-signature` (cutout PNG layers) | Dish hero, menu item 01 | Plate lifts out of #5 | from #5 | Cut from the *same* photo → perfect continuity |
| 7 | `kitchen-hearth` | Chapter "The Hearth" | Editorial | 4:5 | Hands plating at the wood fire, faces out of frame |
| 8 | `dish-beetroot` | Menu hover | — | 4:5 | Small plate |
| 9 | `dish-duck` | Menu hover | — | 4:5 | From the land |
| 10 | `dish-dessert` | Menu hover | — | 4:5 | Dessert |
| 11 | `table-candle-detail` | The Night / reservation | Closes the evening | 16:9 | Candle, wine glass, linen |

Steam, light sweep and shadow are generated in code (not images). No video until stills are approved — a still with controlled motion beats weak generated footage.

---

## 5. Prompts (Magnific)

Shared style suffix (appended to every prompt):
> editorial architectural and restaurant photography, shot on full-frame camera, natural realistic materials, warm 2700K tungsten interior light, deep blue-hour exterior, soft filmic contrast, deep warm blacks, subtle fine film grain, muted bronze, dark olive and oxblood accents, photorealistic, no people, no text, no logos

**1 · exterior-blue-hour (16:9)**
Symmetrical frontal view of a small restaurant in a 19th-century pale limestone merchant house on a quiet narrow cobblestone street in Riga Old Town at blue hour. A single tall arched opening in the centre of the facade holds a modern blackened-bronze steel-framed glass double door, warm amber light glowing from inside, glimpses of candlelit tables through the glass. Two tall mullioned windows either side, deep stone reveals, a small discreet bronze plaque beside the door, wet cobblestones reflecting the warm light, deep blue sky, empty street, 35mm lens at eye level, perfectly corrected verticals, one-point perspective, door exactly in the centre of the frame + suffix

**2 · entrance-door (16:9)**
Closer frontal view of the same arched restaurant entrance from three metres: tall blackened-bronze steel-framed glass double door set in a deep pale limestone arch, slightly ajar, warm candlelit dining room visible through the glass, low bronze pendant lamps inside, wet stone threshold, blue-hour light on the facade, door centred, 35mm eye level + suffix

**3 · interior-main (16:9)**
Interior of an intimate restaurant inside a long low limewashed brick barrel vault, one-point perspective looking straight down the room from the entrance, smoked-oak tables without tablecloths, curved oak chairs with dark olive leather seats, olive leather banquette along the left wall, low bronze pendant lamps creating pools of warm light, small candles in short glass holders, a travertine bar glowing at the far end, warm plaster walls, generous negative space, evening, empty room just before service, 35mm lens at eye level + suffix

**4 · bar (4:5)**
Long travertine bar counter in the same limewashed vaulted restaurant, blackened bronze shelving with bottles softly backlit, a single cocktail in a thin coupe on the stone, bronze foot rail, warm pools of light, dark olive leather bar stools, shallow depth of field, 50mm + suffix

**5 · table-signature (3:2, upscale ×2 afterwards)**
Restaurant table close-up from a 40-degree angle: on a dark smoked-oak table, a wide off-white speckled stoneware plate with a raw unglazed rim holding a pan-roasted Baltic cod fillet with golden caramelised crust, glossy brown butter sauce pooled around it with tiny dill-oil droplets, a charred leek half and a few small dill sprigs, refined minimal plating. Next to it a thin wine glass with white wine catching candlelight, a small candle in a short glass holder, an oxblood linen napkin and dark bronze cutlery. The plate is large in the frame and in sharp focus, background falls into warm darkness, 85mm lens, controlled warm side light + suffix

**7 · kitchen-hearth (4:5)**
Close detail in an open restaurant kitchen: chef's hands with tweezers placing a dill sprig on a plate at a pass made of dark steel, a wood-fired hearth glowing orange in the soft-focus background, smoke haze, warm firelight, faces out of frame, shallow depth of field, 50mm + suffix

**8 · dish-beetroot (4:5)** — Wood-roasted beetroot with whipped smoked curd, toasted rye crumb and tiny sorrel leaves on an off-white speckled stoneware plate on a smoked-oak table, 45-degree angle, candlelight + suffix

**9 · dish-duck (4:5)** — Sliced pink duck breast with sea-buckthorn glaze, celeriac purée and charred onion petals on an off-white speckled stoneware plate, smoked-oak table, 45-degree angle, warm side light + suffix

**10 · dish-dessert (4:5)** — Burnt honey custard in a small dark stoneware bowl with a quenelle of sour-cream ice cream and rye crumble, sea-buckthorn drops, smoked-oak table, candlelight, 45-degree angle + suffix

**11 · table-candle-detail (16:9)** — Late-evening table detail in the same restaurant: a burning candle in a short glass holder, a half-full glass of red wine, crumpled oxblood linen napkin on smoked oak, bokeh of bronze pendant lamps behind, very low key, mostly darkness + suffix

Consistency method: generate #1 first and use it as **style reference** for #2–#4, #11; generate #5 first among food and use it as style reference for #8–#10.

---

## 6. Quality gate (per image)
Reject: warped verticals, melted cutlery, deformed plate rims, impossible reflections, wrong shadow direction, repetitive textures, mushy food texture, text artifacts, any visible person's face.


---

## 7. Production log (what was actually made)

| File | Tool / model | Notes |
|---|---|---|
| exterior-blue-hour | ImagineArt · Flux 3 (2K), upscaled ×2 to 4096px (Higgsfield upscale) | Picked from 2 variants. The door is dead centre, which matters for the push-in |
| entrance-door | Higgsfield · Nano Banana Pro 4K, exterior as reference | Same door photographed closer, used for the match-cut |
| interior-main | Nano Banana Pro 4K, exterior + dish as references | One-point perspective, vanishing point centred |
| table-signature | Nano Banana Pro 2K | Source of the dish cut-out (GrabCut + ellipse/rim model) |
| bar, kitchen-hearth, table-candle-detail | Nano Banana Pro 2K, interior + dish as references | Kitchen plates the same signature dish, for narrative continuity |
| dish-beetroot, dish-duck, dish-dessert | Nano Banana Pro 2K, signature dish as reference | Same plate, table and light |

Magnific's upscaler on ImagineArt could not be used: the account's free daily ImagineArt credits ran out after the first generation round. The 4K hero upscale was done on Higgsfield instead.

Deviation from the bible, kept on purpose: the glimpse of the dining room through the street-facing glass shows white tablecloths, while the interior has bare oak. The detail is tiny and the interior is revealed through the doorway mask, so it never reads as a mismatch.
