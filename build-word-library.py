#!/usr/bin/env python3
"""Embed the editable word-library.json for use from file:// URLs."""

import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "word-library.json"
OUTPUT = ROOT / "word-library-data.js"


def load_library():
    try:
        with SOURCE.open("r", encoding="utf-8") as library_file:
            library = json.load(library_file)
    except FileNotFoundError as error:
        raise ValueError(f"Missing {SOURCE.name}.") from error
    except json.JSONDecodeError as error:
        raise ValueError(
            f"{SOURCE.name} has invalid JSON at line {error.lineno}, "
            f"column {error.colno}: {error.msg}"
        ) from error

    if not isinstance(library, dict):
        raise ValueError(f"{SOURCE.name} must contain a JSON object of categories.")

    cleaned = {}
    for category, words in library.items():
        if not isinstance(category, str) or not category.strip():
            raise ValueError("Every category must have a non-empty string name.")
        if not isinstance(words, list):
            raise ValueError(f"Category {category!r} must contain an array of words.")

        unique_words = []
        seen = set()
        for index, word in enumerate(words, start=1):
            if not isinstance(word, str) or not word.strip():
                raise ValueError(
                    f"Word {index} in category {category!r} must be a non-empty string."
                )
            clean_word = word.strip()
            key = clean_word.casefold()
            if key not in seen:
                seen.add(key)
                unique_words.append(clean_word)
        cleaned[category] = unique_words

    non_empty = sum(bool(words) for words in cleaned.values())
    if non_empty < 3:
        raise ValueError("At least three non-empty categories are required.")
    return cleaned


def main():
    try:
        library = load_library()
        serialized = json.dumps(library, ensure_ascii=True, separators=(",", ":"))
        with OUTPUT.open("w", encoding="utf-8", newline="\n") as output_file:
            output_file.write(
                '"use strict";\nwindow.WORD_LIBRARY_DATA = '
                + serialized
                + ";\n"
            )
    except (OSError, ValueError) as error:
        print(f"Could not build {OUTPUT.name}: {error}", file=sys.stderr)
        return 1

    word_count = sum(len(words) for words in library.values())
    print(
        f"Built {OUTPUT.name} with {word_count} unique words "
        f"in {sum(bool(words) for words in library.values())} non-empty categories."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
