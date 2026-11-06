"use strict";

const wordList = document.querySelector("#word-list");
const countSelect = document.querySelector("#word-count");
const generateButton = document.querySelector("#generate");
const copyButton = document.querySelector("#copy");
const message = document.querySelector("#message");

let categories = [];
let promptWords = [];
let lastCombination = "";
let messageTimer;

function showMessage(text, isError = false, persistent = false) {
  window.clearTimeout(messageTimer);
  message.textContent = text;
  message.classList.toggle("is-error", isError);
  if (text && !persistent) {
    messageTimer = window.setTimeout(() => {
      message.textContent = "";
      message.classList.remove("is-error");
    }, 3500);
  }
}

function disableControls() {
  countSelect.disabled = true;
  generateButton.disabled = true;
  copyButton.disabled = true;
}

function normalizeLibrary(library) {
  if (!library || typeof library !== "object" || Array.isArray(library)) {
    throw new Error("The embedded library must be a JSON object of category names and word arrays.");
  }

  const validCategories = [];
  const warnings = [];
  for (const [name, words] of Object.entries(library)) {
    if (!name.trim()) {
      warnings.push("A category with an empty name was ignored.");
      continue;
    }
    if (!Array.isArray(words)) {
      warnings.push(`Category "${name}" was ignored because its value must be an array.`);
      continue;
    }

    const seenWords = new Set();
    const uniqueWords = [];
    words.forEach((word, index) => {
      if (typeof word !== "string" || !word.trim()) {
        warnings.push(`Invalid word ${index + 1} in category "${name}" was ignored.`);
        return;
      }
      const cleanWord = word.trim().normalize("NFC");
      const key = cleanWord.toLocaleLowerCase();
      if (seenWords.has(key)) return;
      seenWords.add(key);
      uniqueWords.push(cleanWord);
    });

    if (uniqueWords.length > 0) {
      validCategories.push({
        key: name,
        label: name.replace(/[-_]+/g, " ").toLocaleUpperCase(),
        words: uniqueWords
      });
    }
  }

  if (validCategories.length < 3) {
    throw new Error("At least three non-empty categories with valid words are required.");
  }
  return { categories: validCategories, warnings };
}

function randomIndex(max) {
  if (window.crypto && window.crypto.getRandomValues) {
    const value = new Uint32Array(1);
    const limit = Math.floor(0x100000000 / max) * max;
    do {
      window.crypto.getRandomValues(value);
    } while (value[0] >= limit);
    return value[0] % max;
  }
  return Math.floor(Math.random() * max);
}

function shuffled(items) {
  const result = items.slice();
  for (let index = result.length - 1; index > 0; index -= 1) {
    const otherIndex = randomIndex(index + 1);
    [result[index], result[otherIndex]] = [result[otherIndex], result[index]];
  }
  return result;
}

function pickWord(category, usedWords, excludedWord = "") {
  const start = randomIndex(category.words.length);
  const excludedKey = excludedWord.toLocaleLowerCase();
  for (let offset = 0; offset < category.words.length; offset += 1) {
    const word = category.words[(start + offset) % category.words.length];
    const key = word.toLocaleLowerCase();
    if (!usedWords.has(key) && key !== excludedKey) return word;
  }
  return null;
}

function currentCount() {
  return Number(countSelect.value);
}

function combinationOf(words) {
  return words.map((item) => item.word.toLocaleLowerCase()).join("\u0000");
}

function rememberCombination() {
  lastCombination = combinationOf(promptWords.slice(0, currentCount()));
}

function renderWords(animateIndexes = []) {
  const count = currentCount();
  wordList.dataset.count = String(count);
  wordList.replaceChildren();

  promptWords.slice(0, count).forEach((item, index) => {
    const card = document.createElement("article");
    card.className = "word-card";
    if (item.locked) card.classList.add("is-locked");
    if (animateIndexes.includes(index)) card.classList.add("is-shuffling");

    const top = document.createElement("div");
    top.className = "word-card-top";

    const category = document.createElement("span");
    category.className = "word-category";
    category.textContent = item.category.label;

    const number = document.createElement("span");
    number.className = "word-index";
    number.textContent = String(index + 1).padStart(2, "0");

    const value = document.createElement("div");
    value.className = "word-value";
    value.textContent = item.word.toLocaleUpperCase();

    const actions = document.createElement("div");
    actions.className = "word-actions";

    const rerollButton = document.createElement("button");
    rerollButton.type = "button";
    rerollButton.textContent = "↻ REROLL";
    rerollButton.setAttribute("aria-label", `Reroll ${item.category.label.toLocaleLowerCase()} word`);
    rerollButton.disabled = item.locked;
    rerollButton.addEventListener("click", () => rerollWord(index));

    const lockButton = document.createElement("button");
    lockButton.type = "button";
    lockButton.textContent = item.locked ? "● LOCKED" : "○ LOCK";
    lockButton.setAttribute("aria-pressed", String(item.locked));
    lockButton.setAttribute("aria-label", `${item.locked ? "Unlock" : "Lock"} ${item.category.label.toLocaleLowerCase()} word`);
    lockButton.addEventListener("click", () => toggleLock(index));

    top.append(category, number);
    actions.append(rerollButton, lockButton);
    card.append(top, value, actions);
    wordList.append(card);
  });
}

