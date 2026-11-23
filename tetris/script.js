(() => {
  'use strict';

  const COLS = 10;
  const ROWS = 20;
  const CELL = 30;
  const TYPES = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
  const SHAPES = {
    I: [[0,0,0,0], [1,1,1,1], [0,0,0,0], [0,0,0,0]],
    O: [[1,1], [1,1]],
    T: [[0,1,0], [1,1,1], [0,0,0]],
    S: [[0,1,1], [1,1,0], [0,0,0]],
    Z: [[1,1,0], [0,1,1], [0,0,0]],
    J: [[1,0,0], [1,1,1], [0,0,0]],
    L: [[0,0,1], [1,1,1], [0,0,0]]
  };
  const COLORS = {
    I: '#46D8E8', O: '#FFD166', T: '#B18AFF', S: '#4ED6A4',
    Z: '#FF6E86', J: '#69A7FF', L: '#FFAA69'
  };

  const $ = id => document.getElementById(id);
  const canvas = $('game');
  const ctx = canvas.getContext('2d');
  const nextCanvas = $('nextPreview');
  const holdCanvas = $('holdPreview');
  const nextCtx = nextCanvas.getContext('2d');
  const holdCtx = holdCanvas.getContext('2d');
  const overlay = $('overlay');
  const pauseButton = $('pauseButton');
  const holdButton = $('holdButton');
  const soundButton = $('soundButton');

  let board = emptyBoard();
  let bag = [];
  let queue = [];
  let piece = null;
  let heldType = null;
  let holdUsed = false;
  let score = 0;
  let lines = 0;
  let level = 1;
  let best = loadBest();
  let state = 'ready'; // ready | running | paused | over
  let dropTimer = 0;
  let previousFrame = 0;
  let soundOn = false;
  let audioContext = null;

  function emptyBoard() {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  }

  function loadBest() {
    try { return Number(localStorage.getItem('safa-tetris-best')) || 0; }
    catch (_) { return 0; }
  }

  function saveBest() {
    try { localStorage.setItem('safa-tetris-best', String(best)); }
    catch (_) { /* storage can be disabled */ }
  }

  function updateStats() {
    if (score > best) { best = score; saveBest(); }
    $('score').textContent = score.toLocaleString();
    $('best').textContent = best.toLocaleString();
    $('lines').textContent = String(lines);
    $('level').textContent = String(level);
  }

  function shuffleBag() {
    const nextBag = [...TYPES];
    for (let i = nextBag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [nextBag[i], nextBag[j]] = [nextBag[j], nextBag[i]];
    }
    bag.push(...nextBag);
  }

  function ensureQueue() {
    while (queue.length < 5) {
      if (bag.length === 0) shuffleBag();
      queue.push(bag.shift());
    }
  }

  function makePiece(type) {
    const matrix = SHAPES[type].map(row => [...row]);
    return { type, matrix, x: Math.floor((COLS - matrix.length) / 2), y: -1 };
  }

  function canPlace(matrix, x, y) {
    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[r].length; c++) {
        if (!matrix[r][c]) continue;
        const bx = x + c;
        const by = y + r;
        if (bx < 0 || bx >= COLS || by >= ROWS) return false;
        if (by >= 0 && board[by][bx]) return false;
      }
    }
    return true;
  }

  function spawn() {
    ensureQueue();
    piece = makePiece(queue.shift());
    ensureQueue();
    drawPreviews();
    if (!canPlace(piece.matrix, piece.x, piece.y)) endGame();
  }

  function startGame() {
    board = emptyBoard();
    bag = [];
    queue = [];
    piece = null;
    heldType = null;
    holdUsed = false;
    score = 0;
    lines = 0;
    level = 1;
    dropTimer = 0;
    previousFrame = performance.now();
    state = 'running';
    spawn();
    updateStats();
    updateUI();
    playSound(440, 70, 'sine', 0.035);
    if (window.matchMedia('(max-width: 720px)').matches) {
      document.querySelector('.board-panel').scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
  }

  function endGame() {
    state = 'over';
    if (score > best) { best = score; saveBest(); }
    updateStats();
    updateUI();
    playSound(170, 240, 'triangle', 0.06);
  }

  function pauseGame() {
    if (state === 'running') state = 'paused';
    else if (state === 'paused') {
      state = 'running';
      previousFrame = performance.now();
      dropTimer = 0;
    } else return;
    updateUI();
  }

  function updateUI() {
    const info = {
      ready: ['READY, PLAYER ONE?', "Make your first move. You've got this.", 'Start playing', 'PRESS ENTER TO START', 'READY TO PLAY'],
      paused: ['GAME PAUSED', 'Take your time. Your blocks will be here.', 'Resume game', 'PRESS P TO RESUME', 'PAUSED'],
      over: ['GAME OVER', `You scored ${score.toLocaleString()} points. Ready to try again?`, 'Play again', 'PRESS ENTER TO RESTART', 'GAME OVER'],
      running: ['', '', '', '', 'GAME IN PROGRESS']
    }[state];
    $('gameStatus').textContent = info[4];
    overlay.classList.toggle('is-hidden', state === 'running');
    $('overlayTitle').textContent = info[0];
    $('overlayDescription').textContent = info[1];
    $('overlayButton').innerHTML = `${info[2]} <span aria-hidden="true">→</span>`;
    document.querySelector('.overlay-hint').textContent = info[3];
    pauseButton.disabled = state === 'ready' || state === 'over';
    pauseButton.textContent = state === 'paused' ? '▶ Resume' : 'Ⅱ Pause';
    holdButton.disabled = state !== 'running' || holdUsed;
  }

  function move(dx) {
    if (state !== 'running') return;
    if (canPlace(piece.matrix, piece.x + dx, piece.y)) {
      piece.x += dx;
    }
  }

  function rotateMatrix(matrix, direction) {
    const n = matrix.length;
    return matrix.map((row, r) => row.map((_, c) =>
      direction === 1 ? matrix[n - c - 1][r] : matrix[c][n - r - 1]
    ));
  }

  function rotatePiece(direction = 1) {
    if (state !== 'running') return;
    if (piece.type === 'O') return;
    const rotated = rotateMatrix(piece.matrix, direction);
    const kicks = [[0,0], [-1,0], [1,0], [-2,0], [2,0], [0,-1], [-1,-1], [1,-1], [0,-2]];
    for (const [dx, dy] of kicks) {
      if (canPlace(rotated, piece.x + dx, piece.y + dy)) {
        piece.matrix = rotated;
        piece.x += dx;
        piece.y += dy;
        playSound(420, 30, 'sine', 0.014);
        return;
      }
    }
  }

  function stepDown(manual = false) {
    if (state !== 'running') return;
    if (canPlace(piece.matrix, piece.x, piece.y + 1)) {
      piece.y++;
      if (manual) { score++; updateStats(); }
    } else {
      lockPiece();
    }
    if (manual) dropTimer = 0;
  }

  function hardDrop() {
    if (state !== 'running') return;
    let distance = 0;
    while (canPlace(piece.matrix, piece.x, piece.y + 1)) {
      piece.y++;
      distance++;
    }
    score += distance * 2;
    playSound(240, 65, 'triangle', 0.037);
    lockPiece();
    dropTimer = 0;
    updateStats();
  }

  function lockPiece() {
    let aboveTop = false;
    for (let r = 0; r < piece.matrix.length; r++) {
      for (let c = 0; c < piece.matrix[r].length; c++) {
        if (!piece.matrix[r][c]) continue;
        const y = piece.y + r;
        if (y < 0) aboveTop = true;
        else board[y][piece.x + c] = piece.type;
      }
    }
    if (aboveTop) { endGame(); return; }

    let cleared = 0;
    const remaining = board.filter(row => {
      if (row.every(Boolean)) { cleared++; return false; }
      return true;
    });
    while (remaining.length < ROWS) remaining.unshift(Array(COLS).fill(null));
    board = remaining;
    if (cleared > 0) {
      const scores = [0, 100, 300, 500, 800];
      score += scores[cleared] * level;
      lines += cleared;
      level = 1 + Math.floor(lines / 10);
      playSound(560 + cleared * 100, 150, 'triangle', 0.052);
    }
    holdUsed = false;
    spawn();
    updateStats();
    updateUI();
  }

  function holdPiece() {
    if (state !== 'running' || holdUsed) return;
    const outgoing = piece.type;
    if (heldType === null) {
      heldType = outgoing;
      spawn();
    } else {
      piece = makePiece(heldType);
      heldType = outgoing;
      if (!canPlace(piece.matrix, piece.x, piece.y)) endGame();
    }
    holdUsed = true;
    drawPreviews();
    updateUI();
    playSound(330, 60, 'sine', .022);
  }

  function gravityMs() {
    return Math.max(80, 850 * Math.pow(0.83, level - 1));
  }

  function renderCell(context, x, y, size, type, ghost = false) {
    const color = COLORS[type];
    if (ghost) {
      context.fillStyle = color + '16';
      context.fillRect(x + 2, y + 2, size - 4, size - 4);
      context.strokeStyle = color + '7a';
      context.lineWidth = 1.5;
      context.strokeRect(x + 3, y + 3, size - 6, size - 6);
      return;
    }
    context.fillStyle = color;
    context.fillRect(x + 1.5, y + 1.5, size - 3, size - 3);
    context.fillStyle = 'rgba(255,255,255,.24)';
    context.fillRect(x + 3, y + 3, size - 6, 3);
    context.fillRect(x + 3, y + 3, 3, size - 6);
    context.fillStyle = 'rgba(5,16,31,.22)';
    context.fillRect(x + 4, y + size - 7, size - 7, 3);
    context.fillRect(x + size - 7, y + 4, 3, size - 8);
  }

  function drawBoard() {
    ctx.fillStyle = '#0b1727';
    ctx.fillRect(0, 0, COLS * CELL, ROWS * CELL);
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(100,141,180,.085)';
    ctx.lineWidth = 1;
    for (let c = 1; c < COLS; c++) {
      ctx.moveTo(c * CELL + .5, 0);
      ctx.lineTo(c * CELL + .5, ROWS * CELL);
    }
    for (let r = 1; r < ROWS; r++) {
      ctx.moveTo(0, r * CELL + .5);
      ctx.lineTo(COLS * CELL, r * CELL + .5);
    }
    ctx.stroke();

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (board[r][c]) renderCell(ctx, c * CELL, r * CELL, CELL, board[r][c]);
      }
    }
    if (!piece || (state !== 'running' && state !== 'paused')) return;
    let ghostY = piece.y;
    while (canPlace(piece.matrix, piece.x, ghostY + 1)) ghostY++;
    for (let r = 0; r < piece.matrix.length; r++) {
      for (let c = 0; c < piece.matrix[r].length; c++) {
        if (!piece.matrix[r][c]) continue;
        if (ghostY + r >= 0) renderCell(ctx, (piece.x + c) * CELL, (ghostY + r) * CELL, CELL, piece.type, true);
      }
    }
    for (let r = 0; r < piece.matrix.length; r++) {
      for (let c = 0; c < piece.matrix[r].length; c++) {
        if (!piece.matrix[r][c]) continue;
        if (piece.y + r >= 0) renderCell(ctx, (piece.x + c) * CELL, (piece.y + r) * CELL, CELL, piece.type);
      }
    }
  }

  function drawPreview(context, previewCanvas, type) {
    context.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    if (!type) return;
    const matrix = SHAPES[type];
    const filled = [];
    matrix.forEach((row, r) => row.forEach((cell, c) => { if (cell) filled.push([r, c]); }));
    const minX = Math.min(...filled.map(cell => cell[1]));
    const maxX = Math.max(...filled.map(cell => cell[1]));
    const minY = Math.min(...filled.map(cell => cell[0]));
    const maxY = Math.max(...filled.map(cell => cell[0]));
    const size = 25;
    const startX = (previewCanvas.width - (maxX - minX + 1) * size) / 2;
    const startY = (previewCanvas.height - (maxY - minY + 1) * size) / 2;
    for (const [r, c] of filled) {
      renderCell(context, startX + (c - minX) * size, startY + (r - minY) * size, size, type);
    }
  }

  function drawPreviews() {
    drawPreview(nextCtx, nextCanvas, queue[0] || null);
    drawPreview(holdCtx, holdCanvas, heldType);
  }

  function frame(time) {
    if (!previousFrame) previousFrame = time;
    const elapsed = Math.min(time - previousFrame, 100);
    previousFrame = time;
    if (state === 'running') {
      dropTimer += elapsed;
      if (dropTimer >= gravityMs()) {
        dropTimer = 0;
        stepDown();
      }
    }
    drawBoard();
    requestAnimationFrame(frame);
  }

  function playSound(frequency, duration, shape = 'sine', volume = .03) {
    if (!soundOn) return;
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      if (!audioContext) audioContext = new AudioContextClass();
      if (audioContext.state === 'suspended') audioContext.resume();
      const tone = audioContext.createOscillator();
      const gain = audioContext.createGain();
      tone.type = shape;
      tone.frequency.value = frequency;
      gain.gain.setValueAtTime(volume, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + duration / 1000);
      tone.connect(gain);
      gain.connect(audioContext.destination);
      tone.start();
      tone.stop(audioContext.currentTime + duration / 1000);
    } catch (_) { /* audio unavailable */ }
  }

  function performAction(action) {
    switch (action) {
      case 'left': move(-1); break;
      case 'right': move(1); break;
      case 'rotate': rotatePiece(1); break;
      case 'rotateBack': rotatePiece(-1); break;
      case 'down': stepDown(true); break;
      case 'drop': hardDrop(); break;
      case 'hold': holdPiece(); break;
      case 'pause': pauseGame(); break;
    }
  }

  document.addEventListener('keydown', event => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const actionByCode = {
      ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'rotate',
      KeyX: 'rotate', KeyZ: 'rotateBack', ArrowDown: 'down',
      Space: 'drop', KeyC: 'hold', ShiftLeft: 'hold', ShiftRight: 'hold'
    };
    if (event.code in actionByCode) {
      event.preventDefault();
      if (!event.repeat || !['rotate', 'rotateBack', 'drop', 'hold'].includes(actionByCode[event.code])) {
        performAction(actionByCode[event.code]);
      }
    } else if (event.code === 'Enter' && state !== 'running') {
      event.preventDefault();
      if (state === 'paused') pauseGame();
      else startGame();
    } else if ((event.code === 'KeyP' || event.code === 'Escape') && !event.repeat) {
      event.preventDefault();
      pauseGame();
    } else if (event.code === 'KeyR' && !event.repeat) {
      startGame();
    } else if (event.code === 'KeyM' && !event.repeat) {
      toggleSound();
    }
  });

  function toggleSound() {
    soundOn = !soundOn;
    soundButton.textContent = soundOn ? '♫ Sound on' : '♪ Sound off';
    soundButton.setAttribute('aria-pressed', String(soundOn));
    if (soundOn) playSound(620, 75, 'sine', .025);
  }

  $('newGameButton').addEventListener('click', startGame);
  $('overlayButton').addEventListener('click', () => state === 'paused' ? pauseGame() : startGame());
  pauseButton.addEventListener('click', pauseGame);
  soundButton.addEventListener('click', toggleSound);
  holdButton.addEventListener('click', holdPiece);

  let holdDelay = null;
  let holdInterval = null;
  function stopRepeating() {
    clearTimeout(holdDelay);
    clearInterval(holdInterval);
    holdDelay = null;
    holdInterval = null;
  }
  document.querySelectorAll('.touch-button').forEach(button => {
    button.addEventListener('pointerdown', event => {
      event.preventDefault();
      stopRepeating();
      const action = button.dataset.action;
      performAction(action);
      if (['left', 'right', 'down'].includes(action)) {
        holdDelay = setTimeout(() => {
          holdInterval = setInterval(() => performAction(action), 85);
        }, 250);
      }
      if (button.setPointerCapture) button.setPointerCapture(event.pointerId);
    });
    button.addEventListener('pointerup', stopRepeating);
    button.addEventListener('pointercancel', stopRepeating);
    button.addEventListener('lostpointercapture', stopRepeating);
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state === 'running') pauseGame();
  });

  updateStats();
  drawPreviews();
  updateUI();
  requestAnimationFrame(frame);
})();
