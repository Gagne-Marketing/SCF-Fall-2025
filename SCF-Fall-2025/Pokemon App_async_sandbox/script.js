// ===== DOM refs =====
const listElement = document.getElementById("pokemon-list");
const paginationElement = document.getElementById("pagination");
const resultsInfoElement = document.getElementById("results-info");
const resultCountEl = document.getElementById("resultCount");
const indexProgressEl = document.getElementById("indexProgress");
const indexNoteEl = document.getElementById("indexNote");

const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");
const sortSelect = document.getElementById("sortSelect");
const datalistEl = document.getElementById("pokemonNames");

// Filters
const clearFiltersBtn = document.getElementById("clearFilters");
const applyFiltersBtn = document.getElementById("applyFilters");
const resetSectionBtn = document.getElementById("resetSection");

const typeChipsEl = document.getElementById("typeChips");
const speedSelect = document.getElementById("speedSelect");
const strengthSelect = document.getElementById("strengthSelect");
const toughnessSelect = document.getElementById("toughnessSelect");

// Size radios
const heightRadios = document.querySelectorAll('input[name="heightBucket"]');
const weightRadios = document.querySelectorAll('input[name="weightBucket"]');

const modal = new bootstrap.Modal(document.getElementById("pokemonModal"));
const modalEl = document.getElementById("pokemonModal");
const modalTitle = document.getElementById("pokemonModalLabel");
const modalBody = document.getElementById("pokemon-details");
const modalPrev = document.getElementById("modalPrev");
const modalNext = document.getElementById("modalNext");

// ===== State =====
const PAGE_SIZE = 20;
let allResults = [];          // full list [{id, name, url}]
let currentSort = "name-asc"; // "name-asc" | "name-desc"
let currentPage = 1;          // 1-based
let totalCount = 0;

let filteredResults = [];     // results after filters (ids/names)
let modalGlobalIndex = -1;

// Details cache & indexing
const detailsCache = new Map();   // id -> detail json
let indexedCount = 0;

// Common types to show as chips
const COMMON_TYPES = ["fire","water","grass","electric","rock","flying","psychic","fairy","fighting","dragon"];
// Put near COMMON_TYPES:
const TYPE_ICONS = {
  fire: "🔥",
  water: "💧",
  grass: "🍃",
  electric: "⚡",
  rock: "🪨",
  flying: "🪽",
  psychic: "🧠",
  fairy: "🧚",
  fighting: "🥊",
  dragon: "🐉",
  // (Optional extras if you add more chips later)
  bug: "🐛",
  ghost: "👻",
  ground: "🌋",
  ice: "🧊",
  poison: "☠️",
  steel: "⚙️",
  dark: "🌑",
  normal: "⭐"
};

// ===== Helpers =====
function getIdFromUrl(url) {
  const parts = url.split("/").filter(Boolean);
  return parseInt(parts[parts.length - 1], 10);
}
function titleCase(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
function debounce(fn, wait = 200) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
}
function dmToMeters(dm) { return (dm ?? 0) / 10; }
function hgToKg(hg) { return (hg ?? 0) / 10; }

// Simple similarity for autocomplete
function levenshtein(a, b) {
  if (a === b) return 0;
  const al = a.length, bl = b.length;
  if (al === 0) return bl; if (bl === 0) return al;
  const dp = Array.from({length: bl+1}, (_,j)=>j);
  for (let i=1;i<=al;i++){
    let prev = dp[0]; dp[0] = i;
    for (let j=1;j<=bl;j++){
      const temp = dp[j];
      dp[j] = Math.min(
        dp[j] + 1,
        dp[j-1] + 1,
        prev + (a[i-1] === b[j-1] ? 0 : 1)
      );
      prev = temp;
    }
  }
  return dp[bl];
}
function similarityScore(name, query) {
  const n = name.toLowerCase(), q = query.toLowerCase();
  if (!q) return 0;
  if (n.startsWith(q)) return -1000 + (n.length - q.length);
  if (n.includes(q))  return -500 + n.indexOf(q);
  return levenshtein(n, q);
}

