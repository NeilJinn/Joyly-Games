# Joyly Games Assets

Replace these files to update the platform visuals without changing platform logic.

- `brand/joyly-logo-mark.svg`: lightweight paper-craft navigation logo.
- `brand/paper-hills-dark.svg`: dark-mode paper hills and confetti background used by platform surfaces.
- `games/<game-id>/cover.svg`: paper-craft game cover art used by game library cards, featured cards, and selected-game previews.

Current visual direction:

- Platform assets should stay lightweight and cacheable; prefer SVG for logos, paper hills, covers, icons, and decorative elements.
- Use raster images only when a generated texture or mascot illustration is essential.
- Keep avatar and character-picker assets separate from this platform refresh unless the character system is intentionally updated.

For future games, create a folder that matches the game id from the catalog, then add `cover.svg` or another image with the same purpose.
