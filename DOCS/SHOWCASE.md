# ArtBastard Showcase Notes

How the public showcase page is built, recorded, and deployed. Useful if you
want to rebuild it locally, change the operator videos, or audit the deploy
path.

Last content refresh: 2026-06-14 (v5.2.13.0: server-owned joined ROLI
Lightpad topology, deterministic XY/colour pad roles, per-pad LED ACK queues,
clean crosshair and colour-strip drawing, plus the v5.2.12.0 APC40 ON/OFF
state semantics, BPM header dashboard, SuperControl layout remaster,
cream/synthwave light theme, footer monitor controls, canvas-first stage
fixture setup, fixture-aware scene and ACT seed templates, REC then Clip scene
saves, Device Control gobo roles, mobile showcase layout, and six-clip
operator how-to tour).
Website feature grid mentions the stage canvas, seed workflow, and LAN / Pi
bridge for cloud-hosted Art-Net on home LANs.

Act timeline docs (transport vs BPM vs Link, gaps, editing): DOCS/ACT_TIMELINE.md
and in-app Help → Act Timeline tab (mirrored in DOCS/HELP.md §8b).

## Where the showcase lives

- `/workspace/website/index.html` - the public landing page (hero, demo
  reel, feature grid, install steps, doc links, footer).
- `/workspace/website/styles.css` - all styles. Variables at the top, video
  grid styles bottom of file.
- `/workspace/website/script.js` - small bootstrap: lazy video loading,
  smooth scroll, navbar darken-on-scroll, latest-version fetch from
  `api.github.com/repos/aday1/artbastard.aday.net.au/releases/latest`.
- `/workspace/website/videos/*.webm` + `.jpg` - demo clips and posters.
- `/workspace/index.html` - tiny GitHub Pages entrypoint that links the
  showcase, the live app, and the operator video tour.
- `/workspace/DOCS/index.html` - documentation index page (themed like the public showcase; embeds the same Luminary quote list as the ArtSnob `FancyQuotes` component).
- `/workspace/DOCS/showcase-quotes-data.js` - generated JavaScript bundle of `luxuryQuotes` from `react-app/src/components/layout/FancyQuotes.tsx`. Regenerate after editing quotes in the app:

```
node scripts/sync-docs-quotes.mjs
```

## How videos are produced

`scripts/capture-demo-media.mjs` launches Chrome or Edge through the
DevTools protocol, renders each route against the live backend, captures
JPEG frame sequences, and uses `ffmpeg` to encode VP9 WebM clips. Posters
are copied from the first captured frame.

The committed videos are silent operator walkthroughs. The showcase captions
explain the lesson for each clip: place fixtures on the stage canvas, drive
DMX/Super Control, capture scenes and APC40 deck slots, sequence ACTs,
operate mobile, and configure settings/help.

The script:

1. Starts `dist/server.js` if `BASE_URL` is not already healthy.
2. Records each clip in the matrix (route, viewport, duration,
   interactions). Mobile clip uses 430x932; everything else 1280x720.
3. Writes results to `website/videos/capture-results.txt` (gitignored).

Re-run with:

```
npm run demo:capture-videos
```

Override behaviour with environment variables:

| Variable                | Default       | Effect                                          |
| ----------------------- | ------------- | ----------------------------------------------- |
| `CAPTURE_FRAMERATE`     | 12            | Recording framerate                             |
| `CAPTURE_VBITRATE`      | 800k          | VP9 target bitrate                              |
| `CAPTURE_DURATION_SEC`  | per-clip      | Override every clip's duration                  |
| `CAPTURE_CLIP_LIST`     | (empty)       | Comma list of clip names to render              |
| `CAPTURE_CHROME`        | auto-detect   | Chrome/Edge executable path                     |
| `CAPTURE_FFMPEG`        | auto-detect   | ffmpeg executable path                          |
| `CAPTURE_BASE_URL`      | 127.0.0.1:3030| Backend URL                                     |

Screenshots require Chrome/Edge. Videos require Chrome/Edge plus ffmpeg.

## Deploy path

The running DMX app is on Linode (GHCR image + Macroverse
`docker-compose.yml`), not Fly.io. Push `main` -> `artbastard-image` ->
`deploy-linode`.

GitHub Pages deploys via `.github/workflows/deploy-website.yml`: source
files live in `website/` in the repo but are copied to the site root on
deploy. `/DOCS/` is served alongside.

Canonical URL:

- `https://aday1.github.io/artbastard.aday.net.au/` - full showcase
  (hero, how-to videos, feature cards, install steps, doc grid, Luminary wall).
- `https://aday1.github.io/artbastard.aday.net.au/DOCS/` - documentation hub.
- `/website/` on the deployed site redirects to `/` for old bookmarks.

## Local preview

You don't need any tooling to preview the showcase. Just open
`website/index.html` in a browser. The lazy-load script swaps in the
WebM `<source>` when each tile scrolls into view.

If you want a screenshot for review:

```
google-chrome --headless --no-sandbox --disable-gpu \
  --user-data-dir=/tmp/chrome-preview \
  --window-size=1280,1000 \
  --screenshot=/tmp/showcase.png \
  "file://$(pwd)/website/index.html"
```

## Updating the feature grid

Cards are plain HTML inside `<section id="features">`. Each card uses an
HTML entity for the icon (`&#127916;` etc.) instead of literal emoji so the
file is reliable to commit and edit on every editor / OS combination.
Drop a new `<div class="feature-card">` in the grid to add a feature.

## Updating the operator videos

The video tiles are in `<section id="tour">`. Add a new `<figure
class="video-tile">` (or `.video-tile.mobile` for portrait) referencing
the WebM and JPG you produced. The JPG is set as `poster=` and the WebM
URL goes in both `poster` neighbour and the `data-src` attribute that
`script.js` swaps in on intersection.

## Notes

- Current committed tour media in `website/videos/` is about 3.5 MB
  for six VP9 clips plus JPG posters. VP9 keeps it small enough that
  the GitHub Pages tarball remains under the per-deploy quota.
- The showcase should never link to GitHub raw URLs for the videos; the
  whole point of `website/videos/` is that the deployed site serves them
  directly with proper caching.