// ===== Data load (fetch full list once) =====
async function loadAllPokemonList() {
  const url = "https://pokeapi.co/api/v2/pokemon?limit=2000&offset=0";
  listElement.innerHTML = `<li class="list-group-item text-center">Loading full Pokédex…</li>`;
  paginationElement.innerHTML = "";
  resultsInfoElement.textContent = "";
  resultCountEl.textContent = "Loading Pokédex…";

  const res = await fetch(url);
  const data = await res.json();

  allResults = data.results
    .map((p) => ({ id: getIdFromUrl(p.url), name: p.name, url: p.url }))
    .filter((p) => Number.isFinite(p.id));

  // Default sort A–Z
  allResults.sort((a,b)=>a.name.localeCompare(b.name));
  currentSort = "name-asc";

  // Initially, filtered set = all
  filteredResults = allResults.slice();
  totalCount = filteredResults.length;

  // Render
  renderList();
  renderPagination();
  updateCountsLabel();

  // Build types UI
  renderTypeChips();

  // Initialize autocomplete
  updateDatalist("");

  // Start background indexing of details for filtering
  startIndexingDetails();
}

// ===== Index details in background with a small pool =====
async function startIndexingDetails(concurrency = 24) {
  indexNoteEl.textContent = "Preparing filters…";
  const queue = allResults.slice(); // copy
  let inFlight = 0;

  return new Promise((resolve) => {
    const next = () => {
      if (!queue.length && inFlight === 0) {
        indexNoteEl.textContent = "Filters ready.";
        indexProgressEl.style.width = "100%";
        resolve();
        return;
      }
      while (inFlight < concurrency && queue.length) {
        const p = queue.shift();
        inFlight++;
        getDetails(p.id).finally(() => {
          inFlight--;
          indexedCount++;
          const pct = Math.round((indexedCount / allResults.length) * 100);
          indexProgressEl.style.width = pct + "%";
          if (pct < 100) indexNoteEl.textContent = `Indexing… ${pct}%`;
          next();
        });
      }
    };
    next();
  });
}

async function getDetails(id) {
  if (detailsCache.has(id)) return detailsCache.get(id);
  const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
  const data = await res.json();
  detailsCache.set(id, data);
  return data;
}

// ===== Filters =====
function renderTypeChips() {
  typeChipsEl.innerHTML = COMMON_TYPES.map((t, idx) => {
    const icon = TYPE_ICONS[t] || "🔹";
    const id = `type_${idx}`;
    return `
      <div class="form-check form-check-inline align-items-center">
        <input class="form-check-input" type="checkbox" id="${id}" value="${t}">
        <label class="form-check-label" for="${id}">
          <span class="me-1" aria-hidden="true">${icon}</span>${titleCase(t)}
        </label>
      </div>
    `;
  }).join("");
}

function readActiveFilters() {
  const types = Array.from(typeChipsEl.querySelectorAll('input[type="checkbox"]:checked')).map(i=>i.value);

  const heightBucket = Array.from(heightRadios).find(r => r.checked)?.value || "any";
  const weightBucket = Array.from(weightRadios).find(r => r.checked)?.value || "any";

  const speed = speedSelect.value;       // any | fast | veryfast
  const strength = strengthSelect.value; // any | medium | high
  const toughness = toughnessSelect.value; // any | medium | high

  return { types, heightBucket, weightBucket, speed, strength, toughness };
}

function matchesBuckets(heightM, weightKg, heightBucket, weightBucket) {
  let okH = true, okW = true;

  if (heightBucket === "small") okH = heightM <= 1.0;
  else if (heightBucket === "medium") okH = heightM > 1.0 && heightM <= 2.0;
  else if (heightBucket === "tall") okH = heightM > 2.0;

  if (weightBucket === "light") okW = weightKg <= 20;
  else if (weightBucket === "medium") okW = weightKg > 20 && weightKg <= 100;
  else if (weightBucket === "heavy") okW = weightKg > 100;

  return okH && okW;
}

