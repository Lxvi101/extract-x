# Contributing to X Comment Scraper

Thank you for taking the time to contribute! 🎉

## Getting started

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/your-username/x-comment-scraper.git
   cd x-comment-scraper
   ```
3. Load the extension in Chrome:  
   `chrome://extensions` → Developer mode ON → Load unpacked → select the folder

No build tools needed — just edit the files and reload the extension.

## How to reload after changes

- In `chrome://extensions`, click the **refresh icon** on the extension card
- Then close and reopen the popup (or reload the x.com tab for `content.js` changes)

## Reporting bugs

Please include:
- Chrome version (`chrome://settings/help`)
- The tweet URL you were scraping (or a similar public one)
- What happened vs. what you expected
- Any errors from the DevTools console (`F12` → Console)

## Suggesting features

Open an issue with the `enhancement` label. Describe the use case, not just the feature.

## Pull requests

- Keep PRs focused — one change per PR
- Add a clear description of what changed and why
- Test against a real X thread before submitting
- Don't introduce external dependencies (this project is intentionally zero-dependency)

## Selector breakage

X frequently changes its CSS class names. If the scraper stops extracting data:

1. Open DevTools on a tweet page
2. Inspect a reply `<article>` and find the new `data-testid` attributes
3. Update the selectors in `content.js`
4. Open a PR with the fix — these are always welcome

## Code style

- Plain ES2020+ JavaScript, no transpiler
- 2-space indentation
- Prefer `const` / `let`, no `var`
- Keep functions small and named descriptively

## License

By contributing you agree that your contributions will be licensed under the [MIT License](LICENSE).
