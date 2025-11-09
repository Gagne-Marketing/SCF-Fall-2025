// =====================
// Quiz App - Full Script
// Category 18 (Computers) • keep 20 cached per difficulty • TTL 14 days
// Points: easy=1, medium=5, hard=10 • Wrong penalty: -2 (min 0)
// =====================

// ----- DOM references -----
const landingPage       = document.getElementById("landing-page");
const quizPage          = document.getElementById("quiz-page");

const btnStart          = document.getElementById("btn-start");
const btnCheckAnswer    = document.getElementById("btn-check-answer");
const btnLooseTryAgain  = document.getElementById("btn-try-again");
const btnLooseEnd       = document.getElementById("btn-loose-end");
const btnWinEnd         = document.getElementById("btn-win-end");

const quizQuestion      = document.getElementById("quiz-question");
const quizMessageBox    = document.getElementById("quiz-message-box");
const scoreDisplay      = document.getElementById("point_value");
const quizProgress      = document.getElementById("quiz-progress");

const quizLooseModal    = document.getElementById("loose-modal");
const quizWinModal      = document.getElementById("win-modal");

// Landing controls
const questionCountSel  = document.getElementById("question-count");
const modeSingle        = document.getElementById("mode-single");
const modeMixed         = document.getElementById("mode-mixed");
const mixedRow          = document.getElementById("mixedRow");
const difficultySelect  = document.getElementById("difficultySelect");
const mixEasy           = document.getElementById("mix-easy");
const mixMedium         = document.getElementById("mix-medium");
const mixHard           = document.getElementById("mix-hard");

// =====================
// Config / helpers
// =====================
const POINTS_BY_DIFF = { easy: 1, medium: 5, hard: 10 };
const WRONG_PENALTY  = 2;
const DAYS           = 24 * 60 * 60 * 1000;
const CACHE_TTL_MS   = 14 * DAYS;      // 14-day freshness window
const POOL_CAP       = 20;             // keep 20 per difficulty

function buildUrl(amount, diff) {
  let url = "https://opentdb.com/api.php?amount=" + amount + "&category=18&type=multiple";
  if (diff && diff.length > 0) url += "&difficulty=" + diff;
  return url;
}

function cacheKeyFor(diff) { return "qb:18:multiple:" + diff; }
function metaKeyFor(diff)  { return "qb_meta:18:multiple:" + diff; }

// Randomize answers
function randomizeAnswers(correct, incorrect) {
  const answers = incorrect.concat([correct]);
  for (let i = answers.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = answers[i];
    answers[i] = answers[j];
    answers[j]  = tmp;
  }
  return { answers, correctIndex: answers.indexOf(correct) };
}


function decodeHtml(str) {
  const el = document.createElement("textarea");
  el.innerHTML = str;
  return el.value;
}


function updateDiffUI() {
  const mixed = modeMixed && modeMixed.checked;
  if (!mixedRow) return;
  mixedRow.classList.toggle("qc-disabled", !mixed);
  mixedRow.style.pointerEvents = mixed ? "auto" : "none";
}
modeSingle?.addEventListener("change", updateDiffUI);
modeMixed?.addEventListener("change", updateDiffUI);


function showPage(el) { if (el) el.classList.remove("is-hidden"); }
function hidePage(el) { if (el) el.classList.add("is-hidden"); }


function openModal(modalEl) {
  if (!modalEl) return;
  modalEl.style.visibility = "visible";
  modalEl.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
}
function closeModal(modalEl) {
  if (!modalEl) return;
  modalEl.style.visibility = "hidden";
  modalEl.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
}

//Small Delay 
function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

// Retry fetch (handles 429)
async function fetchWithRetry(url, attempts, baseDelayMs) {
  let tries = attempts || 5;
  let delay = baseDelayMs || 1000;
  for (let i = 1; i <= tries; i++) {
    try {
      const res = await fetch(url);
      if (res.status === 429) { await sleep(delay); delay *= 2; continue; }
      if (!res.ok)           { await sleep(700);  continue; }
      return res;
    } catch {
      await sleep(delay);
      delay *= 2;
    }
  }
  throw new Error("fetchWithRetry failed for " + url);
}



let quizQuestions = [];
let selectedAnswer = null;
let currentQuestionIndex = 0;
let score = 0;
let maxPossible = 0;


