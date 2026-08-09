Default pixel character assets for the frontend prototype.

## Generated assets

- `candidate-male-01.png` through `candidate-male-04.png`: generic male civic candidate presets for ages under 40, 40–49, 50–59, and 60+.
- `candidate-female-01.png` through `candidate-female-04.png`: generic female civic candidate presets for the same four age groups.
- `xiezhi-mascot.png`: original Xiezhi mascot source used during the initial integration.
- `candidate-unknown.png`: legacy unknown/undisclosed candidate silhouette.
- `data-principles-guide.png`: legacy data-principles guide character.
- `default-civic-sprite-sheet-source.png`: generated chroma-key source sheet used to derive the transparent sprites.

These are generic UI placeholders and are not intended to resemble real people.

## Xiezhi mascot poses

Reusable transparent mascot assets live in `xiezhi/`:

- `idle`: default mascot and incomplete-data fallback.
- `blink`: subtle idle animation frame.
- `hop`: lively or success state.
- `play`: playful engagement state.
- `sign-info`: blank navy information sign.
- `sign-warning`: blank amber warning sign.

Sign text must remain live HTML and follow the active locale. Short labels may show Chinese and English together; longer copy should show only the active language. Do not bake words into the image.

## Default candidate selection

- Complete gender and full birth date: select the corresponding gender and age-group sprite.
- Missing or unknown gender: use the Xiezhi mascot.
- Missing or incomplete birth date: use the Xiezhi mascot.

Xiezhi is an ancient Chinese mythical beast associated with justice, discernment, and impartiality. When used as a fallback portrait, it only means that the person's gender or exact birth date is unavailable; it does not imply any judgment about that person.
