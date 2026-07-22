(function () {
  'use strict';

  var canvas = document.getElementById('board');
  var ctx = canvas.getContext('2d');
  var scoreEl = document.getElementById('score');
  var highScoreEl = document.getElementById('high-score');
  var overlay = document.getElementById('overlay');
  var overlayTitle = document.getElementById('overlay-title');
  var overlaySub = document.getElementById('overlay-sub');
  var startBtn = document.getElementById('start-btn');

  var GRID = 24; // 24 x 24 cells
  var CELL = canvas.width / GRID; // 20px
  var BASE_SPEED = 140; // ms per tick
  var MIN_SPEED = 60;

  var COLORS = {
    bg: '#161b22',
    grid: 'rgba(255, 255, 255, 0.03)',
    snakeHead: '#56d364',
    snakeBody: '#3fb950',
    snakeTail: '#2ea043',
    food: '#f85149',
    foodGlow: 'rgba(248, 81, 73, 0.35)',
  };

  var STORAGE_KEY = 'snake-high-score';

  // Game state
  var snake, dir, nextDir, food, score, highScore, speed;
  var running = false;
  var paused = false;
  var gameOver = false;
  var lastTick = 0;
  var rafId = null;

  highScore = parseInt(localStorage.getItem(STORAGE_KEY), 10) || 0;
  highScoreEl.textContent = highScore;

  function reset() {
    var mid = Math.floor(GRID / 2);
    snake = [
      { x: mid, y: mid },
      { x: mid - 1, y: mid },
      { x: mid - 2, y: mid },
    ];
    dir = { x: 1, y: 0 };
    nextDir = dir;
    score = 0;
    speed = BASE_SPEED;
    gameOver = false;
    paused = false;
    scoreEl.textContent = '0';
    placeFood();
  }

  function placeFood() {
    var free = [];
    for (var y = 0; y < GRID; y++) {
      for (var x = 0; x < GRID; x++) {
        var occupied = snake.some(function (s) {
          return s.x === x && s.y === y;
        });
        if (!occupied) free.push({ x: x, y: y });
      }
    }
    food = free[Math.floor(Math.random() * free.length)];
  }

  function setDirection(d) {
    var dirs = {
      up: { x: 0, y: -1 },
      down: { x: 0, y: 1 },
      left: { x: -1, y: 0 },
      right: { x: 1, y: 0 },
    };
    var nd = dirs[d];
    if (!nd) return;
    // Disallow reversing into yourself
    if (nd.x === -dir.x && nd.y === -dir.y) return;
    nextDir = nd;
  }

  function tick() {
    dir = nextDir;
    var head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

    // Wall collision
    if (head.x < 0 || head.x >= GRID || head.y < 0 || head.y >= GRID) {
      return endGame();
    }
    // Self collision (ignore tail tip, it moves away this tick)
    for (var i = 0; i < snake.length - 1; i++) {
      if (snake[i].x === head.x && snake[i].y === head.y) {
        return endGame();
      }
    }

    snake.unshift(head);

    if (head.x === food.x && head.y === food.y) {
      score += 10;
      scoreEl.textContent = score;
      speed = Math.max(MIN_SPEED, BASE_SPEED - Math.floor(score / 50) * 8);
      if (snake.length === GRID * GRID) return winGame();
      placeFood();
    } else {
      snake.pop();
    }
  }

  function draw() {
    // Background
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Grid lines
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    for (var i = 1; i < GRID; i++) {
      ctx.beginPath();
      ctx.moveTo(i * CELL, 0);
      ctx.lineTo(i * CELL, canvas.height);
      ctx.moveTo(0, i * CELL);
      ctx.lineTo(canvas.width, i * CELL);
      ctx.stroke();
    }

    // Food (glowing circle)
    var fx = food.x * CELL + CELL / 2;
    var fy = food.y * CELL + CELL / 2;
    ctx.fillStyle = COLORS.foodGlow;
    ctx.beginPath();
    ctx.arc(fx, fy, CELL * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.food;
    ctx.beginPath();
    ctx.arc(fx, fy, CELL * 0.33, 0, Math.PI * 2);
    ctx.fill();

    // Snake (rounded segments, gradient from head to tail)
    for (var s = snake.length - 1; s >= 0; s--) {
      var seg = snake[s];
      var t = s / Math.max(snake.length - 1, 1);
      ctx.fillStyle =
        s === 0 ? COLORS.snakeHead : t > 0.7 ? COLORS.snakeTail : COLORS.snakeBody;
      var pad = s === 0 ? 1 : 2;
      roundRect(seg.x * CELL + pad, seg.y * CELL + pad, CELL - pad * 2, CELL - pad * 2, 5);
    }

    // Eyes on the head
    var head = snake[0];
    ctx.fillStyle = '#0d1117';
    var ex = head.x * CELL + CELL / 2;
    var ey = head.y * CELL + CELL / 2;
    var ox = dir.x !== 0 ? dir.x * 3 : 0;
    var oy = dir.y !== 0 ? dir.y * 3 : 0;
    var px = dir.x !== 0 ? 0 : 4;
    var py = dir.y !== 0 ? 0 : 4;
    ctx.beginPath();
    ctx.arc(ex + ox + px, ey + oy + py, 2, 0, Math.PI * 2);
    ctx.arc(ex + ox - px, ey + oy - py, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fill();
  }

  function loop(timestamp) {
    rafId = requestAnimationFrame(loop);
    if (paused || gameOver) return;
    if (timestamp - lastTick >= speed) {
      lastTick = timestamp;
      tick();
      draw();
    }
  }

  function startGame() {
    reset();
    running = true;
    hideOverlay();
    draw();
    lastTick = performance.now();
    if (rafId === null) rafId = requestAnimationFrame(loop);
  }

  function endGame() {
    gameOver = true;
    running = false;
    if (score > highScore) {
      highScore = score;
      highScoreEl.textContent = highScore;
      localStorage.setItem(STORAGE_KEY, String(highScore));
      showOverlay('GAME OVER', 'New best: ' + score + '! Press Enter or tap to play again', 'Play Again');
    } else {
      showOverlay('GAME OVER', 'Score: ' + score + ' \u00B7 Press Enter or tap to play again', 'Play Again');
    }
  }

  function winGame() {
    gameOver = true;
    running = false;
    if (score > highScore) {
      highScore = score;
      highScoreEl.textContent = highScore;
      localStorage.setItem(STORAGE_KEY, String(highScore));
    }
    showOverlay('YOU WIN!', 'Perfect game \u2014 the board is full!', 'Play Again');
  }

  function togglePause() {
    if (!running || gameOver) return;
    paused = !paused;
    if (paused) {
      showOverlay('PAUSED', 'Press Space or tap to resume', 'Resume');
    } else {
      hideOverlay();
      lastTick = performance.now();
    }
  }

  function showOverlay(title, sub, btnText) {
    overlayTitle.textContent = title;
    overlaySub.textContent = sub;
    startBtn.textContent = btnText;
    overlay.classList.remove('hidden');
  }

  function hideOverlay() {
    overlay.classList.add('hidden');
  }

  // --- Input: keyboard ---
  document.addEventListener('keydown', function (e) {
    var keyDirs = {
      ArrowUp: 'up',
      ArrowDown: 'down',
      ArrowLeft: 'left',
      ArrowRight: 'right',
      w: 'up',
      s: 'down',
      a: 'left',
      d: 'right',
      W: 'up',
      S: 'down',
      A: 'left',
      D: 'right',
    };

    if (e.key === ' ') {
      e.preventDefault();
      if (paused) togglePause();
      else if (running) togglePause();
      else startGame();
      return;
    }
    if (e.key === 'Enter' && (!running || gameOver)) {
      startGame();
      return;
    }

    var d = keyDirs[e.key];
    if (d) {
      e.preventDefault();
      if (!running && !paused) {
        startGame();
      } else if (paused) {
        togglePause();
      }
      setDirection(d);
    }
  });

  // --- Input: start / resume button ---
  startBtn.addEventListener('click', function () {
    if (paused) togglePause();
    else startGame();
  });

  // --- Input: on-screen d-pad ---
  document.querySelectorAll('.dpad-btn').forEach(function (btn) {
    var handler = function (e) {
      e.preventDefault();
      if (!running && !paused) startGame();
      else if (paused) togglePause();
      setDirection(btn.dataset.dir);
    };
    btn.addEventListener('pointerdown', handler);
  });

  // --- Input: swipe gestures on the board ---
  var touchStart = null;
  canvas.addEventListener(
    'touchstart',
    function (e) {
      touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    },
    { passive: true }
  );
  canvas.addEventListener(
    'touchmove',
    function (e) {
      e.preventDefault(); // stop page scroll while playing
    },
    { passive: false }
  );
  canvas.addEventListener('touchend', function (e) {
    if (!touchStart) return;
    var dx = e.changedTouches[0].clientX - touchStart.x;
    var dy = e.changedTouches[0].clientY - touchStart.y;
    touchStart = null;
    if (Math.abs(dx) < 20 && Math.abs(dy) < 20) {
      // Tap: start / resume
      if (!running && !paused) startGame();
      else if (paused) togglePause();
      return;
    }
    if (!running && !paused) startGame();
    else if (paused) togglePause();
    if (Math.abs(dx) > Math.abs(dy)) {
      setDirection(dx > 0 ? 'right' : 'left');
    } else {
      setDirection(dy > 0 ? 'down' : 'up');
    }
  });

  // Pause when the tab loses visibility
  document.addEventListener('visibilitychange', function () {
    if (document.hidden && running && !paused && !gameOver) togglePause();
  });

  // Initial render
  reset();
  draw();
})();
