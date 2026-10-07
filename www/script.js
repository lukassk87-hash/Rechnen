(() => {
  const TOTAL_QUESTIONS = 30;
  const PENALTY_SECONDS = 10;
  const HIGHSCORE_LIMIT = 5;
  const STORAGE_KEY = 'math-trainer-highscores-v5';

  const MODES = {
    core:      { label: 'Kern ×',        title: 'Kernaufgaben ×',          description: 'Aktiv: Kernaufgaben mit ×1, ×2, ×5 und ×10.' },
    core_div:  { label: 'Kern ÷',        title: 'Kernaufgaben ÷',          description: 'Aktiv: Kernaufgaben als Division mit ÷1, ÷2, ÷5 und ÷10.' },
    core_mix:  { label: 'Kern gemischt', title: 'Kernaufgaben gemischt',   description: 'Aktiv: Kernaufgaben gemischt – × und ÷ zufällig.' },

    small:     { label: 'Klein ×',       title: 'Kleines 1×1 ×',           description: 'Aktiv: alle Malaufgaben des kleinen 1×1 von 1 bis 10.' },
    small_div: { label: 'Klein ÷',       title: 'Kleines 1×1 ÷',           description: 'Aktiv: alle Divisionsaufgaben des kleinen 1×1 von 1 bis 10.' },
    small_mix: { label: 'Klein gemischt', title: 'Kleines 1×1 gemischt',   description: 'Aktiv: kleines 1×1 gemischt – × und ÷ zufällig.' },

    large:     { label: 'Groß ×',        title: 'Großes 1×1 ×',            description: 'Aktiv: alle Malaufgaben des großen 1×1 von 1 bis 20.' },
    large_div: { label: 'Groß ÷',        title: 'Großes 1×1 ÷',            description: 'Aktiv: alle Divisionsaufgaben des großen 1×1 von 1 bis 20.' },
    large_mix: { label: 'Groß gemischt', title: 'Großes 1×1 gemischt',     description: 'Aktiv: großes 1×1 gemischt – × und ÷ zufällig.' },

    row_mul:   { label: 'Reihe ×',       title: 'Gezielte Malreihe',       description: 'Aktiv: gezielte Malreihe mit dem gewählten Faktor (1–10), andere Faktoren zufällig 1–10.' },
    row_div:   { label: 'Reihe ÷',       title: 'Gezielte Divisionsreihe', description: 'Aktiv: gezielte Divisionsreihe mit dem gewählten Divisor (1–10), Dividend zufällig 1× bis 10×.' },
    pvs:       { label: 'PvS',           title: 'Punkt vor Strich',         description: 'Aktiv: Punkt vor Strich – erst Mal oder Division, dann Plus oder Minus. Ergebnis immer positiv.' }
  };

  // ---------- Theme ----------
  const themeToggle = document.querySelector('[data-theme-toggle]');
  const root = document.documentElement;
  let currentTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  root.setAttribute('data-theme', currentTheme);
  syncThemeToggle();
  themeToggle.addEventListener('click', () => {
    currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', currentTheme);
    syncThemeToggle();
  });
  function syncThemeToggle() {
    themeToggle.textContent = currentTheme === 'dark' ? '☀️' : '🌙';
    themeToggle.setAttribute('aria-label', currentTheme === 'dark' ? 'Hellen Modus aktivieren' : 'Dunklen Modus aktivieren');
  }

  // ---------- DOM ----------
  const modeInputs = [...document.querySelectorAll('input[name="mode"]')];
  const modeCards = [...document.querySelectorAll('.mode-card')];
  const modeDescription = document.getElementById('modeDescription');
  const modeValue = document.getElementById('modeValue');
  const playerName = document.getElementById('playerName');
  const progressValue = document.getElementById('progressValue');
  const timeValue = document.getElementById('timeValue');
  const errorsValue = document.getElementById('errorsValue');
  const penaltyValue = document.getElementById('penaltyValue');
  const questionText = document.getElementById('questionText');
  const answerInput = document.getElementById('answerInput');
  const answerForm = document.getElementById('answerForm');
  const submitBtn = document.getElementById('submitBtn');
  const startBtn = document.getElementById('startBtn');
  const restartBtn = document.getElementById('restartBtn');
  const feedbackBox = document.getElementById('feedbackBox');
  const resultsBox = document.getElementById('resultsBox');
  const gradeBadge = document.getElementById('gradeBadge');
  const rawTimeResult = document.getElementById('rawTimeResult');
  const finalTimeResult = document.getElementById('finalTimeResult');
  const correctResult = document.getElementById('correctResult');
  const scoreResult = document.getElementById('scoreResult');
  const motivationText = document.getElementById('motivationText');
  const gradingInfo = document.getElementById('gradingInfo');
  const highscoreList = document.getElementById('highscoreList');
  const questionWrap = document.getElementById('questionWrap');
  const mistakesList = document.getElementById('mistakesList');
  const rowPicker = document.getElementById('rowPicker');
  const rowSelect = document.getElementById('rowSelect');

  // ---------- State ----------
  let round = resetRound();
  let timer = null;
  let highscores = loadHighscores();
  syncModeUI();
  renderHighscores();
  syncQuestion();
  syncView();

  // ---------- Events ----------
  modeInputs.forEach(input => input.addEventListener('change', () => {
    if (round.active) return;
    round.mode = input.value;
    syncModeUI();
    renderHighscores();
  }));
  rowSelect.addEventListener('change', () => {
    if (round.active) return;
    syncModeUI();
  });
  startBtn.addEventListener('click', startRound);
  restartBtn.addEventListener('click', restartRound);
  answerForm.addEventListener('submit', submitAnswer);

  // ---------- Helpers ----------
  function resetRound() {
    return {
      mode: getSelectedMode(),
      row: getSelectedRow(),
      tasks: [],
      index: 0,
      errors: 0,
      correct: 0,
      mistakes: [],
      startedAt: null,
      elapsedSeconds: 0,
      active: false,
      finished: false,
      totalQuestions: TOTAL_QUESTIONS
    };
  }

  function getSelectedMode() {
    return modeInputs.find(input => input.checked)?.value || 'core';
  }

  function getSelectedRow() {
    return Number(rowSelect.value) || 1;
  }

  function syncModeUI() {
    modeCards.forEach(card => {
      const checked = card.querySelector('input').checked;
      card.classList.toggle('active', checked);
    });
    const mode = MODES[getSelectedMode()];
    modeDescription.textContent = mode.description;
    modeValue.textContent = mode.label;

    const isRowMode = getSelectedMode() === 'row_mul' || getSelectedMode() === 'row_div';
    rowPicker.hidden = !isRowMode;
  }

  // ---------- Task builders ----------
  function buildMultiplicationBank(min, max) {
    const tasks = [];
    for (let a = min; a <= max; a += 1) {
      for (let b = min; b <= max; b += 1) {
        tasks.push({ a, b, answer: a * b, op: 'mul' });
      }
    }
    return uniqueTasks(tasks);
  }

  function buildDivisionBank(min, max) {
    const tasks = [];
    for (let divisor = min; divisor <= max; divisor += 1) {
      for (let factor = min; factor <= max; factor += 1) {
        const dividend = divisor * factor;
        tasks.push({ a: dividend, b: divisor, answer: factor, op: 'div' });
      }
    }
    return uniqueTasks(tasks);
  }

  function buildMixedBank(min, max) {
    return uniqueTasks([...buildMultiplicationBank(min, max), ...buildDivisionBank(min, max)]);
  }

  function buildCoreMul() {
    return uniqueTasks(
      buildMultiplicationBank(1, 10).filter(t =>
        [1, 2, 5, 10].includes(t.b) || [1, 2, 5, 10].includes(t.a)
      )
    );
  }
  function buildCoreDiv() {
    return uniqueTasks(buildDivisionBank(1, 10).filter(t => [1, 2, 5, 10].includes(t.b)));
  }
  function buildCoreMix() {
    return uniqueTasks([...buildCoreMul(), ...buildCoreDiv()]);
  }

  function buildRowMul(row) {
    const tasks = [];
    for (let n = 1; n <= 10; n += 1) {
      tasks.push({ a: row, b: n, answer: row * n, op: 'mul' });
      tasks.push({ a: n, b: row, answer: row * n, op: 'mul' });
    }
    return uniqueTasks(tasks);
  }

  function buildRowDiv(row) {
    const tasks = [];
    for (let n = 1; n <= 10; n += 1) {
      tasks.push({ a: row * n, b: row, answer: n, op: 'div' });
    }
    return uniqueTasks(tasks);
  }

  // Punkt vor Strich: a × b ± c  oder  c ± a × b  (auch mit Division)
  // Werte: Mal/Division aus kleinem 1×1 (1–10), c aus 1–20, Ergebnis >= 0.
  function buildPointBeforeLineBank() {
    const tasks = [];

    for (let a = 1; a <= 10; a += 1) {
      for (let b = 1; b <= 10; b += 1) {
        const mul = a * b;
        for (let c = 1; c <= 20; c += 1) {
          tasks.push({ a, b, c, answer: mul + c, op: 'pvs', form: 'mul_add_after' });
          tasks.push({ a, b, c, answer: mul + c, op: 'pvs', form: 'add_before_mul' });
          if (mul - c >= 0) {
            tasks.push({ a, b, c, answer: mul - c, op: 'pvs', form: 'mul_sub_after' });
          }
          if (c - mul >= 0) {
            tasks.push({ a, b, c, answer: c - mul, op: 'pvs', form: 'sub_before_mul' });
          }
        }
      }
    }

    for (let b = 1; b <= 10; b += 1) {
      for (let q = 1; q <= 10; q += 1) {
        const a = b * q;   // Dividend
        const div = q;     // Divisionsergebnis
        for (let c = 1; c <= 20; c += 1) {
          tasks.push({ a, b, c, answer: div + c, op: 'pvs', form: 'div_add_after' });
          tasks.push({ a, b, c, answer: div + c, op: 'pvs', form: 'add_before_div' });
          if (div - c >= 0) {
            tasks.push({ a, b, c, answer: div - c, op: 'pvs', form: 'div_sub_after' });
          }
          if (c - div >= 0) {
            tasks.push({ a, b, c, answer: c - div, op: 'pvs', form: 'sub_before_div' });
          }
        }
      }
    }

    return uniqueTasks(tasks);
  }

  function uniqueTasks(tasks) {
    const seen = new Set();
    return tasks.filter(task => {
      const key = task.op === 'pvs'
        ? `${task.form}-${task.a}-${task.b}-${task.c}`
        : `${task.a}${task.op}${task.b}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function getBankForMode(modeKey, row) {
    switch (modeKey) {
      case 'core':      return buildCoreMul();
      case 'core_div':  return buildCoreDiv();
      case 'core_mix':  return buildCoreMix();
      case 'small':     return buildMultiplicationBank(1, 10);
      case 'small_div': return buildDivisionBank(1, 10);
      case 'small_mix': return buildMixedBank(1, 10);
      case 'large':     return buildMultiplicationBank(1, 20);
      case 'large_div': return buildDivisionBank(1, 20);
      case 'large_mix': return buildMixedBank(1, 20);
      case 'row_mul':   return buildRowMul(row);
      case 'row_div':   return buildRowDiv(row);
      case 'pvs':       return buildPointBeforeLineBank();
      default:          return buildCoreMul();
    }
  }

  function sampleTasks(modeKey, row) {
    const pool = [...getBankForMode(modeKey, row)];
    if (!pool.length) throw new Error('Leerer Aufgabenpool.');

    const target = Math.min(TOTAL_QUESTIONS, pool.length);
    const selected = [];

    // Fisher-Yates
    for (let i = pool.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    for (let i = 0; i < target; i += 1) selected.push(pool[i]);

    // Falls Pool kleiner als 30: Wiederholungen durcheinander auffüllen
    while (selected.length < TOTAL_QUESTIONS) {
      const t = pool[Math.floor(Math.random() * pool.length)];
      selected.push({ ...t, _repeat: true });
    }

    // Endgültig mischen
    for (let i = selected.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [selected[i], selected[j]] = [selected[j], selected[i]];
    }

    return selected;
  }

  // ---------- Round flow ----------
  function startRound() {
    round = resetRound();
    round.mode = getSelectedMode();
    round.row = getSelectedRow();
    try {
      round.tasks = sampleTasks(round.mode, round.row);
    } catch (e) {
      feedback('Ups! Der Aufgabenpool ist leer. Wähle einen anderen Modus.', 'error');
      return;
    }
    round.totalQuestions = round.tasks.length;
    round.startedAt = performance.now();
    round.active = true;
    round.finished = false;

    resultsBox.classList.remove('show');
    mistakesList.innerHTML = '';
    answerInput.disabled = false;
    submitBtn.disabled = false;
    startBtn.disabled = true;
    playerName.disabled = true;
    modeInputs.forEach(input => input.disabled = true);
    rowSelect.disabled = true;

    feedback(`Los geht's im Modus ${MODES[round.mode].title}! 🥳`, '');
    syncQuestion();
    syncView();
    answerInput.value = '';
    answerInput.focus();

    clearInterval(timer);
    timer = setInterval(() => {
      if (!round.active) return;
      round.elapsedSeconds = Math.floor((performance.now() - round.startedAt) / 1000);
      syncView();
    }, 250);
  }

  function restartRound() {
    clearInterval(timer);
    round = resetRound();
    answerInput.value = '';
    answerInput.disabled = true;
    submitBtn.disabled = true;
    startBtn.disabled = false;
    playerName.disabled = false;
    modeInputs.forEach(input => input.disabled = false);
    rowSelect.disabled = false;
    resultsBox.classList.remove('show');
    feedback('Neue Runde bereit. Such dir einen Modus aus und starte! 🎈', '');
    mistakesList.innerHTML = '';
    syncModeUI();
    syncQuestion();
    syncView();
    renderHighscores();
  }

  function syncQuestion() {
    if (!round.active && !round.finished) {
      questionText.textContent = 'Drücke auf Start 🎈';
      return;
    }
    if (round.finished) {
      questionText.textContent = 'Geschafft! 🎊';
      return;
    }
    const current = round.tasks[round.index];
    questionText.textContent = formatTask(current);
  }

  function formatTask(task) {
    if (task.op === 'div') return `${task.a} ÷ ${task.b} = ?`;
    if (task.op === 'mul') return `${task.a} × ${task.b} = ?`;
    if (task.op === 'pvs') {
      const { a, b, c, form } = task;
      switch (form) {
        case 'mul_add_after':  return `${a} × ${b} + ${c} = ?`;
        case 'add_before_mul': return `${c} + ${a} × ${b} = ?`;
        case 'mul_sub_after':  return `${a} × ${b} − ${c} = ?`;
        case 'sub_before_mul': return `${c} − ${a} × ${b} = ?`;
        case 'div_add_after':  return `${a} ÷ ${b} + ${c} = ?`;
        case 'add_before_div': return `${c} + ${a} ÷ ${b} = ?`;
        case 'div_sub_after':  return `${a} ÷ ${b} − ${c} = ?`;
        case 'sub_before_div': return `${c} − ${a} ÷ ${b} = ?`;
      }
    }
    return `${task.a} × ${task.b} = ?`;
  }

  function submitAnswer(event) {
    event.preventDefault();
    if (!round.active) return;
    const current = round.tasks[round.index];
    const raw = answerInput.value.trim();
    if (!raw) {
      feedback('Bitte gib zuerst eine Zahl ein 😊', 'error');
      answerInput.focus();
      return;
    }

    const value = Number(raw);
    const taskLabel = formatTask(current).replace(' = ?', '');

    if (value === current.answer) {
      round.correct += 1;
      feedback(randomFrom([
        'Richtig! Stark gerechnet! 🌟',
        'Super! Das war klasse! 🎉',
        'Genau! Weiter so! 🚀',
        'Prima! Du bist im Flow! 😄'
      ]), 'success');
      questionWrap.classList.remove('shake');
      questionWrap.classList.add('pulse');
      setTimeout(() => questionWrap.classList.remove('pulse'), 650);
    } else {
      round.errors += 1;
      round.mistakes.push({
        task: taskLabel,
        correctAnswer: current.answer,
        givenAnswer: raw
      });
      feedback(`Fast! ${taskLabel} = ${current.answer}. Weiter geht's! 💛`, 'error');
      questionWrap.classList.remove('shake');
      void questionWrap.offsetWidth;
      questionWrap.classList.add('shake');
    }

    round.index += 1;
    answerInput.value = '';

    if (round.index >= round.totalQuestions) {
      finishRound();
      return;
    }

    syncQuestion();
    syncView();
    answerInput.focus();
  }

  function finishRound() {
    clearInterval(timer);
    round.active = false;
    round.finished = true;
    round.elapsedSeconds = Math.max(1, Math.floor((performance.now() - round.startedAt) / 1000));
    answerInput.disabled = true;
    submitBtn.disabled = true;
    startBtn.disabled = false;
    playerName.disabled = false;
    modeInputs.forEach(input => input.disabled = false);
    rowSelect.disabled = false;
    syncQuestion();
    syncView();

    const finalSeconds = round.elapsedSeconds + round.errors * PENALTY_SECONDS;
    const metrics = evaluateRound(round.correct, round.errors, finalSeconds, round.mode, round.totalQuestions);

    rawTimeResult.textContent = formatTime(round.elapsedSeconds);
    finalTimeResult.textContent = formatTime(finalSeconds);
    correctResult.textContent = `${round.correct} von ${round.totalQuestions}`;
    scoreResult.textContent = String(metrics.score);
    gradeBadge.textContent = `${metrics.emoji} Note ${metrics.grade}`;
    gradeBadge.className = `grade-badge grade-${metrics.grade}`;
    motivationText.textContent = metrics.message;
    gradingInfo.textContent = `Modus: ${MODES[round.mode].title} · Fehlerquote: ${metrics.errorPercent}% · Zeitwertung: ${metrics.timeText} · Strafzeit: ${round.errors * PENALTY_SECONDS} Sekunden.`;
    resultsBox.classList.add('show', 'bounce-in');
    setTimeout(() => resultsBox.classList.remove('bounce-in'), 700);
    renderMistakes();
    feedback(metrics.finishText, metrics.grade <= 3 ? 'success' : '');
    storeHighscore(metrics.score, metrics.grade, finalSeconds, round.mode);
    renderHighscores();
  }

  function renderMistakes() {
    if (!round.mistakes.length) {
      mistakesList.innerHTML = '<div class="mistake-item">Perfekt! Alle Aufgaben waren richtig gelöst. 🎉<small>Es gibt nichts zum Nachschauen.</small></div>';
      return;
    }
    mistakesList.innerHTML = round.mistakes.map(entry => `
      <div class="mistake-item">
        ${entry.task} = ${entry.correctAnswer}
        <small>Deine Antwort: ${entry.givenAnswer}</small>
      </div>
    `).join('');
  }

  // ---------- Evaluation ----------
  function evaluateRound(correct, errors, finalSeconds, modeKey, total) {
    const errorPercent = Math.round((errors / total) * 100);
    let errorScore;
    if (errorPercent <= 3) errorScore = 100;
    else if (errorPercent <= 7) errorScore = 92;
    else if (errorPercent <= 13) errorScore = 82;
    else if (errorPercent <= 20) errorScore = 70;
    else if (errorPercent <= 30) errorScore = 54;
    else errorScore = 30;

    const timeThresholds = {
      core:      [120, 180, 240, 300, 390],
      core_div:  [120, 180, 240, 300, 390],
      core_mix:  [150, 210, 280, 350, 440],
      small:     [150, 210, 270, 340, 430],
      small_div: [150, 210, 270, 340, 430],
      small_mix: [170, 230, 300, 370, 460],
      large:     [210, 300, 390, 500, 620],
      large_div: [210, 300, 390, 500, 620],
      large_mix: [240, 330, 420, 530, 650],
      row_mul:   [120, 180, 240, 300, 390],
      row_div:   [120, 180, 240, 300, 390],
      pvs:       [150, 220, 290, 360, 460]
    }[modeKey] || [180, 240, 300, 360, 450];

    let timeScore;
    let timeText;
    if (finalSeconds <= timeThresholds[0]) { timeScore = 100; timeText = 'sehr schnell ⚡'; }
    else if (finalSeconds <= timeThresholds[1]) { timeScore = 92; timeText = 'schnell 😊'; }
    else if (finalSeconds <= timeThresholds[2]) { timeScore = 82; timeText = 'gut im Tempo 👍'; }
    else if (finalSeconds <= timeThresholds[3]) { timeScore = 72; timeText = 'ordentlich ⏱️'; }
    else if (finalSeconds <= timeThresholds[4]) { timeScore = 58; timeText = 'noch okay 🙂'; }
    else { timeScore = 40; timeText = 'eher langsam, aber geschafft 💪'; }

    const combined = Math.round(errorScore * 0.7 + timeScore * 0.3);

    // Strengere Notengrenzen
    let grade;
    if (combined >= 97) grade = 1;
    else if (combined >= 86) grade = 2;
    else if (combined >= 67) grade = 3;
    else if (combined >= 50) grade = 4;
    else if (combined >= 25) grade = 5;
    else grade = 6;

    const modeBonus = {
      core: 0, core_div: 20, core_mix: 40,
      small: 120, small_div: 140, small_mix: 170,
      large: 280, large_div: 300, large_mix: 340,
      row_mul: 60, row_div: 70,
      pvs: 90
    }[modeKey] || 0;

    const score = Math.max(0, Math.round(correct * 120 - finalSeconds * 2 - errors * 35 + combined * 12 + modeBonus));

    const texts = {
      1: { emoji: '🏅', message: 'Wow! Das war eine spitzenmäßige Runde! Du rechnest richtig sicher und flott! 🎉', finishText: 'Fantastisch! Du hast eine echte Mathe-Glanzrunde geschafft! ✨' },
      2: { emoji: '🌟', message: 'Richtig stark! Das war schon richtig gut. Noch ein bisschen üben und du bist ganz vorne! 🚀', finishText: 'Super gemacht! Das war eine tolle Leistung! 😄' },
      3: { emoji: '👍', message: 'Gut geschafft! Du bist auf einem tollen Weg. Mit etwas Übung wird es noch leichter. 🌈', finishText: 'Gut gemacht! Weiter üben lohnt sich richtig! 📚' },
      4: { emoji: '🙂', message: 'Ordentlich geschafft! Du kannst stolz sein. Beim nächsten Mal klappen bestimmt noch mehr Aufgaben sicher. 💪', finishText: 'Geschafft! Bleib dran, dann wird es immer besser! 🌻' },
      5: { emoji: '💛', message: 'Du hast durchgehalten, und das zählt! Übung macht hier den Unterschied. Du schaffst das! 🤗', finishText: 'Nicht aufgeben! Jede Runde macht dich stärker. 🌟' },
      6: { emoji: '🧡', message: 'Heute war es schwer, aber Üben hilft ganz sicher. Schritt für Schritt wirst du sicherer. 🌼', finishText: 'Tapfer durchgezogen! Morgen läuft es schon besser. 💛' }
    };

    return {
      grade,
      score,
      errorPercent,
      timeText,
      emoji: texts[grade].emoji,
      message: texts[grade].message,
      finishText: texts[grade].finishText
    };
  }

  // ---------- Highscores ----------
  function storeHighscore(score, grade, finalSeconds, mode) {
    highscores[mode] ??= [];
    highscores[mode].push({
      name: sanitizeName(playerName.value),
      score,
      grade,
      finalSeconds,
      correct: round.correct,
      errors: round.errors,
      stamp: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
    });
    highscores[mode].sort((a, b) => b.score - a.score || a.finalSeconds - b.finalSeconds || b.correct - a.correct);
    highscores[mode] = highscores[mode].slice(0, HIGHSCORE_LIMIT);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(highscores));
  }

  function sanitizeName(value) {
    const cleaned = value.trim().replace(/\s+/g, ' ');
    return cleaned || 'Anonym';
  }

  function loadHighscores() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      const out = {};
      Object.keys(MODES).forEach(k => { out[k] = parsed[k] || []; });
      return out;
    } catch {
      const out = {};
      Object.keys(MODES).forEach(k => { out[k] = []; });
      return out;
    }
  }

  function renderHighscores() {
    const mode = getSelectedMode();
    const entries = highscores[mode] || [];
    if (!entries.length) {
      highscoreList.innerHTML = `<div class="empty-note">Noch kein Highscore für ${MODES[mode].title}. Deine Runde kann die erste sein! 🏆</div>`;
      return;
    }
    highscoreList.innerHTML = entries.map((entry, index) => `
      <div class="score-item" role="listitem">
        <div class="score-rank">${index + 1}</div>
        <div>
          <strong>${entry.name} · ${entry.score} Punkte · Note ${entry.grade}</strong>
          <small>${formatTime(entry.finalSeconds)} · ${entry.correct} richtig · ${entry.errors} Fehler</small>
        </div>
        <small>${entry.stamp}</small>
      </div>
    `).join('');
  }

  // ---------- View ----------
  function syncView() {
    progressValue.textContent = `${Math.min(round.index, round.totalQuestions)} / ${round.totalQuestions}`;
    timeValue.textContent = formatTime(round.elapsedSeconds);
    errorsValue.textContent = String(round.errors);
    penaltyValue.textContent = `${round.errors * PENALTY_SECONDS} s`;
    modeValue.textContent = MODES[getSelectedMode()].label;
  }

  function formatTime(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  function feedback(message, type) {
    feedbackBox.textContent = message;
    feedbackBox.className = 'feedback';
    if (type) feedbackBox.classList.add(type);
  }

  function randomFrom(values) {
    return values[Math.floor(Math.random() * values.length)];
  }
})();