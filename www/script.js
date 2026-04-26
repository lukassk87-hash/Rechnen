(() => {
  const TOTAL_QUESTIONS = 30;
  const PENALTY_SECONDS = 10;
  const HIGHSCORE_LIMIT = 5;
  const STORAGE_KEY = 'math-trainer-highscores-v3';

  const MODES = {
    core: {
      label: 'Kern',
      title: 'Kernaufgaben',
      description: 'Aktiv: Kernaufgaben mit ×1, ×2, ×5 und ×10.',
      bank: () => buildCoreBank()
    },
    small: {
      label: 'Klein',
      title: 'Kleines 1×1',
      description: 'Aktiv: alle Aufgaben des kleinen 1×1 von 1 bis 10.',
      bank: () => buildRangeBank(1, 10)
    },
    large: {
      label: 'Groß',
      title: 'Großes 1×1',
      description: 'Aktiv: alle Aufgaben des großen 1×1 von 1 bis 20.',
      bank: () => buildRangeBank(1, 20)
    }
  };

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

  let round = resetRound();
  let timer = null;
  let highscores = loadHighscores();
  syncModeUI();
  renderHighscores();
  syncQuestion();
  syncView();

  modeInputs.forEach(input => input.addEventListener('change', () => {
    if (round.active) return;
    round.mode = input.value;
    syncModeUI();
    renderHighscores();
  }));
  startBtn.addEventListener('click', startRound);
  restartBtn.addEventListener('click', restartRound);
  answerForm.addEventListener('submit', submitAnswer);

  function resetRound() {
    return {
      mode: getSelectedMode(),
      tasks: [],
      index: 0,
      errors: 0,
      correct: 0,
      mistakes: [],
      startedAt: null,
      elapsedSeconds: 0,
      active: false,
      finished: false
    };
  }

  function getSelectedMode() {
    return modeInputs.find(input => input.checked)?.value || 'core';
  }

  function syncThemeToggle() {
    themeToggle.textContent = currentTheme === 'dark' ? '☀️' : '🌙';
    themeToggle.setAttribute('aria-label', currentTheme === 'dark' ? 'Hellen Modus aktivieren' : 'Dunklen Modus aktivieren');
  }

  function syncModeUI() {
    modeCards.forEach(card => {
      const checked = card.querySelector('input').checked;
      card.classList.toggle('active', checked);
    });
    const mode = MODES[getSelectedMode()];
    modeDescription.textContent = mode.description;
    modeValue.textContent = mode.label;
  }

  function buildCoreBank() {
    return uniqueTasks(buildLimitedBank([1, 2, 5, 10], 10));
  }

  function buildRangeBank(min, max) {
    const tasks = [];
    for (let a = min; a <= max; a += 1) {
      for (let b = min; b <= max; b += 1) {
        tasks.push({ a, b, answer: a * b });
      }
    }
    return uniqueTasks(tasks);
  }

  function buildLimitedBank(multipliers, limit) {
    const tasks = [];
    multipliers.forEach(multiplier => {
      for (let factor = 1; factor <= limit; factor += 1) {
        tasks.push({ a: factor, b: multiplier, answer: factor * multiplier });
        tasks.push({ a: multiplier, b: factor, answer: factor * multiplier });
      }
    });
    return tasks;
  }

  function uniqueTasks(tasks) {
    const seen = new Set();
    return tasks.filter(task => {
      const key = `${task.a}x${task.b}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function sampleTasks(modeKey) {
    const pool = [...MODES[modeKey].bank()];
    if (pool.length < TOTAL_QUESTIONS) {
      throw new Error('Zu wenige Aufgaben im Aufgabenpool.');
    }
    const selected = [];
    while (selected.length < TOTAL_QUESTIONS) {
      const index = Math.floor(Math.random() * pool.length);
      const task = pool.splice(index, 1)[0];
      if (task) selected.push(task);
    }
    return selected;
  }

  function startRound() {
    round = resetRound();
    round.mode = getSelectedMode();
    round.tasks = sampleTasks(round.mode);
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
    questionText.textContent = `${current.a} × ${current.b} = ?`;
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
        task: `${current.a} × ${current.b}`,
        correctAnswer: current.answer,
        givenAnswer: raw
      });
      feedback(`Fast! ${current.a} × ${current.b} = ${current.answer}. Weiter geht's! 💛`, 'error');
      questionWrap.classList.remove('shake');
      void questionWrap.offsetWidth;
      questionWrap.classList.add('shake');
    }

    round.index += 1;
    answerInput.value = '';

    if (round.index >= TOTAL_QUESTIONS) {
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
    syncQuestion();
    syncView();

    const finalSeconds = round.elapsedSeconds + round.errors * PENALTY_SECONDS;
    const metrics = evaluateRound(round.correct, round.errors, finalSeconds, round.mode);
    rawTimeResult.textContent = formatTime(round.elapsedSeconds);
    finalTimeResult.textContent = formatTime(finalSeconds);
    correctResult.textContent = `${round.correct} von ${TOTAL_QUESTIONS}`;
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

  function evaluateRound(correct, errors, finalSeconds, modeKey) {
    const errorPercent = Math.round((errors / TOTAL_QUESTIONS) * 100);
    let errorScore;
    if (errorPercent <= 3) errorScore = 100;
    else if (errorPercent <= 7) errorScore = 92;
    else if (errorPercent <= 13) errorScore = 82;
    else if (errorPercent <= 20) errorScore = 70;
    else if (errorPercent <= 30) errorScore = 54;
    else errorScore = 30;

    const timeThresholds = {
      core: [120, 180, 240, 300, 390],
      small: [150, 210, 270, 340, 430],
      large: [210, 300, 390, 500, 620]
    }[modeKey];

    let timeScore;
    let timeText;
    if (finalSeconds <= timeThresholds[0]) {
      timeScore = 100;
      timeText = 'sehr schnell ⚡';
    } else if (finalSeconds <= timeThresholds[1]) {
      timeScore = 92;
      timeText = 'schnell 😊';
    } else if (finalSeconds <= timeThresholds[2]) {
      timeScore = 82;
      timeText = 'gut im Tempo 👍';
    } else if (finalSeconds <= timeThresholds[3]) {
      timeScore = 72;
      timeText = 'ordentlich ⏱️';
    } else if (finalSeconds <= timeThresholds[4]) {
      timeScore = 58;
      timeText = 'noch okay 🙂';
    } else {
      timeScore = 40;
      timeText = 'eher langsam, aber geschafft 💪';
    }

    const combined = Math.round(errorScore * 0.7 + timeScore * 0.3);
    let grade;
    if (combined >= 92) grade = 1;
    else if (combined >= 81) grade = 2;
    else if (combined >= 67) grade = 3;
    else if (combined >= 50) grade = 4;
    else if (combined >= 30) grade = 5;
    else grade = 6;

    const modeBonus = { core: 0, small: 120, large: 280 }[modeKey];
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
    const cleaned = value.trim().replace(/s+/g, ' ');
    return cleaned || 'Anonym';
  }

  function loadHighscores() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return { core: parsed.core || [], small: parsed.small || [], large: parsed.large || [] };
    } catch {
      return { core: [], small: [], large: [] };
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

  function syncView() {
    progressValue.textContent = `${Math.min(round.index, TOTAL_QUESTIONS)} / ${TOTAL_QUESTIONS}`;
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