function matchesStats(stats, speed, strength, toughness) {
  const get = (n) => stats.find(s => s.stat.name === n)?.base_stat || 0;
  const hp = get("hp");
  const atk = get("attack");
  const def = get("defense");
  const spa = get("special-attack");
  const spd = get("special-defense");
  const spe = get("speed");

  // Speed thresholds
  if (speed === "fast" && spe < 100) return false;
  if (speed === "veryfast" && spe < 130) return false;

  // Strength: use the higher of Atk/SpA
  const pow = Math.max(atk, spa);
  if (strength === "medium" && pow < 90) return false;
  if (strength === "high" && pow < 120) return false;

  // Toughness: HP + max(Def, SpD)
  const tough = hp + Math.max(def, spd);
  if (toughness === "medium" && tough < 220) return false;
  if (toughness === "high" && tough < 280) return false;

  return true;
}

function applyFilters() {
  const { types, heightBucket, weightBucket, speed, strength, toughness } = readActiveFilters();

  // Filter using cached details; skip entries not indexed yet
  const out = [];
  for (const p of allResults) {
    const d = detailsCache.get(p.id);
    if (!d) continue; // not indexed yet; it will appear as indexing completes

    // Type filter: OR within types
    if (types.length) {
      const pTypes = d.types.map(t => t.type.name);
      const hasAny = types.some(t => pTypes.includes(t));
      if (!hasAny) continue;
    }

    // Size buckets
    const heightM = dmToMeters(d.height);
    const weightKg = hgToKg(d.weight);
    if (!matchesBuckets(heightM, weightKg, heightBucket, weightBucket)) continue;

    // Stats thresholds
    if (!matchesStats(d.stats, speed, strength, toughness)) continue;

    out.push({ id: p.id, name: p.name, url: p.url });
  }

  filteredResults = out.length ? out : []; // if none match, show empty
  totalCount = filteredResults.length;
  currentPage = 1;
  renderList();
  renderPagination();
  updateCountsLabel();
}

function clearFilters() {
  // Uncheck types
  typeChipsEl.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
  // Reset radios
  document.getElementById("hAny").checked = true;
  document.getElementById("wAny").checked = true;
  // Reset selects
  speedSelect.value = "any";
  strengthSelect.value = "any";
  toughnessSelect.value = "any";

  // Reset data view
  filteredResults = allResults.slice();
  totalCount = filteredResults.length;
  currentPage = 1;
  renderList();
  renderPagination();
  updateCountsLabel();
}

// Presets
const PRESETS = {
  fast: { speed: "fast" },
  tough: { toughness: "high" },
  strong: { strength: "high" },
  balanced: {}, // optional: could set medium thresholds for all
  cute: { heightBucket: "small", weightBucket: "light" }
};
function applyPreset(name) {
  const p = PRESETS[name];
  if (!p) return;

  // Reset first
  clearFilters();

  // Apply preset values to controls
  if (p.speed) speedSelect.value = p.speed;
  if (p.toughness) toughnessSelect.value = p.toughness;
  if (p.strength) strengthSelect.value = p.strength;
  if (p.heightBucket) document.getElementById("hSmall").checked = true;
  if (p.weightBucket) document.getElementById("wLight").checked = true;

  applyFilters();
}

// ===== Rendering (list/pagination/labels) =====
function renderList() {
  const source = filteredResults.length ? filteredResults : [];
  const startIdx = (currentPage - 1) * PAGE_SIZE;
  const pageItems = source.slice(startIdx, startIdx + PAGE_SIZE);

  if (!pageItems.length) {
    listElement.innerHTML = "";
    resultsInfoElement.textContent = "No results. Try removing a filter.";
    return;
  }

  // Entire list item is clickable (name only)
  listElement.innerHTML = pageItems
    .map(
      (pokemon, i) => `
      <li class="list-group-item list-group-item-action"
          role="button" tabindex="0" data-open="${i}">
        ${titleCase(pokemon.name)}
      </li>
    `
    )
    .join("");

  // Delegated handlers (attach once)
  if (!listElement.dataset.bound) {
    listElement.addEventListener("click", onListActivate);
    listElement.addEventListener("keydown", onListKeydown);
    listElement.dataset.bound = "1";
  }

  const start = startIdx + 1;
  const end = Math.min(startIdx + PAGE_SIZE, source.length);
  resultsInfoElement.textContent = `Showing ${start}–${end} of ${source.length}`;
}

