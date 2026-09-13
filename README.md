# Esnad Group Holding — Website

Static site (no build step) for Esnad Group Holding, featuring a layered SVG
parallax skyline in the hero.

## Structure

- `index.html` — all page content and sections
- `css/style.css` — styles, theme tokens, responsive layout
- `js/main.js` — parallax, scroll-reveal, mobile nav, project filters, counters

## Running locally

Any static server works, e.g.:

```
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Notes for editors

- Project cards, subsidiary/company blurbs and figures in the "Numbers"
  section are drawn from current public company content. Update
  `index.html` directly to add/remove projects (each project card needs a
  `data-country` of `BH`, `AE`, or `SA` to work with the filter buttons).
- The contact form (`#contactForm`) is front-end only — it shows a
  confirmation message but does not send anywhere. Wire it to a form
  backend/service before relying on it.
- Parallax and scroll-reveal automatically disable for users with
  `prefers-reduced-motion` enabled.
