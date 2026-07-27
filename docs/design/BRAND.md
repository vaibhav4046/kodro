# Kodro visual identity

## The idea

Kodro turns an idea into a route a robot can follow. The mark is a routed
letter K:

- the upright stroke is the starting path;
- the split is a program decision;
- the two arms are possible routes;
- the gold circle is the decision or sensor reading that changes the route;
- the two small end nodes are destinations.

At 16 px it reads first as a bold K. At larger sizes the rounded route, joint
and destinations become visible. This order matters. A tab icon must identify
the product before it explains the metaphor.

The mark is not a robot face. Kodro supports rovers, cars, home robots and
arms, so a face or one vehicle would narrow the product. The routed K belongs
to the product rather than to one machine.

## Construction

The source is hand-authored SVG. It uses three rounded paths on a 512 by 512
grid and three circles. There are no traced points, filters or embedded raster
images.

The main geometry is:

- a 54 unit route stroke at 512 px;
- rounded caps and joins;
- a 34 unit central node;
- 17 unit destination nodes;
- a 112 unit corner radius on the full-colour app tile.

The maskable version pulls the whole mark further into the safe area. The
one-colour version removes the tile and uses solid black so colour can be
supplied by the system or by print production.

## Files

| File | Use |
| --- | --- |
| `src/robolearn/assets/web/icon.svg` | Full-colour browser and scalable app icon |
| `src/robolearn/assets/web/brand-icon-maskable.svg` | Maskable PWA icon |
| `src/robolearn/assets/web/brand-icon-monochrome.svg` | One-colour and system mask use |
| `src/robolearn/assets/web/brand-icon-192.png` | 192 px PWA and touch icon |
| `src/robolearn/assets/web/brand-icon-512.png` | 512 px PWA icon |

The in-app mark uses the same geometry on a 64 by 64 grid. It takes the current
theme accent as its route colour and the current brass token as its decision
node.

## Colour

The default identity uses:

| Role | Value | Meaning |
| --- | --- | --- |
| Deep ink | `#09111d` | Calm classroom backdrop and app icon tile |
| Route teal | `#62ddd0` | Movement, primary action and active state |
| Signal gold | `#ffd166` | Decision point, attention and warmth |
| Warm paper | `#f7f2e8` | Destination nodes and high contrast detail |

Inside the product, use theme tokens rather than fixing these hex values.
`--cyan` is the route and action colour. `--brass` is the signal colour.
`--fg-1`, `--fg-2` and `--fg-3` are the text hierarchy.

Gold is not a second primary action colour. Use it for a decision, waypoint or
small accent. The main action remains teal in the default theme.

## Clear space and size

Keep clear space around the free-standing mark equal to the width of its
upright stroke. Do not let text, a border or another icon enter that space.

- Minimum interface size: 16 px.
- Preferred navigation size: 24 to 32 px.
- Preferred front-door size: 64 px or larger.
- Use the maskable asset for launchers that crop icons into circles or other
  system shapes.

Do not add small text beside the mark below 24 px. It will not survive school
projectors, browser scaling or favicons.

## Wordmark

The product name is **Kodro**, with a capital K and lower-case remaining
letters. Do not use `KODRO` as the main wordmark. Uppercase is allowed in a
small navigation label where the type system already uses uppercase.

The routed K may appear alone when the product name is visible elsewhere or
the context is already established. On a first page, pair it with the word
Kodro.

## Icon family

Interface icons are hand-authored in `icons.jsx`.

- Grid: 24 by 24.
- Optical margin: 2 px.
- Stroke: 1.75 px.
- Caps and joins: round.
- Rectangular corner radius: 2 px.
- Fill: none, except circular route or sensor nodes.
- Colour: `currentColor`.

Every icon must remain understandable at 16 px. Use a simple silhouette and
remove detail before reducing the stroke. Do not mix emoji, platform symbols
or imported library icons into the main chrome.

## Liquid material

Liquid glass is an interface material, not a page background.

Use it for:

- the top toolbar;
- modal surfaces;
- popovers and menus;
- the telemetry drawer when it floats.

Do not use it for:

- body text containers;
- lesson instructions;
- worksheets or documentation;
- world controls, HUD chips or any other surface laid over an animating canvas.

Every liquid surface starts with a solid `--glass-solid` background. Blur is an
enhancement inside a feature query. When the renderer is active, modal,
popover and telemetry surfaces keep the solid background. Reduced-transparency
preferences also force the solid background.

Text on a liquid surface must use the normal foreground tokens. Do not lower
text opacity to make the surface look more translucent.

## Front door

The front page gives the four product routes equal truth but not equal visual
weight:

1. Learn to code is the recommended first route.
2. Design a robot is the making route.
3. Free play is the open exploration route.
4. Make a lesson is the teacher route.

The privacy and offline promise stays visible at first contact. The simulation
boundary also stays visible in the footer. Neither message is hidden behind a
disclosure control.

## Do not

- Do not redraw the route as sharp or square-ended lines.
- Do not move the gold node away from the junction.
- Do not replace the mark with a robot face, stock orbit or generic code
  bracket.
- Do not put the full-colour tile on a similar dark tile with no clear edge.
- Do not stretch, skew, rotate or outline the mark.
- Do not recolour individual route arms.
- Do not add shadows or glow to the one-colour version.
- Do not use blur over the live 3D viewport while it is animating.
- Do not use translucency as a reason to reduce text contrast.

## Accessibility

The mark never carries meaning that is absent from text. Product and button
names remain available to assistive technology. Interface icons are decorative
inside labelled controls.

The brand works in one colour, forced colours and print. Motion is not required
to understand it. The front door and all liquid surfaces respect reduced
motion and reduced transparency.