function onListActivate(e) {
  const li = e.target.closest("li[data-open]");
  if (!li) return;
  const indexOnPage = Number(li.dataset.open);
  const globalIndex = (currentPage - 1) * PAGE_SIZE + indexOnPage;
  const source = filteredResults.length ? filteredResults : [];
  const p = source[globalIndex];
  showPokemon(p.id, globalIndex);
}

function onListKeydown(e) {
  if (e.key !== "Enter" && e.key !== " ") return;
  const li = e.target.closest("li[data-open]");
  if (!li) return;
  e.preventDefault();
  const indexOnPage = Number(li.dataset.open);
  const globalIndex = (currentPage - 1) * PAGE_SIZE + indexOnPage;
  const source = filteredResults.length ? filteredResults : [];
  const p = source[globalIndex];
  showPokemon(p.id, globalIndex);
}

function renderPagination() {
  const sourceLen = filteredResults.length ? filteredResults.length : 0;
  const totalPages = Math.max(1, Math.ceil(sourceLen / PAGE_SIZE));
  paginationElement.innerHTML = "";

  const mk = (disabled, label, go) => {
    const li = document.createElement("li");
    li.className = `page-item ${disabled ? "disabled" : ""}`;
    const a = document.createElement("a");
    a.className = "page-link"; a.href = "#"; a.textContent = label;
    a.addEventListener("click", (e) => {
      e.preventDefault();
      if (disabled) return;
      currentPage = go;
      renderList(); renderPagination(); updateCountsLabel();
    });
    li.appendChild(a); paginationElement.appendChild(li);
  };

  mk(currentPage <= 1, "Previous", currentPage - 1);
  mk(currentPage >= totalPages, "Next", currentPage + 1);
}

function updateCountsLabel() {
  const sourceLen = filteredResults.length ? filteredResults.length : 0;
  resultCountEl.textContent = `${sourceLen.toLocaleString()} results`;
}

// ===== Modal (details) =====
async function showPokemon(id, globalIndex) {
  modalGlobalIndex = globalIndex;
  modalBody.innerHTML = `<p class="text-center">Loading...</p>`;

  try {
    const d = await getDetails(id);
    modalTitle.textContent = titleCase(d.name);

    const statsHtml = d.stats.map(s => `
      <div class="mb-2">
        <div class="d-flex justify-content-between small">
          <span>${s.stat.name.toUpperCase()}</span><span>${s.base_stat}</span>
        </div>
        <div class="progress" role="progressbar" aria-label="${s.stat.name}" aria-valuemin="0" aria-valuemax="255">
          <div class="progress-bar bg-primary" data-value="${s.base_stat}" style="width:0%"></div>
        </div>
      </div>
    `).join("");

    modalBody.innerHTML = `
      <div class="text-center mb-3">
        <img src="${d.sprites?.front_default || ""}" alt="${d.name}" class="img-fluid"/>
      </div>
      <p><strong>ID:</strong> ${d.id}</p>
      <p><strong>Height:</strong> ${d.height}</p>
      <p><strong>Weight:</strong> ${d.weight}</p>
      <p><strong>Types:</strong> ${d.types.map((t) => t.type.name).join(", ")}</p>
      <p><strong>Abilities:</strong> ${d.abilities.map((a) => a.ability.name).join(", ")}</p>
      <h6>Stats</h6>
      ${statsHtml}
    `;

    modal.show();

    // Animate stat bars after paint
    requestAnimationFrame(() => {
      modalBody.querySelectorAll(".progress-bar").forEach((bar) => {
        const val = Number(bar.dataset.value);
        const pct = Math.min(100, Math.round((val / 255) * 100));
        bar.style.width = pct + "%";
      });
    });
  } catch (err) {
    modalTitle.textContent = "Error";
    modalBody.innerHTML = `<p class="text-center text-danger">Failed to load details.</p>`;
    modal.show();
  }
}

// Modal navigation through the current filtered+sorted order
function currentSource() { return filteredResults.length ? filteredResults : []; }

