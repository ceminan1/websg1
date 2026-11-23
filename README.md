# Safa G. — Personal website redesign

A responsive, static personal website for GitHub Pages. No build step, framework, or dependencies required.

## Files
- `index.html`: single-page homepage
- `about.html`: about page
- `timeline.html`: a simple journey page (legacy URL preserved)
- `static/style.css`: styles and responsive layout
- `static/app.js`: light/dark toggle and automatic copyright year
- `static/safa.mp4`: browser-friendly version of original Python video
- `static/Pics/icon.png`: existing favicon
- `tetris/`: original playable Tetris files
- `CNAME`: original custom-domain setting, unchanged

## Deploy to GitHub Pages
1. Create a backup of the existing repository or a new branch.
2. Upload **the contents of this folder** to the root of the GitHub Pages repository (not the enclosing folder).
3. Commit and push. GitHub Pages will publish from the configured branch/workflow.
4. Visit https://www.safa-g.com and verify the pages, video, and Tetris.

## Customize
- Main copy, projects, and buttons: edit `index.html`.
- Theme colors: edit variables at the top of `static/style.css`.
- Profile and story: edit `about.html` and `timeline.html`.
- Existing external portfolio is linked at `https://portfolio.safa-g.com/`.
- The GitHub URL is set to `https://github.com/ceminan1` based on the existing domain's CNAME target. Confirm this is your intended public profile before publishing.
- No email address was guessed. You can add your preferred contact address later.

## Notes
- The original Python MOV was converted to MP4 for browser compatibility.
- The Tetris files were kept as provided. The link now points to `tetris/tetris.html`.
- The old hostname in `CNAME` is preserved; do not change DNS while just refreshing the design.
