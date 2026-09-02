# Third-party components vendored here

Every file in this directory is a third-party work, vendored so the web studio
runs with no network. Nothing here was written for Kodro. The licences below
are those published by each project; the licence texts are available at the
URLs given.

| File(s) | Project | Licence |
|---|---|---|
| `react.production.min.js`, `react-dom.production.min.js` | React and ReactDOM (Meta Platforms, Inc. and contributors) | MIT, https://github.com/facebook/react/blob/main/LICENSE |
| `babel.min.js` | @babel/standalone (Babel contributors) | MIT, https://github.com/babel/babel/blob/main/LICENSE |
| `three.min.js` | Three.js r137 (three.js authors) | MIT, https://github.com/mrdoob/three.js/blob/dev/LICENSE |
| `fonts.css`, `fonts/*.ttf` | Atkinson Hyperlegible (Braille Institute of America), Cormorant Garamond (Christian Thalmann), Inter Tight (Rasmus Andersson), JetBrains Mono (JetBrains) | SIL Open Font License 1.1, https://openfontlicense.org |

The bundle that ships in the parent directory is compiled from Kodro's own
JSX sources against these libraries and carries the project's MIT licence;
the libraries themselves keep the licences above.