function showPrevPokemon() {
  if (modalGlobalIndex <= 0) return;
  modalGlobalIndex -= 1;
  const src = currentSource();
  showPokemon(src[modalGlobalIndex].id, modalGlobalIndex);
}
function showNextPokemon() {
  const src = currentSource();
  if (modalGlobalIndex >= src.length - 1) return;
  modalGlobalIndex += 1;
  showPokemon(src[modalGlobalIndex].id, modalGlobalIndex);
}

document.addEventListener("keydown", (e) => {
  if (!modalEl.classList.contains("show")) return;
  if (e.key === "ArrowLeft") { e.preventDefault(); showPrevPokemon(); }
  else if (e.key === "ArrowRight") { e.preventDefault(); showNextPokemon(); }
});
modalPrev.addEventListener("click", showPrevPokemon);
modalNext.addEventListener("click", showNextPokemon);

// ===== Search (with autocomplete) =====
async function doSearch() {
  const query = searchInput.value.trim().toLowerCase();
  if (!query) return;
  // Try exact name in our list
  const exact = allResults.find((p) => p.name.toLowerCase() === query);
  if (exact) {
    const idx = currentSource().findIndex(p => p.id === exact.id);
    const globalIndex = idx >= 0 ? idx : -1;
    return showPokemon(exact.id, globalIndex);
  }
  // Fallback to API (works with numeric ID)
  try {
    const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${query}`);
    if (!res.ok) throw new Error("Not found");
    const d = await res.json();
    const idx = currentSource().findIndex(p => p.id === d.id);
    return showPokemon(d.id, idx >= 0 ? idx : -1);
  } catch {
    modalTitle.textContent = "Not Found";
    modalBody.innerHTML = `<p class="text-center text-danger">No Pokémon found with that name or ID.</p>`;
    modal.show();
  }
}
searchBtn.addEventListener("click", doSearch);
searchInput.addEventListener("keydown", (e) => { if (e.key === "Enter") doSearch(); });

function updateDatalist(query) {
  if (!datalistEl) return;
  const MAX = 20;
  let ranked = allResults.map(p => p.name);
  if (query) {
    ranked = ranked
      .map(n => ({ n, s: similarityScore(n, query) }))
      .sort((a,b)=>a.s - b.s)
      .slice(0, MAX)
      .map(x => x.n);
  } else {
    ranked = allResults.slice(0, MAX).map(p => p.name);
  }
  datalistEl.innerHTML = ranked.map(n => `<option value="${n}"></option>`).join("");
}
searchInput.addEventListener("input", debounce((e)=>updateDatalist(e.target.value.trim()), 120));
searchInput.addEventListener("change", () => {
  const v = searchInput.value.trim().toLowerCase();
  if (!v) return;
  const exact = allResults.find(p => p.name.toLowerCase() === v);
  if (exact) showPokemon(exact.id, currentSource().findIndex(p=>p.id===exact.id));
});

// ===== Sort (A–Z / Z–A) across full filtered set =====
sortSelect.addEventListener("change", () => {
  currentSort = sortSelect.value;
  const asc = currentSort.endsWith("asc");
  const src = filteredResults.length ? filteredResults : allResults;
  src.sort((a,b)=> asc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name));
  if (filteredResults.length) filteredResults = src; else allResults = src;
  currentPage = 1;
  renderList(); renderPagination(); updateCountsLabel();
});

// ===== Filter buttons wiring =====
applyFiltersBtn.addEventListener("click", applyFilters);
clearFiltersBtn.addEventListener("click", clearFilters);
resetSectionBtn.addEventListener("click", () => {
  // Reset only size/stats—keep types
  document.getElementById("hAny").checked = true;
  document.getElementById("wAny").checked = true;
  speedSelect.value = "any";
  strengthSelect.value = "any";
  toughnessSelect.value = "any";
});

// Quick pick buttons
document.querySelectorAll('[data-preset]').forEach(btn => {
  btn.addEventListener("click", () => applyPreset(btn.dataset.preset));
});

// ===== Init =====
loadAllPokemonList();