function makePrompt(lockedItems, count, previousCombination) {
  const lockedCategories = new Set(lockedItems.map((item) => item.category.key));
  const unlockedCount = count - lockedItems.length;
  const availableCategories = categories.filter((category) => !lockedCategories.has(category.key));
  if (availableCategories.length < unlockedCount) return null;

  const categoryChoices = shuffled(availableCategories).slice(0, unlockedCount);
  const slots = [];
  let nextCategory = 0;
  for (let index = 0; index < count; index += 1) {
    const lockedItem = lockedItems.find((item) => item.index === index);
    if (lockedItem) {
      slots.push({ category: lockedItem.category, word: lockedItem.word, locked: true });
    } else {
      slots.push({ category: categoryChoices[nextCategory], word: "", locked: false });
      nextCategory += 1;
    }
  }

  const usedWords = new Set();
  for (const item of slots) {
    if (!item.locked) continue;
    const key = item.word.toLocaleLowerCase();
    if (usedWords.has(key)) return null;
    usedWords.add(key);
  }

  for (const item of slots) {
    if (item.locked) continue;
    item.word = pickWord(item.category, usedWords);
    if (!item.word) return null;
    usedWords.add(item.word.toLocaleLowerCase());
  }
  return combinationOf(slots) === previousCombination ? null : slots;
}

function generatePrompt() {
  const count = currentCount();
  const currentWords = promptWords.slice(0, count);
  const previousCombination = combinationOf(currentWords);
  const lockedItems = currentWords
    .map((item, index) => ({ ...item, index }))
    .filter((item) => item.locked);

  if (lockedItems.length === count) {
    showMessage("All words are locked.");
    return;
  }

  let nextWords = null;
  for (let attempt = 0; attempt < 60 && !nextWords; attempt += 1) {
    nextWords = makePrompt(lockedItems, count, previousCombination)
      || (lastCombination !== previousCombination
        ? makePrompt(lockedItems, count, lastCombination)
        : null);
  }

  if (!nextWords) {
    showMessage("Could not make a different unique prompt. Add more distinct words to word-library.json and rebuild the embedded data.", true, true);
    return;
  }

  promptWords = nextWords;
  rememberCombination();
  renderWords(promptWords.map((item, index) => item.locked ? -1 : index).filter((index) => index >= 0));
  showMessage("");
}

function rerollWord(index) {
  const item = promptWords[index];
  if (!item || item.locked) return;

  const usedWords = new Set(
    promptWords.slice(0, currentCount())
      .filter((word, wordIndex) => wordIndex !== index)
      .map((word) => word.word.toLocaleLowerCase())
  );
  const replacement = pickWord(item.category, usedWords, item.word);
  if (!replacement) {
    showMessage("No other unique words are available in this category.", true);
    return;
  }
  item.word = replacement;
  rememberCombination();
  renderWords([index]);
  showMessage("");
}

function toggleLock(index) {
  if (!promptWords[index]) return;
  promptWords[index].locked = !promptWords[index].locked;
  renderWords();
}

async function copyPrompt() {
  const text = promptWords.slice(0, currentCount())
    .map((item) => item.word.toLocaleUpperCase())
    .join(" / ");
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      const temporaryInput = document.createElement("textarea");
      temporaryInput.value = text;
      temporaryInput.setAttribute("readonly", "");
      temporaryInput.style.position = "fixed";
      temporaryInput.style.opacity = "0";
      document.body.append(temporaryInput);
      temporaryInput.select();
      const copied = document.execCommand("copy");
      temporaryInput.remove();
      if (!copied) throw new Error("The browser could not copy the prompt.");
    }
    showMessage("Prompt copied to clipboard.");
  } catch (error) {
    showMessage("Could not copy automatically. Select and copy the words.", true);
    console.error("Copying the prompt failed:", error);
  }
}

function updateCountOptions() {
  for (const option of countSelect.options) {
    option.disabled = Number(option.value) > categories.length;
  }
}

function changeWordCount() {
  const count = currentCount();
  const usedCategories = new Set(promptWords.map((item) => item.category.key));
  while (promptWords.length < count) {
    const availableCategories = categories.filter((category) => !usedCategories.has(category.key));
    const category = shuffled(availableCategories)[0];
    if (!category) {
      showMessage("Not enough non-empty categories. Add categories to word-library.json and rebuild the embedded data.", true, true);
      return;
    }
    const usedWords = new Set(promptWords.map((item) => item.word.toLocaleLowerCase()));
    const word = pickWord(category, usedWords);
    if (!word) {
      showMessage("Could not find a unique word. Add more distinct words to word-library.json and rebuild the embedded data.", true, true);
      return;
    }
    promptWords.push({ category, word, locked: false });
    usedCategories.add(category.key);
  }
  rememberCombination();
  renderWords();
  showMessage("");
}

function initialize() {
  const library = window.WORD_LIBRARY_DATA;
  if (typeof library === "undefined") {
    throw new Error("The embedded word library is missing. Check word-library.json and run build-word-library.py to regenerate word-library-data.js.");
  }

  const normalized = normalizeLibrary(library);
  categories = normalized.categories;
  updateCountOptions();

  const initialPrompt = makePrompt([], currentCount(), "");
  if (!initialPrompt) {
    throw new Error("The word library does not contain enough distinct words across its categories to make a three-word prompt.");
  }
  promptWords = initialPrompt;
  rememberCombination();
  renderWords();

  if (normalized.warnings.length > 0) {
    showMessage(`Some invalid entries were ignored. Fix word-library.json and rebuild word-library-data.js. ${normalized.warnings[0]}`, true, true);
  }
}

countSelect.addEventListener("change", changeWordCount);
generateButton.addEventListener("click", generatePrompt);
copyButton.addEventListener("click", copyPrompt);
document.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && event.target !== countSelect && event.target.tagName !== "BUTTON") {
    generatePrompt();
  }
});

try {
  initialize();
} catch (error) {
  disableControls();
  showMessage(`${error.message} Fix the library file and rebuild the embedded data.`, true, true);
  console.error("The word generator could not initialize:", error);
}
