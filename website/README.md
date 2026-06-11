# ArtBastard DMX512 Website

This is the official website for ArtBastard DMX512, automatically deployed via GitHub Actions.

## Setup

1. Enable GitHub Pages in your repository settings
2. Set the source to "GitHub Actions"
3. The website will automatically deploy when changes are pushed to the `website/` directory

## Customization

- Update `index.html` to modify content
- Update `styles.css` to change the design
- Update `script.js` for interactive features

The GitHub Actions workflow will automatically replace `yourusername` with your actual GitHub username when deploying.

## Local Development

Simply open `index.html` in a browser or use a local server:

```bash
cd website
python -m http.server 8000
```

Then visit `http://localhost:8000`

