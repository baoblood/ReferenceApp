RANDOM WORD GENERATOR

A lightweight, offline drawing-prompt generator. The editable word database
is word-library.json. generator.js contains generator logic only;
word-library-data.js is generated from the JSON for reliable file:// use.

RUN THE FINISHED APP
1. Keep index.html, style.css, generator.js, word-library.json, and
   word-library-data.js together in one folder.
2. Double-click index.html to open the app in a browser.
3. Choose 3, 4, or 5 words. Use GENERATE PROMPT for a new combination,
   REROLL to change one word, LOCK to preserve a word, and COPY to copy it.
4. To use the app from a USB drive, copy the complete folder and open
   index.html from that drive. No server or internet connection is needed.

ADD WORDS OR CATEGORIES
1. Open word-library.json in a plain-text editor.
2. Add words as quoted strings in a category's array, separated by commas.
   Example: add "Necromancer" to the "subjects" array.
3. To add a category, add a new property and array, for example:
   "music": ["Violin", "Drum", "Flute"]
   Make sure commas and quotation marks follow normal JSON syntax.
4. Empty categories are safely ignored. At least three non-empty categories
   are needed for a three-word prompt. Four- and five-word options are
   available when at least four or five non-empty categories are present.

AVOID DUPLICATES
The build step removes repeated words within each category without regard to
letter case. The generator also avoids duplicate words across categories in
the same prompt. If the same word appears in different categories, it remains
available in each category, but only one instance can appear in a prompt.

REBUILD THE EMBEDDED DATA
Whenever word-library.json changes, regenerate word-library-data.js before
sharing or running the updated app:

  Windows: py -3 build-word-library.py
  Other systems with Python 3: python3 build-word-library.py

The script checks the JSON, reports invalid category/word data, removes
within-category duplicates, and writes word-library-data.js. Fix any reported
error in word-library.json and run the command again. Python is only needed
for this optional rebuild step; the finished app does not use Python.

PORTABILITY
The app uses local HTML, CSS, and vanilla JavaScript only. It has no install,
server, internet, external fonts, libraries, APIs, or database requirement.
Keep the generated word-library-data.js beside index.html and generator.js;
it embeds the library so browsers can use the app directly from file://.