function readCache(diff) {
  try {
    const raw = localStorage.getItem(cacheKeyFor(diff)) || "[]";
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}
function writeCache(diff, arr) {
  try { localStorage.setItem(cacheKeyFor(diff), JSON.stringify(arr)); }
  catch (e) { console.warn("Could not write cache for", diff, e); }
}
function readMeta(diff) {
  try {
    const raw = localStorage.getItem(metaKeyFor(diff)) || "{}";
    const obj = JSON.parse(raw);
    return (obj && typeof obj === "object") ? obj : {};
  } catch { return {}; }
}
function writeMeta(diff, obj) {
  try { localStorage.setItem(metaKeyFor(diff), JSON.stringify(obj)); }
  catch (e) { console.warn("Could not write meta for", diff, e); }
}
function cacheIsFresh(diff) {
  const meta = readMeta(diff);
  const lastFetched = Number(meta.last_fetched) || 0;
  const ageMs = Date.now() - lastFetched;
  return ageMs >= 0 && ageMs < CACHE_TTL_MS;
}

// API → question object (skip invalid)

function makeQuestionFromApiItem(item) {
  if (!item || item.type !== "multiple" ||
      !Array.isArray(item.incorrect_answers) || item.incorrect_answers.length !== 3 ||
      !item.correct_answer) {
    return null;                         // skip non-multiple/invalid
  }

  const questionText = decodeHtml(item.question);

   if (questionText.includes("non-standard tag") && questionText.includes("scroll")) {
    console.warn("Skipping excluded question:", questionText);
    return null;
  }

  const incorrect    = item.incorrect_answers.map(decodeHtml);
  const correct      = decodeHtml(item.correct_answer);
  const mix   = randomizeAnswers(correct, incorrect);
  const value = POINTS_BY_DIFF[item.difficulty] || 1;

  return {
    question: questionText,
    answers: mix.answers,
    correctAnswerIndex: mix.correctIndex,
    point_value: value,
    difficulty: item.difficulty || "medium"
  };
}

// Ensure 20 fresh per difficulty 

async function ensurePool(diff) {
  const pool  = readCache(diff);
  const fresh = cacheIsFresh(diff);

  if (fresh && pool.length >= POOL_CAP) {
    console.log(`📦 Cache OK for "${diff}" (have ${pool.length}/${POOL_CAP})`);
    return;
  }

  const needed = Math.max(0, POOL_CAP - pool.length);
  let fetched = [];

  if (needed > 0 || !fresh) {
    
    try {
      const primaryUrl = buildUrl(Math.max(needed, 10), diff);
      const res = await fetchWithRetry(primaryUrl, 5, 1000);
      const data = await res.json();

      if (data && Array.isArray(data.results)) {
        const before = data.results.length;
        fetched = data.results.map(makeQuestionFromApiItem).filter(Boolean);
        const filteredOut = before - fetched.length;
        console.log(`🔎 ${diff}: fetched ${before}, kept ${fetched.length}, filtered out ${filteredOut}`);
      }
    } catch (e) {
      console.warn("Primary refill failed", diff, e);
    }

    
    let remaining = Math.max(0, POOL_CAP - (pool.length + fetched.length));
    const chunks = [5, 3, 2, 1];
    for (const size of chunks) {
      while (remaining >= size) {
        try {
          const r = await fetchWithRetry(buildUrl(size, diff), 5, 1000);
          const d = await r.json();

          if (d && Array.isArray(d.results)) {
            const before = d.results.length;
            const got    = d.results.map(makeQuestionFromApiItem).filter(Boolean);
            const filteredOut = before - got.length;
            console.log(`🔎 ${diff}: chunk ${size} → fetched ${before}, kept ${got.length}, filtered ${filteredOut}`);
            fetched   = fetched.concat(got);
            remaining = Math.max(0, POOL_CAP - (pool.length + fetched.length));
            await sleep(300 + Math.floor(Math.random() * 200));
          } else { break; }

        } catch {
          break;
        }
      }
      if (remaining <= 0) break;
    }
  }

  const newPool = fetched.concat(pool).slice(0, POOL_CAP);
  writeCache(diff, newPool);

  const meta = readMeta(diff);
  meta.last_fetched = Date.now();
  writeMeta(diff, meta);

  console.log(`✅ Cache set for "${diff}" → ${newPool.length}/${POOL_CAP}`);
}


async function getQuestionsForQuiz(diff, amount) {
  await ensurePool(diff);

  let pool = readCache(diff);
  if (pool.length >= amount) {
    console.log(`✅ Using ${amount} of ${pool.length} cached "${diff}" questions`);
    return pool.slice(0, amount);
  }

  
  let result    = pool.slice();
  let remaining = amount - result.length;

  if (remaining > 0) {
    const chunks = [5, 3, 2, 1];
    for (const size of chunks) {
      while (remaining >= size) {
        try {
          const r = await fetchWithRetry(buildUrl(size, diff), 5, 1000);
          const d = await r.json();
          if (d && Array.isArray(d.results)) {
            const before = d.results.length;
            const got    = d.results.map(makeQuestionFromApiItem).filter(Boolean);
            const filteredOut = before - got.length;
            console.log(`🔄 top-up ${diff}: fetched ${before}, kept ${got.length}, filtered ${filteredOut}`);
            result    = result.concat(got);
            remaining = amount - result.length;
            await sleep(300 + Math.floor(Math.random() * 200));
          } else { break; }
        } catch { break; }
      }
      if (remaining <= 0) break;
    }

    // refresh cache with newest-first (cap 20)
    const refreshed = result.slice(0, POOL_CAP);
    writeCache(diff, refreshed);
    const meta = readMeta(diff);
    meta.last_fetched = Date.now();
    writeMeta(diff, meta);
  }

  if (result.length < amount) {
    console.warn(`⚠️ Only ${result.length}/${amount} available for "${diff}"`);
  }
  return result.slice(0, amount);
}


function updateProgress() {
  if (!quizProgress) return;
  quizProgress.textContent =
    "Question " + (currentQuestionIndex + 1) + " of " + quizQuestions.length +
    " • Score: " + score + " / " + maxPossible;
}


function setupQuizQuestion(question) {
  if (!question || !question.answers || question.answers.length < 2) {
    

    currentQuestionIndex++;
    if (currentQuestionIndex < quizQuestions.length) {
      setupQuizQuestion(quizQuestions[currentQuestionIndex]);
    }
    return;
  }

  const questionText = document.createElement("p");
  questionText.innerHTML = question.question;

  quizQuestion.innerHTML = "";
  quizQuestion.appendChild(questionText);
  btnCheckAnswer.disabled = false;

  const answers = document.createElement("select");
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Choose an answer…";
  placeholder.disabled = true;
  placeholder.selected = true;
  answers.appendChild(placeholder);

  for (let i = 0; i < question.answers.length; i++) {
    const opt = document.createElement("option");
    opt.value = i;
    opt.innerHTML = question.answers[i];
    answers.appendChild(opt);
  }

  answers.addEventListener("change", () => {
    selectedAnswer = answers.value === "" ? null : Number(answers.value);
  });

  selectedAnswer = null;
  quizQuestion.appendChild(answers);

  quizMessageBox.innerHTML = "";
  closeModal(quizWinModal);
  closeModal(quizLooseModal);

  updateProgress();
}

// Check answer
function checkAnswer(question) {
  if (selectedAnswer === null || selectedAnswer === "") {
    quizMessageBox.innerHTML = "<p>Please choose an answer.</p>";
    return;
  }

  if (selectedAnswer === question.correctAnswerIndex) {
    quizMessageBox.innerHTML = "<p>Correct!</p>";
    score += question.point_value;
    scoreDisplay.innerHTML = "<p>Score: " + score + "</p>";
    btnCheckAnswer.disabled = true;

    if (currentQuestionIndex < quizQuestions.length - 1) {
      const nextButton = document.createElement("button");
      nextButton.textContent = "Next";
      nextButton.addEventListener("click", () => {
        currentQuestionIndex++;
        setupQuizQuestion(quizQuestions[currentQuestionIndex]);
      });
      quizMessageBox.appendChild(nextButton);
    } else {
      const final = document.getElementById("final-score");
      if (final) final.textContent = "Final Points: " + score + " / " + maxPossible;
      openModal(quizWinModal);
    }
  } else {
    score = Math.max(0, score - WRONG_PENALTY);
    scoreDisplay.innerHTML = "<p>Score: " + score + "</p>";
    openModal(quizLooseModal);
  }

  updateProgress();
}

// Start quiz

btnStart?.addEventListener("click", async (e) => {
  e.preventDefault();

  let total = 5;
  if (questionCountSel?.value) total = Number(questionCountSel.value);

  const tasks = [];
  if (modeSingle && modeSingle.checked) {
    let diff = "medium";
    if (difficultySelect?.value) diff = String(difficultySelect.value).toLowerCase();
    tasks.push({ diff, amount: total });
  } else {
    const chosen = [];
    if (mixEasy?.checked)   chosen.push("easy");
    if (mixMedium?.checked) chosen.push("medium");
    if (mixHard?.checked)   chosen.push("hard");

    if (chosen.length === 0) {
      quizMessageBox.innerHTML = "<p>Please pick at least one difficulty.</p>";
      return;
    }

    const base = Math.floor(total / chosen.length);
    let remainder = total % chosen.length;
    for (let i = 0; i < chosen.length; i++) {
      const d = chosen[i];
      const amt = base + (remainder > 0 ? 1 : 0);
      if (remainder > 0) remainder -= 1;
      tasks.push({ diff: d, amount: amt });
    }
  }

  quizQuestions = [];
  currentQuestionIndex = 0;
  selectedAnswer = null;
  score = 0;
  maxPossible = 0;
  scoreDisplay.textContent = "Score: 0";
  quizMessageBox.innerHTML = "";

  for (let t = 0; t < tasks.length; t++) {
    const task = tasks[t];
    if (t > 0) await sleep(600 + Math.floor(Math.random() * 400)); // gentle to API
    await ensurePool(task.diff);
    const batch = await getQuestionsForQuiz(task.diff, task.amount);
    for (let b = 0; b < batch.length; b++) {
      quizQuestions.push(batch[b]);
      maxPossible += (batch[b].point_value || 0);
    }
  }

  if (quizQuestions.length === 0) {
    quizMessageBox.innerHTML = "<p>Could not load questions. Please try again.</p>";
    return;
  }

  hidePage(landingPage);
  setupQuizQuestion(quizQuestions[currentQuestionIndex]);
  showPage(quizPage);

  document.getElementById("Container")?.scrollIntoView({ behavior: "smooth", block: "start" });
});

// Buttons

btnCheckAnswer?.addEventListener("click", (e) => {
  e.preventDefault();
  if (!quizQuestions[currentQuestionIndex]) return;
  checkAnswer(quizQuestions[currentQuestionIndex]);
});

btnLooseTryAgain?.addEventListener("click", (e) => {
  e.preventDefault();
  closeModal(quizLooseModal);
});

btnLooseEnd?.addEventListener("click", (e) => {
  e.preventDefault();
  endQuiz();
});

btnWinEnd?.addEventListener("click", (e) => {
  e.preventDefault();
  endQuiz();
});

//  End Quiz / Reset

function endQuiz() {
  hidePage(quizPage);
  showPage(landingPage);

  quizQuestions = [];
  score = 0;
  currentQuestionIndex = 0;
  quizMessageBox.innerHTML = "";
  scoreDisplay.textContent = "Score: 0";
  closeModal(quizWinModal);
  closeModal(quizLooseModal);

  btnStart?.focus();
}


const form = document.getElementById("userQForm");
const msg  = document.getElementById("uq-msg");

function buildUserQuestion({ question, answers, correctIndex, difficulty }) {
  if (!question || question.trim() === "") return "⚠️ Question text cannot be empty.";
  if (!Array.isArray(answers) || answers.length !== 4) return "⚠️ You must enter 4 answers.";
  if (correctIndex < 0 || correctIndex > 3) return "⚠️ Please choose which answer is correct (0–3).";

  const diff = (difficulty || "medium").toLowerCase();
  return {
    question: question.trim(),
    answers: answers.map(a => String(a || "").trim()),
    correctAnswerIndex: correctIndex,
    difficulty: diff,
    point_value: POINTS_BY_DIFF[diff] || 1
  };
}

function addCustomQuestionToPool(qObj) {
  const diff = qObj.difficulty || "medium";
  let pool = readCache(diff);
  pool.unshift(qObj);
  if (pool.length > POOL_CAP) pool = pool.slice(0, POOL_CAP);
  writeCache(diff, pool);
  const meta = readMeta(diff);
  meta.last_fetched = Date.now();   // treat as fresh
  writeMeta(diff, meta);
  return { ok: true, message: "✅ Question saved to " + diff + " pool." };
}

form?.addEventListener("submit", (e) => {
  e.preventDefault();

  const q       = document.getElementById("uq-text").value;
  const a0      = document.getElementById("uq-a0").value;
  const a1      = document.getElementById("uq-a1").value;
  const a2      = document.getElementById("uq-a2").value;
  const a3      = document.getElementById("uq-a3").value;
  const correct = Number(document.getElementById("uq-correct").value);
  const diff    = document.getElementById("uq-diff").value;

  const built = buildUserQuestion({
    question: q,
    answers: [a0, a1, a2, a3],
    correctIndex: correct,
    difficulty: diff
  });

  if (typeof built === "string") {
    if (msg) { msg.textContent = built; msg.className = "uq-err"; }
    return;
  }

  const result = addCustomQuestionToPool(built);
  if (msg) { msg.textContent = result.message; msg.className = result.ok ? "uq-ok" : "uq-err"; }
  if (result.ok) form.reset();
});


hidePage(quizPage);
showPage(landingPage);
updateDiffUI();
