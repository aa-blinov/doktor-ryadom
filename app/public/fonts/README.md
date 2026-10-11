# PDF report font

`report-manrope.ttf` embeds Manrope regular (400) in the locally generated report PDF. `report-manrope.json` stores glyph IDs, widths and vertical metrics for that exact font. Both assets are committed and precached; normal application builds need no Python tooling. Keep them together when regenerating.

Source: the installed `@fontsource/manrope` package, merging its Latin, Cyrillic, Cyrillic-ext and Latin-ext 400-normal WOFF subsets. The copied SIL Open Font License is [Manrope-LICENSE.txt](Manrope-LICENSE.txt).

Optional regeneration, from `app/`, after `npm ci`: install Python `fontTools` in a suitable environment, then run `python3 scripts/make-report-font.py`. The script also refreshes the license. The PDF does not claim universal glyph coverage: unavailable visual glyphs use a question mark, while ToUnicode preserves the original codepoint for text extraction.
