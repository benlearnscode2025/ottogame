(function () {
  "use strict";

  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d", { alpha: false });

  const ui = {
    startScreen: document.getElementById("startScreen"),
    pauseScreen: document.getElementById("pauseScreen"),
    gameOverScreen: document.getElementById("gameOverScreen"),
    startButton: document.getElementById("startButton"),
    resumeButton: document.getElementById("resumeButton"),
    replayButton: document.getElementById("replayButton"),
    pauseButton: document.getElementById("pauseButton"),
    audioButton: document.getElementById("audioButton"),
    dashButton: document.getElementById("dashButton"),
    gameChrome: document.getElementById("gameChrome"),
    score: document.getElementById("scoreText"),
    wave: document.getElementById("waveText"),
    chain: document.getElementById("chainText"),
    shieldFill: document.getElementById("shieldFill"),
    shieldValue: document.getElementById("shieldValue"),
    vibeFill: document.getElementById("vibeFill"),
    vibeValue: document.getElementById("vibeValue"),
    vibeLabel: document.getElementById("vibeLabel"),
    dashFill: document.getElementById("dashFill"),
    objective: document.getElementById("objectiveText"),
    threat: document.getElementById("threatText"),
    status: document.getElementById("statusPill"),
    finalScore: document.getElementById("finalScoreText"),
    bestScore: document.getElementById("bestScoreText"),
    finalRooms: document.getElementById("finalRooms"),
    finalCleared: document.getElementById("finalCleared"),
    finalChain: document.getElementById("finalChain"),
    finalTime: document.getElementById("finalTime"),
    finalGrade: document.getElementById("finalGrade"),
    newBest: document.getElementById("newBestBadge"),
    resultDate: document.getElementById("resultDate"),
  };

  const view = {
    w: 1280,
    h: 720,
    dpr: 1,
  };

  const palette = {
    mint: "#d9ff43",
    cyan: "#68d7ff",
    rose: "#ff6846",
    amber: "#ffd65a",
    cream: "#f2efe5",
    shadow: "#171813",
    danger: "#ff6846",
    walnut: "#8e6bff",
    rug: "#a8a4ff",
    lilac: "#a8a4ff",
    coral: "#ff6846",
    sage: "#40564a",
  };

  const characterSprites = loadSprites({
    bodyFront: "./assets/body-front.png",
    bodyThreeQuarter: "./assets/body-three-quarter.png",
    bodySide: "./assets/body-side.png",
    bodySideOpen: "./assets/body-side-open.png",
    bodyBack: "./assets/body-back.png",
  });

  const enemySprites = loadSprites({
    carpetRoll: "./assets/enemy-carpet-roll.png",
    tackStrip: "./assets/enemy-tack-strip.png",
    carpetCrate: "./assets/enemy-carpet-crate.png",
  });

  const keys = new Set();
  const pointer = {
    x: view.w * 0.5,
    y: view.h * 0.55,
    down: false,
    active: false,
    id: null,
  };

  let audio = null;
  let lastTime = performance.now();
  let rafId = 0;
  let bestScore = readBestScore();
  let muted = false;

  let game = createGame("ready");

  function createGame(mode) {
    return {
      mode,
      time: 0,
      score: 0,
      wave: 1,
      chain: 0,
      chainTimer: 0,
      combo: 1,
      vibe: 0,
      surge: 0,
      shake: 0,
      kills: 0,
      shotsFired: 0,
      hits: 0,
      maxCombo: 1,
      dashes: 0,
      spawnLeft: 0,
      spawnTimer: 0,
      waveBreak: 0,
      player: {
        x: view.w * 0.5,
        y: view.h * 0.66,
        r: 34,
        speed: 390,
        shield: 100,
        maxShield: 100,
        cooldown: 0,
        invulnerable: 0,
        shooting: false,
        hurtTimer: 0,
        facing: 1,
        tilt: 0,
        dashCooldown: 0,
        dashTime: 0,
        dashVx: 0,
        dashVy: 0,
        lastDx: 0,
        lastDy: -1,
      },
      bullets: [],
      enemyShots: [],
      enemies: [],
      particles: [],
      pickups: [],
      announcements: [],
      stars: makeStars(120),
    };
  }

  function readBestScore() {
    try {
      return Number(localStorage.getItem("vibe-shooter-best") || 0);
    } catch (error) {
      return 0;
    }
  }

  function loadSprites(files) {
    const sprites = {};
    Object.entries(files).forEach(([key, src]) => {
      const image = new Image();
      image.decoding = "async";
      image.addEventListener("load", () => render());
      image.src = src;
      sprites[key] = image;
    });
    return sprites;
  }

  function writeBestScore(score) {
    bestScore = Math.max(bestScore, score);
    try {
      localStorage.setItem("vibe-shooter-best", String(bestScore));
    } catch (error) {
      return;
    }
  }

  function initAudio() {
    if (audio) {
      if (audio.ctx.state === "suspended") {
        audio.ctx.resume();
      }
      return;
    }

    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) {
      return;
    }

    const ctxAudio = new AudioContext();
    const master = ctxAudio.createGain();
    master.gain.value = muted ? 0 : 0.15;
    master.connect(ctxAudio.destination);
    audio = { ctx: ctxAudio, master };
  }

  function tone(freq, duration, type, gain, slide) {
    if (!audio || audio.ctx.state !== "running") {
      return;
    }

    const now = audio.ctx.currentTime;
    const osc = audio.ctx.createOscillator();
    const amp = audio.ctx.createGain();
    osc.type = type || "sine";
    osc.frequency.setValueAtTime(freq, now);
    if (slide) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(60, freq + slide), now + duration);
    }
    amp.gain.setValueAtTime(0.0001, now);
    amp.gain.exponentialRampToValueAtTime(gain || 0.025, now + 0.014);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(amp);
    amp.connect(audio.master);
    osc.start(now);
    osc.stop(now + duration + 0.03);
  }

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const nextW = Math.max(320, rect.width || view.w);
    const nextH = Math.max(300, rect.height || view.h);
    const oldW = view.w || nextW;
    const oldH = view.h || nextH;

    view.w = nextW;
    view.h = nextH;
    view.dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(view.w * view.dpr);
    canvas.height = Math.floor(view.h * view.dpr);
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);

    const sx = view.w / oldW;
    const sy = view.h / oldH;
    scaleEntity(game.player, sx, sy);
    [game.bullets, game.enemyShots, game.enemies, game.particles, game.pickups, game.announcements].forEach((list) => {
      list.forEach((item) => scaleEntity(item, sx, sy));
    });
    game.stars = makeStars(Math.round(Math.min(160, Math.max(90, (view.w * view.h) / 7600))));
    pointer.x = clamp(pointer.x * sx, 0, view.w);
    pointer.y = clamp(pointer.y * sy, 0, view.h);
  }

  function scaleEntity(item, sx, sy) {
    if (!item) {
      return;
    }
    if (Number.isFinite(item.x)) {
      item.x *= sx;
    }
    if (Number.isFinite(item.y)) {
      item.y *= sy;
    }
  }

  function makeStars(count) {
    return Array.from({ length: count }, () => ({
      x: Math.random(),
      y: Math.random(),
      speed: 0.15 + Math.random() * 0.75,
      size: 0.6 + Math.random() * 1.9,
      hue: Math.random(),
    }));
  }

  function startGame(options) {
    const silent = options && options.silent === true;
    if (!silent) {
      initAudio();
    }
    game = createGame("playing");
    game.player.x = view.w * 0.5;
    game.player.y = view.h * 0.68;
    pointer.x = game.player.x;
    pointer.y = game.player.y - 120;
    pointer.active = false;
    pointer.down = false;
    beginWave();
    if (new URLSearchParams(window.location.search).get("previewEnemies") === "1") {
      seedPreviewEnemies();
    }
    showScreen("game");
    updateHud();
    if (!silent) {
      tone(220, 0.12, "triangle", 0.035, 220);
      tone(440, 0.22, "sine", 0.025, 330);
    }
  }

  function pauseGame() {
    if (game.mode !== "playing") {
      return;
    }
    game.player.shooting = false;
    game.mode = "paused";
    showScreen("pause");
  }

  function resumeGame() {
    if (game.mode !== "paused") {
      return;
    }
    initAudio();
    lastTime = performance.now();
    game.mode = "playing";
    showScreen("game");
  }

  function endGame() {
    game.player.shooting = false;
    game.mode = "over";
    const wasBest = game.score > bestScore;
    writeBestScore(game.score);
    ui.finalScore.textContent = formatScore(game.score);
    ui.bestScore.textContent = formatScore(bestScore);
    ui.finalRooms.textContent = String(game.wave).padStart(2, "0");
    ui.finalCleared.textContent = String(game.kills).padStart(2, "0");
    ui.finalChain.textContent = "×" + game.maxCombo.toFixed(1);
    ui.finalTime.textContent = formatTime(game.time);
    ui.finalGrade.textContent = getGrade(game.score, game.wave, game.kills);
    ui.newBest.hidden = !wasBest;
    ui.resultDate.textContent = new Intl.DateTimeFormat("en", { month: "short", day: "2-digit" }).format(new Date());
    showScreen("over");
    tone(190, 0.18, "sawtooth", 0.035, -70);
    tone(110, 0.35, "triangle", 0.03, -35);
  }

  function showScreen(screen) {
    ui.startScreen.hidden = screen !== "start";
    ui.pauseScreen.hidden = screen !== "pause";
    ui.gameOverScreen.hidden = screen !== "over";
    ui.pauseButton.disabled = screen === "start" || screen === "over";
    ui.pauseButton.classList.toggle("is-resume", screen === "pause");
    ui.pauseButton.setAttribute("aria-label", screen === "pause" ? "Resume" : "Pause");
    ui.gameChrome.classList.toggle("is-visible", screen === "game");
    document.body.dataset.screen = screen;
  }

  function beginWave() {
    game.spawnLeft = 7 + game.wave * 3;
    game.spawnTimer = 0.5;
    game.waveBreak = 0;
    game.announcements.push({
      x: view.w * 0.5,
      y: view.h * 0.28,
      text: "ROOM " + game.wave,
      life: 1.4,
      maxLife: 1.4,
      size: clamp(view.w * 0.072, 34, 78),
    });
    ui.objective.textContent = game.wave >= 4 ? "Secure the showroom" : "Clear the showroom";
    ui.threat.textContent = game.spawnLeft + " hazards inbound";
  }

  function nextWave() {
    game.wave += 1;
    game.waveBreak = 1.45;
    game.spawnTimer = game.waveBreak;
    game.player.shield = clamp(game.player.shield + 18, 0, game.player.maxShield);
    game.score += 250 * game.wave;
    updateHud();
    tone(280 + game.wave * 14, 0.16, "triangle", 0.03, 180);
  }

  function frame(now) {
    const dt = Math.min(0.033, (now - lastTime) / 1000 || 0);
    lastTime = now;

    if (game.mode === "playing") {
      update(dt);
    } else {
      game.time += dt;
      updateAmbient(dt);
    }

    render();
    rafId = requestAnimationFrame(frame);
  }

  function update(dt) {
    game.time += dt;
    game.shake = Math.max(0, game.shake - dt * 24);
    game.surge = Math.max(0, game.surge - dt);
    game.chainTimer = Math.max(0, game.chainTimer - dt);
    if (game.chainTimer <= 0) {
      game.chain = 0;
      game.combo = 1;
    }

    updatePlayer(dt);
    updateBullets(dt);
    updateEnemyShots(dt);
    if (game.mode !== "playing") {
      updateParticles(dt);
      updateAnnouncements(dt);
      updateAmbient(dt);
      updateHud();
      return;
    }
    updateEnemies(dt);
    if (game.mode !== "playing") {
      updateParticles(dt);
      updateAnnouncements(dt);
      updateAmbient(dt);
      updateHud();
      return;
    }
    updatePickups(dt);
    updateParticles(dt);
    updateAnnouncements(dt);
    updateSpawning(dt);
    updateAmbient(dt);
    updateHud();
  }

  function updateAmbient(dt) {
    for (const star of game.stars) {
      star.y += dt * star.speed * 0.06;
      star.x += Math.sin(game.time * 0.18 + star.hue * 8) * dt * 0.002;
      if (star.y > 1.04) {
        star.y = -0.04;
        star.x = Math.random();
      }
      if (star.x > 1.04) {
        star.x = -0.04;
      } else if (star.x < -0.04) {
        star.x = 1.04;
      }
    }
  }

  function updatePlayer(dt) {
    const p = game.player;
    p.cooldown = Math.max(0, p.cooldown - dt);
    p.invulnerable = Math.max(0, p.invulnerable - dt);
    p.hurtTimer = Math.max(0, p.hurtTimer - dt);
    p.dashCooldown = Math.max(0, p.dashCooldown - dt);
    p.dashTime = Math.max(0, p.dashTime - dt);

    let dx = 0;
    let dy = 0;
    if (keys.has("arrowleft") || keys.has("a")) dx -= 1;
    if (keys.has("arrowright") || keys.has("d")) dx += 1;
    if (keys.has("arrowup") || keys.has("w")) dy -= 1;
    if (keys.has("arrowdown") || keys.has("s")) dy += 1;

    const keyMagnitude = Math.hypot(dx, dy);
    if (keyMagnitude > 0) {
      dx /= keyMagnitude;
      dy /= keyMagnitude;
      p.lastDx = dx;
      p.lastDy = dy;
    }

    if (p.dashTime > 0) {
      p.x += p.dashVx * dt;
      p.y += p.dashVy * dt;
      if (Math.random() < 0.8) {
        game.particles.push({
          x: p.x - p.lastDx * 22 + (Math.random() - 0.5) * 18,
          y: p.y - p.lastDy * 22 + (Math.random() - 0.5) * 18,
          vx: -p.lastDx * (45 + Math.random() * 55),
          vy: -p.lastDy * (45 + Math.random() * 55),
          life: 0.24,
          maxLife: 0.24,
          size: 4 + Math.random() * 6,
          growth: 1.4,
          color: palette.mint,
        });
      }
    } else if (keyMagnitude > 0) {
      const moveSpeed = p.speed * (game.surge > 0 ? 1.12 : 1);
      p.x += dx * moveSpeed * dt;
      p.y += dy * moveSpeed * dt;
    } else if (pointer.down) {
      const tx = pointer.x - p.x;
      const ty = pointer.y - p.y;
      const dist = Math.hypot(tx, ty);
      if (dist > 12) {
        const speed = p.speed * (game.surge > 0 ? 1.18 : 1.05);
        p.lastDx = tx / dist;
        p.lastDy = ty / dist;
        p.x += p.lastDx * speed * dt;
        p.y += p.lastDy * speed * dt;
      }
    }

    p.x = clamp(p.x, p.r + 12, view.w - p.r - 12);
    p.y = clamp(p.y, p.r + 12, view.h - p.r - 12);
    p.tilt = lerp(p.tilt, dx * 0.42, 0.12);

    const rate = game.surge > 0 ? 0.07 : 0.118;
    if (p.cooldown <= 0) {
      firePlayerBullets();
      p.cooldown = rate;
    }
  }

  function triggerDash() {
    const p = game.player;
    if (game.mode !== "playing" || p.dashCooldown > 0 || p.dashTime > 0) {
      return;
    }

    let dx = p.lastDx;
    let dy = p.lastDy;
    let keyX = 0;
    let keyY = 0;
    if (keys.has("arrowleft") || keys.has("a")) keyX -= 1;
    if (keys.has("arrowright") || keys.has("d")) keyX += 1;
    if (keys.has("arrowup") || keys.has("w")) keyY -= 1;
    if (keys.has("arrowdown") || keys.has("s")) keyY += 1;
    if (keyX || keyY) {
      const magnitude = Math.hypot(keyX, keyY);
      dx = keyX / magnitude;
      dy = keyY / magnitude;
    }

    p.lastDx = dx;
    p.lastDy = dy;
    p.dashVx = dx * 1050;
    p.dashVy = dy * 1050;
    p.dashTime = 0.18;
    p.dashCooldown = 1.35;
    p.invulnerable = Math.max(p.invulnerable, 0.26);
    game.dashes += 1;
    game.shake = Math.max(game.shake, 5);
    burst(p.x, p.y, 24, palette.mint, 230, 0.36);
    tone(190, 0.12, "sawtooth", 0.026, 300);
  }

  function firePlayerBullets() {
    const p = game.player;
    const aim = getAimAngle();
    const spreadCount = game.surge > 0 ? 3 : 1;
    const spreadStep = game.surge > 0 ? 0.18 : 0;
    const speed = game.surge > 0 ? 860 : 760;
    game.shotsFired += spreadCount;
    if (p.hurtTimer <= 0) {
      p.shooting = true;
    }

    for (let i = 0; i < spreadCount; i += 1) {
      const offset = (i - (spreadCount - 1) / 2) * spreadStep;
      const angle = aim + offset;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      const origin = getPlayerShotOrigin(aim);
      game.bullets.push({
        x: origin.x + Math.cos(angle) * 18,
        y: origin.y + Math.sin(angle) * 18,
        vx,
        vy,
        r: game.surge > 0 ? 5.4 : 4.4,
        life: 1.18,
        damage: game.surge > 0 ? 1.28 : 1,
        color: game.surge > 0 ? palette.amber : palette.cyan,
      });
    }

    if (Math.random() < 0.32 || game.surge > 0) {
      const origin = getPlayerShotOrigin(aim);
      burst(origin.x, origin.y, 3, palette.cyan, 70, 0.16);
    }
  }

  function getPlayerShotOrigin(angle) {
    const p = game.player;
    const facing = getFacingForAngle(angle);
    const image = characterSprites.bodySideOpen;
    if (!image || !image.complete || image.naturalWidth === 0) {
      return {
        x: p.x + Math.cos(angle) * (p.r + 54),
        y: p.y + Math.sin(angle) * (p.r + 54),
      };
    }

    const height = getPlayerSpriteHeight(1);
    const scale = height / image.naturalHeight;
    const mouthX = image.naturalWidth * 0.82;
    const mouthY = image.naturalHeight * 0.34;
    return {
      x: p.x + facing * (mouthX - image.naturalWidth * 0.5) * scale,
      y: p.y + (mouthY - image.naturalHeight * 0.58) * scale,
    };
  }

  function getAimAngle() {
    const p = game.player;
    if (pointer.active) {
      return Math.atan2(pointer.y - p.y, pointer.x - p.x);
    }

    let nearest = null;
    let nearestDist = Infinity;
    for (const enemy of game.enemies) {
      const dist = distanceSq(p.x, p.y, enemy.x, enemy.y);
      if (dist < nearestDist) {
        nearest = enemy;
        nearestDist = dist;
      }
    }

    if (nearest) {
      return Math.atan2(nearest.y - p.y, nearest.x - p.x);
    }

    return -Math.PI / 2;
  }

  function updateBullets(dt) {
    for (let i = game.bullets.length - 1; i >= 0; i -= 1) {
      const bullet = game.bullets[i];
      bullet.life -= dt;
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;

      if (
        bullet.life <= 0 ||
        bullet.x < -40 ||
        bullet.x > view.w + 40 ||
        bullet.y < -40 ||
        bullet.y > view.h + 40
      ) {
        game.bullets.splice(i, 1);
        continue;
      }

      let consumed = false;
      for (let j = game.enemies.length - 1; j >= 0; j -= 1) {
        const enemy = game.enemies[j];
        const hit = bullet.r + enemy.r;
        if (distanceSq(bullet.x, bullet.y, enemy.x, enemy.y) <= hit * hit) {
          enemy.hp -= bullet.damage;
          enemy.hitFlash = 0.08;
          game.hits += 1;
          burst(bullet.x, bullet.y, 5, bullet.color, 90, 0.2);
          if (enemy.hp <= 0) {
            destroyEnemy(j);
          }
          consumed = true;
          break;
        }
      }

      if (consumed) {
        game.bullets.splice(i, 1);
      }
    }
  }

  function updateEnemyShots(dt) {
    for (let i = game.enemyShots.length - 1; i >= 0; i -= 1) {
      const shot = game.enemyShots[i];
      shot.life -= dt;
      shot.x += shot.vx * dt;
      shot.y += shot.vy * dt;

      if (
        shot.life <= 0 ||
        shot.x < -60 ||
        shot.x > view.w + 60 ||
        shot.y < -60 ||
        shot.y > view.h + 60
      ) {
        game.enemyShots.splice(i, 1);
        continue;
      }

      const p = game.player;
      const hit = shot.r + p.r;
      if (distanceSq(shot.x, shot.y, p.x, p.y) <= hit * hit) {
        damagePlayer(14 + game.wave * 0.8);
        burst(shot.x, shot.y, 12, palette.rose, 130, 0.26);
        game.enemyShots.splice(i, 1);
      }
    }
  }

  function updateEnemies(dt) {
    const p = game.player;
    for (let i = game.enemies.length - 1; i >= 0; i -= 1) {
      const enemy = game.enemies[i];
      enemy.age += dt;
      enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);
      enemy.cooldown = Math.max(0, enemy.cooldown - dt);

      const toPlayerX = p.x - enemy.x;
      const toPlayerY = p.y - enemy.y;
      const dist = Math.max(1, Math.hypot(toPlayerX, toPlayerY));
      const nx = toPlayerX / dist;
      const ny = toPlayerY / dist;
      const tangentX = -ny;
      const tangentY = nx;
      const waveMotion = Math.sin(enemy.age * enemy.wiggle + enemy.seed) * enemy.drift;

      if (enemy.type === "sentry") {
        const desired = 250 + Math.sin(enemy.age * 1.7) * 40;
        const pull = clamp((dist - desired) / 160, -1, 1);
        enemy.vx += (nx * pull * enemy.speed + tangentX * waveMotion) * dt * 4.6;
        enemy.vy += (ny * pull * enemy.speed + tangentY * waveMotion) * dt * 4.6;
        if (enemy.cooldown <= 0 && dist < 620) {
          fireEnemyShot(enemy, Math.atan2(ny, nx));
          enemy.cooldown = Math.max(0.9, 2.2 - game.wave * 0.055);
        }
      } else {
        const rush = enemy.type === "charger" ? 1 + Math.max(0, Math.sin(enemy.age * 4.2)) * 0.75 : 1;
        enemy.vx += (nx * enemy.speed * rush + tangentX * waveMotion) * dt * 5.2;
        enemy.vy += (ny * enemy.speed * rush + tangentY * waveMotion) * dt * 5.2;
      }

      enemy.vx *= Math.pow(0.08, dt);
      enemy.vy *= Math.pow(0.08, dt);
      enemy.x += enemy.vx * dt;
      enemy.y += enemy.vy * dt;

      const hit = enemy.r + p.r;
      if (distanceSq(enemy.x, enemy.y, p.x, p.y) <= hit * hit) {
        damagePlayer(enemy.contactDamage);
        if (game.mode !== "playing") {
          return;
        }
        const knock = 280;
        enemy.vx -= nx * knock;
        enemy.vy -= ny * knock;
        enemy.hp -= 0.75;
        if (enemy.hp <= 0) {
          destroyEnemy(i);
        }
      }
    }
  }

  function updatePickups(dt) {
    const p = game.player;
    for (let i = game.pickups.length - 1; i >= 0; i -= 1) {
      const pickup = game.pickups[i];
      pickup.life -= dt;
      pickup.age += dt;

      const dx = p.x - pickup.x;
      const dy = p.y - pickup.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 130) {
        const pull = (1 - dist / 130) * 260;
        pickup.x += (dx / Math.max(1, dist)) * pull * dt;
        pickup.y += (dy / Math.max(1, dist)) * pull * dt;
      }

      if (dist < p.r + pickup.r + 8) {
        if (pickup.type === "repair") {
          p.shield = clamp(p.shield + 18, 0, p.maxShield);
          tone(520, 0.08, "sine", 0.025, 120);
        } else {
          addVibe(15);
          tone(660, 0.07, "triangle", 0.024, 180);
        }
        burst(pickup.x, pickup.y, 18, pickup.color, 190, 0.42);
        game.pickups.splice(i, 1);
        continue;
      }

      if (pickup.life <= 0) {
        game.pickups.splice(i, 1);
      }
    }
  }

  function updateParticles(dt) {
    for (let i = game.particles.length - 1; i >= 0; i -= 1) {
      const p = game.particles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= Math.pow(0.16, dt);
      p.vy *= Math.pow(0.16, dt);
      p.size *= 1 + dt * p.growth;
      if (p.life <= 0) {
        game.particles.splice(i, 1);
      }
    }
  }

  function updateAnnouncements(dt) {
    for (let i = game.announcements.length - 1; i >= 0; i -= 1) {
      const item = game.announcements[i];
      item.life -= dt;
      item.y -= dt * 24;
      if (item.life <= 0) {
        game.announcements.splice(i, 1);
      }
    }
  }

  function updateSpawning(dt) {
    if (game.waveBreak > 0) {
      game.waveBreak -= dt;
      if (game.waveBreak <= 0) {
        beginWave();
      }
      return;
    }

    if (game.spawnLeft > 0) {
      game.spawnTimer -= dt;
      if (game.spawnTimer <= 0) {
        spawnEnemy();
        game.spawnLeft -= 1;
        const cadence = Math.max(0.26, 1.05 - game.wave * 0.052);
        game.spawnTimer = cadence * (0.55 + Math.random() * 0.9);
      }
      return;
    }

    if (game.enemies.length === 0) {
      nextWave();
    }
  }

  function spawnEnemy() {
    const edge = Math.floor(Math.random() * 4);
    let x = 0;
    let y = 0;
    if (edge === 0) {
      x = Math.random() * view.w;
      y = -42;
    } else if (edge === 1) {
      x = view.w + 42;
      y = Math.random() * view.h;
    } else if (edge === 2) {
      x = Math.random() * view.w;
      y = view.h + 42;
    } else {
      x = -42;
      y = Math.random() * view.h;
    }

    const roll = Math.random();
    let type = "drifter";
    if (game.wave >= 4 && roll < 0.2) {
      type = "sentry";
    } else if (game.wave >= 2 && roll < 0.48) {
      type = "charger";
    }

    addEnemy(type, x, y);
  }

  function addEnemy(type, x, y) {
    const stats = enemyStats(type);
    game.enemies.push({
      type,
      x,
      y,
      vx: 0,
      vy: 0,
      r: stats.r,
      hp: stats.hp + Math.floor(game.wave * stats.scaling),
      maxHp: stats.hp + Math.floor(game.wave * stats.scaling),
      speed: stats.speed + game.wave * stats.speedScale,
      drift: stats.drift,
      wiggle: stats.wiggle,
      value: stats.value,
      color: stats.color,
      contactDamage: stats.contactDamage,
      sprite: stats.sprite,
      spriteScale: stats.spriteScale,
      spinRate: stats.spinRate,
      faceVelocity: stats.faceVelocity,
      cooldown: 0.8 + Math.random() * 0.8,
      hitFlash: 0,
      age: 0,
      seed: Math.random() * Math.PI * 2,
    });
  }

  function seedPreviewEnemies() {
    game.spawnLeft = 0;
    game.spawnTimer = 999;
    addEnemy("drifter", view.w * 0.33, view.h * 0.48);
    addEnemy("charger", view.w * 0.5, view.h * 0.38);
    addEnemy("sentry", view.w * 0.67, view.h * 0.5);
  }

  function enemyStats(type) {
    if (type === "charger") {
      return {
        r: 21,
        hp: 2.8,
        scaling: 0.16,
        speed: 84,
        speedScale: 4.2,
        drift: 18,
        wiggle: 5.8,
        value: 120,
        color: palette.rose,
        contactDamage: 20,
        sprite: enemySprites.tackStrip,
        spriteScale: 3.9,
        spinRate: 0,
        faceVelocity: true,
      };
    }

    if (type === "sentry") {
      return {
        r: 28,
        hp: 5.2,
        scaling: 0.24,
        speed: 60,
        speedScale: 2.4,
        drift: 42,
        wiggle: 3.2,
        value: 190,
        color: palette.amber,
        contactDamage: 14,
        sprite: enemySprites.carpetCrate,
        spriteScale: 2.85,
        spinRate: 0.55,
        faceVelocity: false,
      };
    }

    return {
      r: 26,
      hp: 3.3,
      scaling: 0.18,
      speed: 62,
      speedScale: 2.8,
      drift: 34,
      wiggle: 4.1,
      value: 100,
      color: palette.mint,
      contactDamage: 15,
      sprite: enemySprites.carpetRoll,
      spriteScale: 2.7,
      spinRate: 0.78,
      faceVelocity: false,
    };
  }

  function fireEnemyShot(enemy, angle) {
    const speed = 230 + game.wave * 8;
    game.enemyShots.push({
      x: enemy.x + Math.cos(angle) * enemy.r,
      y: enemy.y + Math.sin(angle) * enemy.r,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r: 6,
      life: 3,
      age: 0,
    });
    burst(enemy.x, enemy.y, 7, palette.amber, 80, 0.2);
  }

  function destroyEnemy(index) {
    const enemy = game.enemies[index];
    game.enemies.splice(index, 1);
    game.chain += 1;
    game.chainTimer = 3.1;
    game.combo = Math.min(4, 1 + Math.floor(game.chain / 4) * 0.25);
    game.kills += 1;
    game.maxCombo = Math.max(game.maxCombo, game.combo);
    game.score += Math.round(enemy.value * game.combo);
    addVibe(enemy.type === "sentry" ? 12 : 8);
    burst(enemy.x, enemy.y, enemy.type === "sentry" ? 34 : 24, enemy.color, 230, 0.62);
    game.shake = Math.max(game.shake, enemy.type === "sentry" ? 7 : 4);

    if (Math.random() < 0.18 || (enemy.type === "sentry" && Math.random() < 0.55)) {
      spawnPickup(enemy.x, enemy.y, Math.random() < 0.32 ? "repair" : "vibe");
    }

    tone(310 + Math.random() * 90 + game.combo * 35, 0.07, "triangle", 0.023, 160);
  }

  function spawnPickup(x, y, type) {
    game.pickups.push({
      type,
      x,
      y,
      r: type === "repair" ? 12 : 10,
      color: type === "repair" ? palette.mint : palette.rose,
      life: 8,
      age: 0,
    });
  }

  function addVibe(amount) {
    if (game.surge > 0) {
      game.vibe = clamp(game.vibe + amount * 0.35, 0, 100);
      return;
    }

    game.vibe += amount;
    if (game.vibe >= 100) {
      game.vibe = 0;
      game.surge = 5.4;
      game.shake = Math.max(game.shake, 10);
      game.announcements.push({
        x: view.w * 0.5,
        y: view.h * 0.35,
        text: "COMFORT",
        life: 1.25,
        maxLife: 1.25,
        size: clamp(view.w * 0.086, 42, 92),
      });
      burst(game.player.x, game.player.y, 80, palette.amber, 360, 0.92);
      tone(180, 0.18, "sawtooth", 0.034, 540);
      tone(540, 0.28, "sine", 0.03, 220);
    }
  }

  function damagePlayer(amount) {
    const p = game.player;
    if (p.invulnerable > 0 || game.mode !== "playing") {
      return;
    }

    p.shield -= amount;
    p.invulnerable = 0.48;
    p.hurtTimer = 0.56;
    p.shooting = false;
    game.chain = 0;
    game.combo = 1;
    game.chainTimer = 0;
    game.shake = Math.max(game.shake, 11);
    burst(p.x, p.y, 28, palette.danger, 260, 0.55);
    tone(150, 0.13, "sawtooth", 0.04, -45);

    if (p.shield <= 0) {
      p.shield = 0;
      endGame();
    }
  }

  function burst(x, y, count, color, speed, life) {
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const velocity = speed * (0.25 + Math.random() * 0.75);
      game.particles.push({
        x,
        y,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity,
        life: life * (0.55 + Math.random() * 0.65),
        maxLife: life,
        size: 1.8 + Math.random() * 5.2,
        growth: 0.9 + Math.random() * 1.8,
        color,
      });
    }
  }

  function render() {
    ctx.save();
    ctx.clearRect(0, 0, view.w, view.h);
    drawBackdrop();

    if (game.shake > 0) {
      const amount = game.shake * 0.5;
      ctx.translate((Math.random() - 0.5) * amount, (Math.random() - 0.5) * amount);
    }

    drawPickups();
    drawBullets();
    drawEnemies();
    drawEnemyShots();
    if (game.mode !== "ready") {
      drawPlayer();
    }
    drawParticles();
    drawAnnouncements();
    if (game.mode === "playing" && pointer.active) {
      drawAimReticle();
    }
    drawVignette();
    ctx.restore();
  }

  function drawBackdrop() {
    const w = view.w;
    const h = view.h;
    const pulse = game.surge > 0 ? 0.18 + Math.sin(game.time * 16) * 0.05 : 0;
    const wallH = h * 0.22;
    const wall = ctx.createLinearGradient(0, 0, w, wallH);
    wall.addColorStop(0, "#262821");
    wall.addColorStop(0.55, "#1c1e19");
    wall.addColorStop(1, game.surge > 0 ? "#353c24" : "#22231e");
    ctx.fillStyle = wall;
    ctx.fillRect(0, 0, w, h);

    const floor = ctx.createLinearGradient(0, wallH, 0, h);
    floor.addColorStop(0, game.surge > 0 ? "#303625" : "#252721");
    floor.addColorStop(1, "#141510");
    ctx.fillStyle = floor;
    ctx.fillRect(0, wallH, w, h - wallH);

    drawRoomDetails(w, wallH);
    drawBaseboard(w, wallH);

    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    for (const star of game.stars) {
      const x = star.x * w;
      const y = wallH + star.y * (h - wallH);
      const alpha = 0.08 + star.hue * 0.14 + pulse * 0.18;
      const color = star.hue > 0.72 ? [217, 255, 67] : star.hue > 0.42 ? [168, 164, 255] : [104, 215, 255];
      ctx.fillStyle = rgba(color[0], color[1], color[2], alpha);
      ctx.beginPath();
      ctx.ellipse(x, y, star.size * 1.6, star.size * 0.55, star.hue * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    const grid = Math.max(38, Math.min(64, w / 20));
    const offset = (game.time * 10) % grid;
    ctx.save();
    ctx.lineWidth = 1;
    ctx.strokeStyle = game.surge > 0 ? "rgba(217, 255, 67, 0.26)" : "rgba(242, 239, 229, 0.09)";
    for (let x = -grid + offset; x < w + grid; x += grid) {
      ctx.beginPath();
      ctx.moveTo(x, wallH);
      ctx.lineTo(x - h * 0.16, h);
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(168, 164, 255, 0.075)";
    for (let y = wallH; y < h + grid; y += grid) {
      ctx.beginPath();
      ctx.moveTo(0, y + offset);
      ctx.lineTo(w, y + offset * 0.35);
      ctx.stroke();
    }
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = 0.1 + pulse;
    ctx.lineWidth = 2;
    ctx.strokeStyle = game.surge > 0 ? palette.mint : palette.lilac || palette.rug;
    const midY = wallH + (h - wallH) * 0.16;
    ctx.beginPath();
    for (let x = 0; x <= w; x += 14) {
      const y = midY + Math.sin(x * 0.018 + game.time * 1.4) * 7 + Math.sin(x * 0.041 - game.time) * 3;
      if (x === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawRoomDetails(w, wallH) {
    ctx.save();
    ctx.globalAlpha = 1;
    drawFramedSample(w * 0.16, wallH * 0.48, 86, 54, palette.rug);
    drawFramedSample(w * 0.84, wallH * 0.46, 82, 54, palette.sage);

    ctx.fillStyle = "rgba(168, 164, 255, 0.07)";
    ctx.beginPath();
    ctx.roundRect(w * 0.46, wallH * 0.3, w * 0.08, wallH * 0.44, 8);
    ctx.fill();
    ctx.strokeStyle = "rgba(242, 239, 229, 0.24)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "rgba(217, 255, 67, 0.4)";
    ctx.fillRect(w * 0.5 - 1, wallH * 0.31, 2, wallH * 0.42);
    ctx.restore();
  }

  function drawFramedSample(x, y, width, height, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
    ctx.fillRect(-width * 0.5 - 6, -height * 0.5 - 6, width + 12, height + 12);
    ctx.fillStyle = color;
    ctx.fillRect(-width * 0.5, -height * 0.5, width, height);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.42)";
    ctx.lineWidth = 2;
    for (let i = -width * 0.45; i < width * 0.48; i += 12) {
      ctx.beginPath();
      ctx.moveTo(i, -height * 0.5);
      ctx.lineTo(i + height * 0.5, height * 0.5);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawBaseboard(w, y) {
    ctx.save();
    ctx.fillStyle = palette.cream;
    ctx.fillRect(0, y - 8, w, 7);
    ctx.fillStyle = palette.shadow;
    ctx.fillRect(0, y - 2, w, 8);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
    ctx.beginPath();
    ctx.moveTo(0, y + 6);
    ctx.lineTo(w, y + 6);
    ctx.stroke();
    ctx.restore();
  }

  function drawPlayer() {
    const p = game.player;
    const angle = getAimAngle();
    const flicker = p.invulnerable > 0 && Math.floor(game.time * 22) % 2 === 0;
    if (flicker) {
      return;
    }

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.globalCompositeOperation = "lighter";

    const glowRadius = p.r * (game.surge > 0 ? 2.35 : 1.95);
    const glow = ctx.createRadialGradient(0, 6, 3, 0, 8, glowRadius);
    glow.addColorStop(0, game.surge > 0 ? "rgba(217, 255, 67, 0.48)" : "rgba(104, 215, 255, 0.32)");
    glow.addColorStop(1, "rgba(104, 215, 255, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 8, glowRadius, 0, Math.PI * 2);
    ctx.fill();

    if (drawPlayerSprite(angle)) {
      ctx.restore();
      return;
    }

    ctx.rotate(angle + Math.PI / 2 + p.tilt);
    ctx.fillStyle = game.surge > 0 ? palette.amber : palette.cream;
    ctx.strokeStyle = game.surge > 0 ? palette.rose : palette.mint;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, -27);
    ctx.lineTo(19, 19);
    ctx.lineTo(0, 10);
    ctx.lineTo(-19, 19);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = game.surge > 0 ? palette.rose : palette.cyan;
    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.lineTo(7, 9);
    ctx.lineTo(0, 5);
    ctx.lineTo(-7, 9);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  function drawPlayerSprite(angle) {
    const p = game.player;
    const selection = selectPlayerSprite(angle);
    const image = selection.image;
    if (!image || !image.complete || image.naturalWidth === 0) {
      return false;
    }

    const bob = Math.sin(game.time * 7) * 1.8;
    const height = getPlayerSpriteHeight(selection.scale);
    const width = height * (image.naturalWidth / image.naturalHeight);
    const anchorX = 0.5;
    const anchorY = selection.anchorY;

    ctx.save();
    ctx.rotate(p.tilt * 0.08);
    ctx.scale(selection.flip, 1);
    if (p.hurtTimer > 0) {
      ctx.filter = "brightness(1.55) saturate(1.15)";
    }
    ctx.drawImage(image, -width * anchorX, -height * anchorY + bob, width, height);

    if (game.surge > 0) {
      ctx.filter = "none";
      ctx.globalAlpha = 0.32 + Math.sin(game.time * 24) * 0.08;
      ctx.strokeStyle = palette.amber;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(0, 14, p.r + 22, p.r + 12, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
    return true;
  }

  function selectPlayerSprite(angle) {
    const p = game.player;
    const y = Math.sin(angle);
    const facing = getFacingForAngle(angle);

    if ((game.surge > 0 || p.shooting) && p.hurtTimer <= 0) {
      return { image: characterSprites.bodySideOpen, flip: facing, scale: 1.05, anchorY: 0.58 };
    }

    if (p.hurtTimer > 0 || y > 0.58) {
      return { image: characterSprites.bodyFront, flip: 1, scale: p.hurtTimer > 0 ? 1.06 : 1, anchorY: 0.58 };
    }

    if (y < -0.58) {
      return { image: characterSprites.bodyBack, flip: 1, scale: 1, anchorY: 0.58 };
    }

    if (Math.abs(y) > 0.24) {
      return { image: characterSprites.bodyThreeQuarter, flip: facing, scale: 1, anchorY: 0.58 };
    }

    return { image: characterSprites.bodySide, flip: facing, scale: 1, anchorY: 0.58 };
  }

  function getFacingForAngle(angle) {
    const p = game.player;
    const x = Math.cos(angle);
    if (x < -0.12) {
      p.facing = -1;
    } else if (x > 0.12) {
      p.facing = 1;
    }
    return p.facing;
  }

  function getPlayerSpriteHeight(scale) {
    return clamp(Math.min(view.w, view.h) * 0.23, 118, 170) * scale;
  }

  function drawBullets() {
    ctx.save();
    for (const bullet of game.bullets) {
      const angle = Math.atan2(bullet.vy, bullet.vx);
      const length = bullet.r * 4.7;
      const thickness = bullet.r * 1.55;

      ctx.save();
      ctx.translate(bullet.x, bullet.y);
      ctx.rotate(angle);
      ctx.fillStyle = "#fff";
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(-length * 0.48, -thickness * 0.5, length, thickness, thickness * 0.45);
      ctx.fill();
      ctx.stroke();

      ctx.strokeStyle = "rgba(0, 0, 0, 0.62)";
      ctx.lineWidth = 1.1;
      for (let x = -length * 0.25; x <= length * 0.34; x += length * 0.22) {
        ctx.beginPath();
        ctx.moveTo(x - thickness * 0.2, -thickness * 0.35);
        ctx.lineTo(x + thickness * 0.24, thickness * 0.35);
        ctx.stroke();
      }
      ctx.restore();
    }
    ctx.restore();
  }

  function drawEnemyShots() {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const shot of game.enemyShots) {
      const gradient = ctx.createRadialGradient(shot.x, shot.y, 1, shot.x, shot.y, 18);
      gradient.addColorStop(0, "rgba(255, 255, 255, 0.95)");
      gradient.addColorStop(0.35, "rgba(255, 104, 70, 0.82)");
      gradient.addColorStop(1, "rgba(255, 104, 70, 0)");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(shot.x, shot.y, 18, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawEnemies() {
    for (const enemy of game.enemies) {
      ctx.save();
      ctx.translate(enemy.x, enemy.y);
      ctx.globalCompositeOperation = "lighter";

      const alpha = enemy.hitFlash > 0 ? 0.95 : 0.74;
      const glow = ctx.createRadialGradient(0, 0, 3, 0, 0, enemy.r * 2.9);
      glow.addColorStop(0, rgbaFromHex(enemy.color, 0.48));
      glow.addColorStop(1, rgbaFromHex(enemy.color, 0));
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, 0, enemy.r * 2.9, 0, Math.PI * 2);
      ctx.fill();

      ctx.lineWidth = 2.2;
      ctx.strokeStyle = enemy.hitFlash > 0 ? palette.cream : rgbaFromHex(enemy.color, alpha);
      ctx.fillStyle = "rgba(7, 9, 8, 0.62)";

      if (!drawEnemySprite(enemy)) {
        ctx.save();
        ctx.rotate(enemy.age * (enemy.type === "charger" ? 3 : 1.4) + enemy.seed);
        if (enemy.type === "charger") {
          ctx.beginPath();
          ctx.moveTo(0, -enemy.r - 8);
          ctx.lineTo(enemy.r + 8, enemy.r);
          ctx.lineTo(0, enemy.r * 0.54);
          ctx.lineTo(-enemy.r - 8, enemy.r);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        } else if (enemy.type === "sentry") {
          drawPolygon(0, 0, enemy.r + 4, 4);
          ctx.fill();
          ctx.stroke();
          ctx.rotate(Math.PI / 4);
          ctx.strokeStyle = rgbaFromHex(enemy.color, 0.45);
          drawPolygon(0, 0, enemy.r - 3, 4);
          ctx.stroke();
        } else {
          drawPolygon(0, 0, enemy.r + 3, 6);
          ctx.fill();
          ctx.stroke();
          ctx.strokeStyle = rgbaFromHex(enemy.color, 0.42);
          ctx.beginPath();
          ctx.arc(0, 0, enemy.r * 0.62, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      }

      const hp = clamp(enemy.hp / enemy.maxHp, 0, 1);
      ctx.strokeStyle = rgbaFromHex(enemy.color, 0.36);
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, enemy.r + 9, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * hp);
      ctx.stroke();

      ctx.restore();
    }
  }

  function drawEnemySprite(enemy) {
    const image = enemy.sprite;
    if (!image || !image.complete || image.naturalWidth === 0) {
      return false;
    }

    const longestSide = enemy.r * enemy.spriteScale;
    const scale = longestSide / Math.max(image.naturalWidth, image.naturalHeight);
    const width = image.naturalWidth * scale;
    const height = image.naturalHeight * scale;

    ctx.save();
    ctx.rotate(getEnemySpriteRotation(enemy));
    if (enemy.hitFlash > 0) {
      ctx.filter = "brightness(1.9)";
      ctx.drawImage(image, -width * 0.5, -height * 0.5, width, height);
    } else {
      ctx.drawImage(image, -width * 0.5, -height * 0.5, width, height);
    }
    ctx.restore();
    return true;
  }

  function getEnemySpriteRotation(enemy) {
    if (enemy.faceVelocity) {
      const speed = Math.hypot(enemy.vx, enemy.vy);
      if (speed > 10) {
        return Math.atan2(enemy.vy, enemy.vx);
      }
      return Math.atan2(game.player.y - enemy.y, game.player.x - enemy.x);
    }
    return enemy.seed * 0.2 + enemy.age * enemy.spinRate;
  }

  function drawPickups() {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const pickup of game.pickups) {
      const pulse = Math.sin(pickup.age * 7) * 0.2 + 1;
      ctx.save();
      ctx.translate(pickup.x, pickup.y);
      ctx.rotate(pickup.age * 2.5);
      ctx.strokeStyle = rgbaFromHex(pickup.color, 0.85);
      ctx.fillStyle = rgbaFromHex(pickup.color, 0.2);
      ctx.lineWidth = 2;
      drawPolygon(0, 0, pickup.r * pulse, pickup.type === "repair" ? 4 : 5);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  function drawParticles() {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const p of game.particles) {
      const alpha = clamp(p.life / p.maxLife, 0, 1);
      ctx.fillStyle = rgbaFromHex(p.color, alpha);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawAnnouncements() {
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.globalCompositeOperation = "lighter";
    for (const item of game.announcements) {
      const alpha = clamp(item.life / item.maxLife, 0, 1);
      ctx.globalAlpha = alpha;
      ctx.font = "800 " + item.size + "px Manrope, Inter, system-ui, sans-serif";
      ctx.lineWidth = 7;
      ctx.strokeStyle = "rgba(7, 9, 8, 0.75)";
      ctx.strokeText(item.text, item.x, item.y);
      ctx.fillStyle = item.text === "COMFORT" ? palette.amber : palette.cream;
      ctx.fillText(item.text, item.x, item.y);
    }
    ctx.restore();
  }

  function drawAimReticle() {
    const radius = 12 + Math.sin(game.time * 5) * 1.5;
    ctx.save();
    ctx.translate(pointer.x, pointer.y);
    ctx.strokeStyle = game.surge > 0 ? palette.mint : "rgba(242, 239, 229, 0.72)";
    ctx.fillStyle = palette.coral;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0.25, Math.PI * 0.8);
    ctx.arc(0, 0, radius, Math.PI + 0.25, Math.PI * 1.8);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawVignette() {
    const gradient = ctx.createRadialGradient(
      view.w * 0.5,
      view.h * 0.45,
      Math.min(view.w, view.h) * 0.18,
      view.w * 0.5,
      view.h * 0.52,
      Math.max(view.w, view.h) * 0.72
    );
    gradient.addColorStop(0, "rgba(23, 24, 19, 0)");
    gradient.addColorStop(1, "rgba(10, 11, 8, 0.62)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, view.w, view.h);
  }

  function drawPolygon(x, y, radius, sides) {
    ctx.beginPath();
    for (let i = 0; i < sides; i += 1) {
      const angle = -Math.PI / 2 + (i / sides) * Math.PI * 2;
      const px = x + Math.cos(angle) * radius;
      const py = y + Math.sin(angle) * radius;
      if (i === 0) {
        ctx.moveTo(px, py);
      } else {
        ctx.lineTo(px, py);
      }
    }
    ctx.closePath();
  }

  function updateHud() {
    ui.score.textContent = formatScore(game.score);
    ui.wave.textContent = String(game.wave).padStart(2, "0");
    ui.chain.textContent = "×" + game.combo.toFixed(1);
    const shieldRatio = clamp(game.player.shield / game.player.maxShield, 0, 1);
    const vibeRatio = game.surge > 0 ? clamp(game.surge / 5.4, 0, 1) : clamp(game.vibe / 100, 0, 1);
    const dashRatio = 1 - clamp(game.player.dashCooldown / 1.35, 0, 1);
    ui.shieldFill.style.transform = "scaleX(" + shieldRatio + ")";
    ui.shieldValue.textContent = String(Math.round(game.player.shield));
    ui.vibeFill.style.transform = "scaleX(" + vibeRatio + ")";
    ui.vibeValue.textContent = game.surge > 0 ? game.surge.toFixed(1) + "s" : Math.round(game.vibe) + "%";
    ui.vibeLabel.textContent = game.surge > 0 ? "Overdrive" : "Comfort";
    ui.vibeFill.parentElement.classList.toggle("is-live", game.surge > 0);
    ui.dashFill.style.transform = "scaleX(" + dashRatio + ")";
    ui.dashButton.disabled = game.player.dashCooldown > 0 || game.mode !== "playing";

    const remaining = game.spawnLeft + game.enemies.length;
    if (game.waveBreak > 0) {
      ui.objective.textContent = "Room secured";
      ui.threat.textContent = "Resetting the floor plan";
    } else {
      ui.objective.textContent = remaining <= 3 ? "Finish the room" : "Clear the showroom";
      ui.threat.textContent = remaining + (remaining === 1 ? " hazard remaining" : " hazards remaining");
    }
    const statusCopy = ui.status && ui.status.querySelector("span");
    if (statusCopy) {
      statusCopy.textContent = game.surge > 0 ? "Comfort overdrive" : "Shift active";
    }
  }

  function formatScore(score) {
    return String(Math.max(0, Math.floor(score))).padStart(6, "0");
  }

  function formatTime(seconds) {
    const total = Math.max(0, Math.floor(seconds));
    const minutes = Math.floor(total / 60);
    const secs = total % 60;
    return String(minutes).padStart(2, "0") + ":" + String(secs).padStart(2, "0");
  }

  function getGrade(score, wave, kills) {
    const performance = score + wave * 500 + kills * 35;
    if (performance >= 15000) return "S";
    if (performance >= 9000) return "A";
    if (performance >= 5000) return "B";
    if (performance >= 2200) return "C";
    return "D";
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function distanceSq(ax, ay, bx, by) {
    const dx = ax - bx;
    const dy = ay - by;
    return dx * dx + dy * dy;
  }

  function rgba(r, g, b, a) {
    return "rgba(" + r + ", " + g + ", " + b + ", " + a + ")";
  }

  function rgbaFromHex(hex, alpha) {
    const normalized = hex.replace("#", "");
    const r = parseInt(normalized.slice(0, 2), 16);
    const g = parseInt(normalized.slice(2, 4), 16);
    const b = parseInt(normalized.slice(4, 6), 16);
    return rgba(r, g, b, alpha);
  }

  function setPointerFromEvent(event) {
    const rect = canvas.getBoundingClientRect();
    pointer.x = clamp(event.clientX - rect.left, 0, view.w);
    pointer.y = clamp(event.clientY - rect.top, 0, view.h);
    pointer.active = true;
  }

  ui.startButton.addEventListener("click", startGame);
  ui.replayButton.addEventListener("click", startGame);
  ui.resumeButton.addEventListener("click", resumeGame);
  ui.pauseButton.addEventListener("click", () => {
    if (game.mode === "playing") {
      pauseGame();
    } else if (game.mode === "paused") {
      resumeGame();
    }
  });
  ui.audioButton.addEventListener("click", () => {
    muted = !muted;
    ui.audioButton.setAttribute("aria-pressed", String(muted));
    ui.audioButton.setAttribute("aria-label", muted ? "Unmute sound" : "Mute sound");
    if (audio) {
      const now = audio.ctx.currentTime;
      audio.master.gain.cancelScheduledValues(now);
      audio.master.gain.linearRampToValueAtTime(muted ? 0 : 0.15, now + 0.08);
    }
  });
  ui.dashButton.addEventListener("pointerdown", (event) => {
    event.stopPropagation();
    triggerDash();
  });

  window.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    keys.add(key);

    if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)) {
      event.preventDefault();
    }

    if (key === "enter") {
      if (game.mode === "ready" || game.mode === "over") {
        startGame();
      } else if (game.mode === "paused") {
        resumeGame();
      }
    }

    if (key === "escape" || key === "p") {
      if (game.mode === "playing") {
        pauseGame();
      } else if (game.mode === "paused") {
        resumeGame();
      }
    }

    if (key === " " && !event.repeat) {
      triggerDash();
    }
  });

  window.addEventListener("keyup", (event) => {
    keys.delete(event.key.toLowerCase());
  });

  canvas.addEventListener("pointerdown", (event) => {
    if (game.mode !== "playing") {
      return;
    }
    pointer.down = true;
    pointer.id = event.pointerId;
    setPointerFromEvent(event);
    canvas.setPointerCapture(event.pointerId);
  });

  canvas.addEventListener("pointermove", (event) => {
    setPointerFromEvent(event);
  });

  canvas.addEventListener("pointerup", (event) => {
    if (pointer.id === event.pointerId) {
      pointer.down = false;
      pointer.id = null;
      canvas.releasePointerCapture(event.pointerId);
    }
  });

  canvas.addEventListener("pointercancel", () => {
    pointer.down = false;
    pointer.id = null;
  });

  const observer = new ResizeObserver(resizeCanvas);
  observer.observe(canvas);
  window.addEventListener("resize", resizeCanvas);

  resizeCanvas();
  if (new URLSearchParams(window.location.search).get("play") === "1") {
    startGame({ silent: true });
  } else {
    showScreen("start");
  }
  updateHud();
  render();
  rafId = requestAnimationFrame(frame);

  window.addEventListener("beforeunload", () => cancelAnimationFrame(rafId));
})();
