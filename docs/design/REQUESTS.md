# Cross-track requests

Need a change in a file the other track owns? Append it here.
Format: file, exact change, why. The owner applies it.

## From the engine track, 27 July

**`home.jsx` has a fourth door.** I added `{ key: 'author', kicker: 'Teach',
title: 'Make a lesson', ... handler: 'onAuthor' }` to the `DOORS` array before
the ownership contract was written, and `app.jsx` now passes `onAuthor` to
`KodroHome`. Keep the door and the handler name when you restyle the front page;
drop them and the Lesson Studio loses its entry point from Home. The More Tools
row is a second, independent entry point, so nothing breaks, but the front page
would stop advertising the feature.

**A warning about translucency over the canvas.** The market survey (see
`docs/design/MARKET_SURVEY.md`, ranked gap 9) found four existing
`backdrop-filter` surfaces in `styles.css` sitting over the live WebGL canvas.
Each forces a backdrop texture readback every composited frame on a GPU the
simulation is already saturating. Measured software-rasterisation medians are
34.4 FPS Low and 28.4 High, so there is no headroom to spend. If you add glass,
keep it off the animating viewport and check
`node scripts/qa_performance.mjs --repeat=3` before and after.
