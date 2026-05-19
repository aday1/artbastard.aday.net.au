# ArtBastard Showcase Notes

How the public showcase page is built, recorded, and deployed. Useful if you
want to rebuild it locally, change the demo reel, or audit the deploy path.

Last content refresh: 2026-05-19 (v5.15.0 feature grid: fixture-aware tracker,
tracker channel columns, live theme tuning; six-clip Photonic Tour). Website
feature grid mentions LAN / Pi bridge for cloud-hosted Art-Net on home LANs.

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
  showcase, the live app, and the demo reel.
- `/workspace/DOCS/index.html` - documentation index page (themed like the public showcase; embeds the same Luminary quote list as the ArtSnob `FancyQuotes` component).
- `/workspace/DOCS/showcase-quotes-data.js` - generated JavaScript bundle of `luxuryQuotes` from `react-app/src/components/layout/FancyQuotes.tsx`. Regenerate after editing quotes in the app:

```
node scripts/sync-docs-quotes.mjs
```

## How videos are produced

`scripts/capture-demo-videos.sh` runs an Xvfb display, launches
`google-chrome` against the live backend, and uses `ffmpeg`'s `x11grab`
to record each route into VP9 WebM. Posters are extracted with
`ffmpeg -vframes 1`.

The script:

1. Pre-seeds a Chrome `Default/Preferences` JSON in a temporary user-data
   dir granting `midi_sysex: 1` for the app origin so the consent popup
   never appears.
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
| `CAPTURE_FRAMERATE`     | 24            | Recording framerate                             |
| `CAPTURE_VBITRATE`      | 800k          | VP9 target bitrate                              |
| `CAPTURE_DURATION_SEC`  | per-clip      | Override every clip's duration                  |
| `CAPTURE_CLIP_LIST`     | (empty)       | Comma list of clip names to render              |
| `CAPTURE_DISPLAY_NUM`   | 99            | Xvfb display number                             |
| `CAPTURE_KEEP_SERVER`   | 0             | If 1, do not start the backend, just expect it  |

The script requires `Xvfb`, `ffmpeg`, `xdotool`, `google-chrome`, and
`curl` on PATH.

## Deploy path

The running DMX app is on Linode (GHCR image + Macroverse
`docker-compose.yml`), not Fly.io. Push `main` -> `artbastard-image` ->
`deploy-linode`.

GitHub Pages on this repo is configured as `legacy` source (branch =
`main`, path = `/`). That means the entire repository root is served
under `https://aday1.github.io/artbastard.aday.net.au/` for the static
showcase hub only.

Two URLs that matter:

- `https://aday1.github.io/artbastard.aday.net.au/` - the small hub page
  (root `/index.html`) with quick links to the live app, test app, and
  the demo reel.
- `https://aday1.github.io/artbastard.aday.net.au/website/` - the full
  showcase: hero, demo reel, feature cards, install steps, doc grid.

Two GitHub Actions workflows still upload Pages artifacts:

- `.github/workflows/deploy-website.yml` uploads `website/` to a Pages
  artifact on push to main.
- The branch-based legacy build also runs automatically.

Because Pages is in `legacy` mode, the Actions deployment artifact does
not override the branch-based deploy. Either:

1. Leave Pages in legacy mode and treat both URLs above as canonical.
2. Switch Pages source to "GitHub Actions" in the repo settings to make
   `website/` the root of the deployed site. The artifact pipeline
   (deploy-website.yml) is already wired for that switch.

(`pages.yml` was removed in this release because it conflicted on the
`pages` concurrency group with `deploy-website.yml` and pointed at a
docs folder with no index.)

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

## Updating the demo reel

The video tiles are in `<section id="tour">`. Add a new `<figure
class="video-tile">` (or `.video-tile.mobile` for portrait) referencing
the WebM and JPG you produced. The JPG is set as `poster=` and the WebM
URL goes in both `poster` neighbour and the `data-src` attribute that
`script.js` swaps in on intersection.

## Notes

- Total committed media in `website/videos/` is around 6 MB (six
  clips). VP9 keeps it small enough that the GitHub Pages tarball
  remains under the per-deploy quota.
- The showcase should never link to GitHub raw URLs for the videos; the
  whole point of `website/videos/` is that the deployed site serves them
  directly with proper caching.
