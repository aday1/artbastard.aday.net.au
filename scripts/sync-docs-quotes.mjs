import fs from "fs";
const s = fs.readFileSync("react-app/src/components/layout/FancyQuotes.tsx", "utf8");
const marker = "const luxuryQuotes: Quote[] = ";
const i0 = s.indexOf(marker);
if (i0 < 0) {
  console.error("sync-docs-quotes: luxuryQuotes not found");
  process.exit(1);
}
const i1 = i0 + marker.length;
const i2 = s.indexOf("\n];", i1);
if (i2 < 0) {
  console.error("sync-docs-quotes: end of array not found");
  process.exit(1);
}
const arrLiteral = s.slice(i1, i2 + 2);
const out =
  `/* Synced from react-app/src/components/layout/FancyQuotes.tsx (luxuryQuotes). Run: node scripts/sync-docs-quotes.mjs */\n` +
  `window.AB_LUXURY_QUOTES = ${arrLiteral};\n`;
fs.writeFileSync("DOCS/showcase-quotes-data.js", out);
console.log("sync-docs-quotes: wrote DOCS/showcase-quotes-data.js (" + out.length + " bytes)");
