"use client";

import { useEffect, useRef, useState } from "react";

export default function Home() {
  const canvasRef = useRef(null);
  const gameRef = useRef(null);
  const audioRef = useRef(null);
  const bgmRef = useRef(null);
  const keysRef = useRef({ direction: "RIGHT", nextDirection: "RIGHT" });

  const CELL = 28;
  const COLS = 36;
  const ROWS = 22;
  const WIDTH = COLS * CELL;
  const HEIGHT = ROWS * CELL;

  const ITEM_COUNT_MIN = 20;
  const ITEM_COUNT_MAX = 30;

  const [ui, setUi] = useState({
    score: 0,
    volume: 0,
    combo: 0,
    status: "START",
    paused: false,
    celebrations: [],
  });

  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

  const initBgm = () => {
    if (bgmRef.current) return bgmRef.current;

    const audio = new Audio("/audio/volume-control-loop.mp3");
    audio.loop = true;
    audio.volume = 0;

    bgmRef.current = audio;
    return audio;
  };

  const playBgm = () => {
    const audio = initBgm();
    audio.play().catch(() => {});
  };

  const pauseBgm = () => {
    bgmRef.current?.pause();
  };

  const updateBgmVolume = (volume) => {
    const audio = initBgm();
    audio.volume = clamp((volume / 100) * 0.3, 0, 0.3);
  };

  const initAudio = () => {
    if (audioRef.current) return audioRef.current;

    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioContext();

    const master = ctx.createGain();
    master.gain.value = 0.18;
    master.connect(ctx.destination);

    audioRef.current = { ctx, master };
    return audioRef.current;
  };

  const playTone = (freq = 440, duration = 0.12, type = "sine", gain = 0.2) => {
    const audio = initAudio();
    const now = audio.ctx.currentTime;

    const osc = audio.ctx.createOscillator();
    const vol = audio.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);

    vol.gain.setValueAtTime(gain, now);
    vol.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(vol);
    vol.connect(audio.master);

    osc.start(now);
    osc.stop(now + duration);
  };

  const playSfx = (type) => {
    if (type === "food") {
      playTone(520, 0.08, "sine", 0.22);
      setTimeout(() => playTone(760, 0.1, "sine", 0.18), 70);
    }

    if (type === "poison") {
      playTone(180, 0.18, "sawtooth", 0.22);
      setTimeout(() => playTone(90, 0.22, "sawtooth", 0.16), 90);
    }

    if (type === "pause") {
      playTone(320, 0.12, "triangle", 0.18);
    }

    if (type === "resume") {
      playTone(440, 0.08, "triangle", 0.18);
      setTimeout(() => playTone(620, 0.1, "triangle", 0.16), 70);
    }

    if (type === "max") {
      [523, 659, 784, 1046].forEach((freq, index) => {
        setTimeout(() => playTone(freq, 0.18, "sine", 0.22), index * 90);
      });
    }
  };

  const celebrationConfig = {
    8: { label: "Boost Kuat!", emoji: "🔥", count: 46, size: "large" },
    9: { label: "Power Naik!", emoji: "🚀", count: 68, size: "huge" },
    10: { label: "Luar Biasa!", emoji: "👑", count: 95, size: "legend" },
    max: { label: "VOLUME MAKSIMAL!", emoji: "🔊", count: 150, size: "max" },
  };

  const triggerCelebration = (value, type = "food") => {
    if (type !== "max" && value < 8) return;

    const config =
      type === "max"
        ? celebrationConfig.max
        : celebrationConfig[value] || celebrationConfig[10];

    const id =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`;

    const particles = Array.from({ length: config.count }).map((_, index) => ({
      id: `${id}-${index}`,
      left: rand(3, 97),
      top: rand(10, 90),
      delay: Math.random() * 0.3,
      duration: 0.9 + Math.random() * 1.1,
      rotate: rand(-720, 720),
      x: rand(-420, 420),
      y: rand(-360, 360),
      emoji:
        type === "max"
          ? ["🔊", "🎆", "🎇", "👑", "🏆", "⚡", "🌈"][rand(0, 6)]
          : type === "poison"
          ? ["💀", "☠️", "🧨", "⚡", "🔥", "🦠"][rand(0, 5)]
          : [config.emoji, "✨", "🎊", "💫", "⭐", "🌈"][rand(0, 5)],
    }));

    const celebration = {
      id,
      value,
      type,
      label:
        type === "max"
          ? "VOLUME 100! MAKSIMAL!"
          : type === "poison"
          ? `Racun Besar -${value}`
          : `${config.label} +${value}`,
      emoji: type === "max" ? "🔊" : type === "poison" ? "☠️" : config.emoji,
      size: config.size,
      particles,
    };

    setUi((prev) => ({
      ...prev,
      celebrations: [...prev.celebrations, celebration],
    }));

    setTimeout(() => {
      setUi((prev) => ({
        ...prev,
        celebrations: prev.celebrations.filter((item) => item.id !== id),
      }));
    }, type === "max" ? 2400 : 1900);
  };

  const isOpposite = (a, b) =>
    (a === "UP" && b === "DOWN") ||
    (a === "DOWN" && b === "UP") ||
    (a === "LEFT" && b === "RIGHT") ||
    (a === "RIGHT" && b === "LEFT");

  const foodIcons = ["🍒", "🍓", "🍇", "🍉", "🍊", "🍍", "🥝", "🍔", "🍕", "🍰"];
  const poisonIcons = ["🦠", "🧪", "🕷️", "🦂", "☠️", "💀", "🧟", "🔥", "⚡", "🧨"];

  const randomEmptyCell = (snake, items = []) => {
    let pos;

    do {
      pos = { x: rand(0, COLS - 1), y: rand(0, ROWS - 1) };
    } while (
      snake.some((s) => s.x === pos.x && s.y === pos.y) ||
      items.some((i) => i.x === pos.x && i.y === pos.y)
    );

    return pos;
  };

  const createItem = (snake, items = [], forcedType = null) => {
    const type = forcedType || (Math.random() < 0.5 ? "food" : "poison");
    const value = rand(1, 10);
    const pos = randomEmptyCell(snake, items);

    return {
      ...pos,
      id:
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random()}`,
      type,
      value,
      icon:
        type === "food"
          ? foodIcons[value - 1]
          : type === "poison"
          ? poisonIcons[value - 1]
          : type === "pause"
          ? "⏸️"
          : "🔁",
      nextMoveAt: performance.now() + rand(5000, 10000),
      pulse: Math.random() * 10,
    };
  };

  const createSpecialItem = (snake, items, type) => {
    const pos = randomEmptyCell(snake, items);

    return {
      ...pos,
      id:
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random()}`,
      type,
      value: 0,
      icon: type === "pause" ? "⏸️" : "🔁",
      nextMoveAt: performance.now() + rand(5000, 10000),
      pulse: Math.random() * 10,
    };
  };

  const resetGame = () => {
    pauseBgm();

    const snake = [
      { x: 8, y: 10 },
      { x: 7, y: 10 },
      { x: 6, y: 10 },
    ];

    const items = [];
    const itemCount = rand(ITEM_COUNT_MIN, ITEM_COUNT_MAX);

    for (let i = 0; i < itemCount; i++) {
      items.push(createItem(snake, items));
    }

    items.push(createSpecialItem(snake, items, "pause"));
    items.push(createSpecialItem(snake, items, "restart"));

    keysRef.current = { direction: "RIGHT", nextDirection: "RIGHT" };

    gameRef.current = {
      snake,
      items,
      volume: 0,
      score: 0,
      combo: 0,
      status: "START",
      paused: false,
      pauseByItem: false,
      lastMove: 0,
      speed: 115,
      celebrationText: "",
      celebrationUntil: 0,
      particles: [],
      maxCelebrated: false,
    };

    setUi({
      score: 0,
      volume: 0,
      combo: 0,
      status: "START",
      paused: false,
      celebrations: [],
    });
  };

  const relocateItem = (item, snake, items) => {
    const pos = randomEmptyCell(
      snake,
      items.filter((i) => i.id !== item.id)
    );

    item.x = pos.x;
    item.y = pos.y;
    item.nextMoveAt = performance.now() + rand(5000, 10000);
  };

  const spawnParticles = (game, x, y, color, text) => {
    game.celebrationText = text;
    game.celebrationUntil = performance.now() + 900;

    for (let i = 0; i < 22; i++) {
      game.particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 7,
        vy: (Math.random() - 0.5) * 7,
        life: 34,
        color,
      });
    }
  };

  useEffect(() => {
    resetGame();

    const handleKeyDown = (e) => {
      const key = e.key.toLowerCase();

      const map = {
        arrowup: "UP",
        w: "UP",
        arrowdown: "DOWN",
        s: "DOWN",
        arrowleft: "LEFT",
        a: "LEFT",
        arrowright: "RIGHT",
        d: "RIGHT",
      };

      if (map[key]) {
        e.preventDefault();

        initAudio();
        playBgm();
        updateBgmVolume(gameRef.current?.volume || 0);

        const game = gameRef.current;
        const current = keysRef.current.direction;
        const next = map[key];

        if (!isOpposite(current, next)) {
          keysRef.current.nextDirection = next;
        }

        if (game?.paused && game?.pauseByItem) {
          playSfx("resume");
          playBgm();
          updateBgmVolume(game.volume);

          game.paused = false;
          game.pauseByItem = false;
          game.status = "RESUME";

          setUi((prev) => ({
            ...prev,
            paused: false,
            status: "RESUME",
          }));
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      pauseBgm();
    };
  }, []);

  useEffect(() => {
    let raf;

    const drawRoundedRect = (ctx, x, y, w, h, r) => {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
      ctx.fill();
    };

    const drawItemSvg = (ctx, item, time) => {
      const cx = item.x * CELL + CELL / 2;
      const cy = item.y * CELL + CELL / 2;
      const pulse = Math.sin(time / 180 + item.pulse) * 2;
      const size = 25 + item.value * 0.9 + pulse;

      const isFood = item.type === "food";
      const isPoison = item.type === "poison";
      const isPause = item.type === "pause";
      const isRestart = item.type === "restart";

      const color = isFood
        ? `hsl(${90 + item.value * 12}, 85%, 58%)`
        : isPoison
        ? `hsl(${360 - item.value * 9}, 90%, 60%)`
        : isPause
        ? "#60a5fa"
        : "#facc15";

      ctx.save();
      ctx.translate(cx, cy);

      ctx.shadowBlur = isFood ? 16 : isPoison ? 20 : 24;
      ctx.shadowColor = color;
      ctx.fillStyle = color;
      ctx.beginPath();

      if (isFood) {
        for (let i = 0; i < 6; i++) {
          const angle = (Math.PI * 2 * i) / 6;
          const px = Math.cos(angle) * (size * 0.28);
          const py = Math.sin(angle) * (size * 0.28);
          ctx.arc(px, py, size * 0.23, 0, Math.PI * 2);
        }
        ctx.fill();
      }

      if (isPoison) {
        ctx.rotate(time / 650);
        for (let i = 0; i < 8; i++) {
          const angle = (Math.PI * 2 * i) / 8;
          ctx.lineTo(Math.cos(angle) * size * 0.55, Math.sin(angle) * size * 0.55);
          ctx.lineTo(
            Math.cos(angle + 0.25) * size * 0.28,
            Math.sin(angle + 0.25) * size * 0.28
          );
        }
        ctx.closePath();
        ctx.fill();
      }

      if (isPause || isRestart) {
        ctx.rotate(Math.sin(time / 500) * 0.08);
        ctx.roundRect(-size / 2, -size / 2, size, size, 10);
        ctx.fill();
      }

      ctx.shadowBlur = 0;
      ctx.fillStyle = "#06111f";
      ctx.font = isPause || isRestart ? "bold 20px Arial" : "bold 13px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(item.icon, 0, isPause || isRestart ? 1 : -3);

      if (item.value > 0) {
        ctx.fillStyle = "#ffffff";
        ctx.font = "900 12px Arial";
        ctx.fillText(item.value, 0, 11);
      }

      ctx.restore();
    };

    const draw = (time) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      const game = gameRef.current;

      if (!canvas || !ctx || !game) {
        raf = requestAnimationFrame(draw);
        return;
      }

      ctx.clearRect(0, 0, WIDTH, HEIGHT);

      const bg = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
      bg.addColorStop(0, "#071827");
      bg.addColorStop(0.48, "#111827");
      bg.addColorStop(1, "#241538");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      ctx.fillStyle = "rgba(255,255,255,0.035)";
      for (let x = 0; x < WIDTH; x += CELL) {
        for (let y = 0; y < HEIGHT; y += CELL) {
          if ((x / CELL + y / CELL) % 2 === 0) ctx.fillRect(x, y, CELL, CELL);
        }
      }

      game.items.forEach((item) => {
        if (time > item.nextMoveAt) relocateItem(item, game.snake, game.items);
      });

      if (!game.paused && time - game.lastMove > game.speed) {
        game.lastMove = time;

        const nextDirection = keysRef.current.nextDirection;

        if (!isOpposite(keysRef.current.direction, nextDirection)) {
          keysRef.current.direction = nextDirection;
        }

        const head = { ...game.snake[0] };
        const direction = keysRef.current.direction;

        if (direction === "UP") head.y -= 1;
        if (direction === "DOWN") head.y += 1;
        if (direction === "LEFT") head.x -= 1;
        if (direction === "RIGHT") head.x += 1;

        head.x = (head.x + COLS) % COLS;
        head.y = (head.y + ROWS) % ROWS;

        game.snake.unshift(head);

        const itemIndex = game.items.findIndex((i) => i.x === head.x && i.y === head.y);
        const item = game.items[itemIndex];

        if (item) {
          const px = head.x * CELL + CELL / 2;
          const py = head.y * CELL + CELL / 2;

          if (item.type === "food") {
            playSfx("food");

            game.combo += 1;

            const bonus = Math.floor(game.combo / 4);
            const beforeVolume = game.volume;
            const nextVolume = beforeVolume + item.value + bonus;

            game.volume = clamp(nextVolume, 0, 100);
            updateBgmVolume(game.volume);

            game.score += item.value * 10 + game.combo * 3;
            game.status = game.volume >= 100 ? "VOLUME MAKSIMAL!" : `FOOD +${item.value}`;

            if (item.value >= 8) {
              triggerCelebration(item.value, "food");
              spawnParticles(game, px, py, "#34d399", `+${item.value}`);
            }

            if (beforeVolume < 100 && game.volume >= 100 && !game.maxCelebrated) {
              playSfx("max");
              pauseBgm();

              game.maxCelebrated = true;
              game.paused = true;
              game.pauseByItem = true;
              game.status = "VOLUME MAKSIMAL!";

              triggerCelebration(10, "max");
              spawnParticles(game, px, py, "#facc15", "100!");

              setUi((prev) => ({
                ...prev,
                paused: true,
                status: "VOLUME MAKSIMAL!",
                score: game.score,
                volume: game.volume,
                combo: game.combo,
              }));
            }
          }

          if (item.type === "poison") {
            playSfx("poison");

            game.combo = 0;
            game.maxCelebrated = false;
            game.volume = clamp(game.volume - item.value, 0, 100);
            updateBgmVolume(game.volume);

            game.score = Math.max(0, game.score - item.value * 8);
            game.status = `POISON -${item.value}`;

            if (game.snake.length > 3) game.snake.pop();

            spawnParticles(game, px, py, "#fb7185", `-${item.value}`);

            if (item.value >= 8) triggerCelebration(item.value, "poison");
          }

          if (item.type === "pause") {
            playSfx("pause");
            updateBgmVolume(game.volume);

            game.paused = true;
            game.pauseByItem = true;
            game.status = "PAUSED";

            spawnParticles(game, px, py, "#60a5fa", "PAUSE");

            setUi((prev) => ({
              ...prev,
              paused: true,
              status: "PAUSED",
              score: game.score,
              volume: game.volume,
              combo: game.combo,
            }));
          }

          if (item.type === "restart") {
            resetGame();
            raf = requestAnimationFrame(draw);
            return;
          }

          game.items.splice(itemIndex, 1);

          if (item.type === "pause" || item.type === "restart") {
            game.items.push(createSpecialItem(game.snake, game.items, item.type));
          } else {
            game.items.push(createItem(game.snake, game.items));
          }
        } else {
          game.snake.pop();
        }

        const sweet = game.volume >= 65 && game.volume <= 75;

        if (sweet) {
          game.score += 3;
          game.speed = 95;
          game.status = game.volume >= 100 ? "VOLUME MAKSIMAL!" : "SWEET SPOT!";
        } else {
          game.speed = 115;
        }

        updateBgmVolume(game.volume);

        setUi((prev) => ({
          ...prev,
          score: game.score,
          volume: game.volume,
          combo: game.combo,
          status: game.status,
          paused: game.paused,
        }));
      }

      game.items.forEach((item) => drawItemSvg(ctx, item, time));

      game.snake.forEach((part, index) => {
        const x = part.x * CELL + 3;
        const y = part.y * CELL + 3;
        const size = CELL - 6;
        const isHead = index === 0;

        const color =
          game.volume >= 100
            ? "#facc15"
            : game.volume < 35
            ? "#38bdf8"
            : game.volume <= 80
            ? "#34d399"
            : "#fb7185";

        ctx.shadowBlur = isHead ? 20 : 8;
        ctx.shadowColor = color;
        ctx.fillStyle = isHead ? color : "rgba(52, 211, 153, 0.82)";
        drawRoundedRect(ctx, x, y, size, size, 8);

        if (isHead) {
          ctx.shadowBlur = 0;
          ctx.fillStyle = "#06111f";
          ctx.beginPath();
          ctx.arc(x + 8, y + 8, 2.4, 0, Math.PI * 2);
          ctx.arc(x + size - 8, y + 8, 2.4, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      game.particles = game.particles
        .map((p) => ({
          ...p,
          x: p.x + p.vx,
          y: p.y + p.vy,
          vy: p.vy + 0.12,
          life: p.life - 1,
        }))
        .filter((p) => p.life > 0);

      game.particles.forEach((p) => {
        ctx.globalAlpha = p.life / 34;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      });

      if (time < game.celebrationUntil) {
        ctx.save();
        ctx.fillStyle = "#ffffff";
        ctx.shadowBlur = 24;
        ctx.shadowColor = "#facc15";
        ctx.font = "900 42px Arial";
        ctx.textAlign = "center";
        ctx.fillText(game.celebrationText, WIDTH / 2, 90);
        ctx.restore();
      }

      if (game.paused) {
        ctx.fillStyle = "rgba(0,0,0,0.36)";
        ctx.fillRect(0, 0, WIDTH, HEIGHT);

        ctx.fillStyle = "#ffffff";
        ctx.font = "900 36px Arial";
        ctx.textAlign = "center";
        ctx.fillText("PAUSED", WIDTH / 2, HEIGHT / 2 - 12);

        ctx.font = "700 16px Arial";
        ctx.fillStyle = "rgba(255,255,255,0.72)";
        ctx.fillText("Tekan arah untuk lanjut", WIDTH / 2, HEIGHT / 2 + 24);
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      pauseBgm();
    };
  }, []);

  const volumePercent = clamp(ui.volume, 0, 100);
  const sweet = volumePercent >= 65 && volumePercent <= 75;

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#060914] px-5 py-6 text-white">
      <div className="pointer-events-none fixed inset-0 -z-0 overflow-hidden">
        <div className="absolute -left-32 top-0 h-96 w-96 rounded-full bg-cyan-500/20 blur-[120px]" />
        <div className="absolute right-0 top-20 h-[30rem] w-[30rem] rounded-full bg-fuchsia-500/20 blur-[140px]" />
        <div className="absolute bottom-0 left-1/3 h-96 w-96 rounded-full bg-emerald-500/10 blur-[120px]" />
      </div>

      <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
        {ui.celebrations.map((celebration) => (
          <div key={celebration.id} className="absolute inset-0">
            <div
              className={`absolute left-1/2 top-14 -translate-x-1/2 animate-[celebrationPop_1.2s_ease-out_forwards] rounded-[2rem] border px-8 py-4 text-center font-black shadow-2xl ${
                celebration.type === "max"
                  ? "border-yellow-100 bg-gradient-to-r from-yellow-300 via-orange-300 to-fuchsia-400 text-6xl text-slate-950 shadow-yellow-300/80"
                  : celebration.type === "poison"
                  ? "border-rose-200 bg-rose-500 text-3xl text-white shadow-rose-500/50"
                  : celebration.size === "legend"
                  ? "border-yellow-200 bg-yellow-300 text-5xl text-slate-950 shadow-yellow-300/70"
                  : celebration.size === "huge"
                  ? "border-fuchsia-200 bg-fuchsia-400 text-4xl text-white shadow-fuchsia-400/60"
                  : celebration.size === "large"
                  ? "border-orange-200 bg-orange-400 text-3xl text-white shadow-orange-400/60"
                  : "border-emerald-200 bg-emerald-300 text-2xl text-slate-950 shadow-emerald-300/40"
              }`}
            >
              <div className="text-6xl">{celebration.emoji}</div>
              <div>{celebration.label}</div>
            </div>

            {(celebration.size === "huge" ||
              celebration.size === "legend" ||
              celebration.size === "max") && (
              <div
                className={`absolute left-1/2 top-1/2 h-[460px] w-[460px] -translate-x-1/2 -translate-y-1/2 animate-[megaRing_1.5s_ease-out_forwards] rounded-full border-[20px] ${
                  celebration.type === "poison" ? "border-red-400/70" : "border-yellow-300/75"
                }`}
              />
            )}

            {(celebration.size === "legend" || celebration.size === "max") &&
              celebration.type !== "poison" && (
                <>
                  <div className="absolute left-10 top-12 animate-[sideBoom_1.3s_ease-out_forwards] text-8xl">
                    🎆
                  </div>
                  <div className="absolute right-10 top-20 animate-[sideBoom_1.5s_ease-out_forwards] text-8xl">
                    🎇
                  </div>
                  <div className="absolute bottom-16 left-24 animate-[sideBoom_1.4s_ease-out_forwards] text-7xl">
                    🏆
                  </div>
                  <div className="absolute bottom-20 right-24 animate-[sideBoom_1.6s_ease-out_forwards] text-7xl">
                    👑
                  </div>
                </>
              )}

            {celebration.particles.map((p) => (
              <span
                key={p.id}
                className="absolute text-3xl animate-[confettiBoom_1.4s_ease-out_forwards]"
                style={{
                  left: `${p.left}%`,
                  top: `${p.top}%`,
                  animationDelay: `${p.delay}s`,
                  animationDuration: `${p.duration}s`,
                  "--x": `${p.x}px`,
                  "--y": `${p.y}px`,
                  "--r": `${p.rotate}deg`,
                }}
              >
                {p.emoji}
              </span>
            ))}
          </div>
        ))}
      </div>

      <div className="relative z-10 mx-auto max-w-7xl">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 inline-flex rounded-full border border-cyan-300/30 bg-cyan-300/10 px-4 py-1 text-sm font-bold text-cyan-200">
              Snake Volume Hunt
            </div>
            <h1 className="text-3xl font-black tracking-tight md:text-4xl">
              Makanan & Racun
            </h1>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-3xl border border-white/10 bg-white/[0.07] px-5 py-4 backdrop-blur-xl">
              <div className="text-xs text-slate-400">Score</div>
              <div className="text-2xl font-black">{ui.score}</div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/[0.07] px-5 py-4 backdrop-blur-xl">
              <div className="text-xs text-slate-400">Combo</div>
              <div className="text-2xl font-black">x{ui.combo}</div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/[0.07] px-5 py-4 backdrop-blur-xl">
              <div className="text-xs text-slate-400">Status</div>
              <div className="text-xl font-black">{ui.status}</div>
            </div>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
          <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.06] p-4 shadow-2xl shadow-black/40 backdrop-blur-xl">
            <canvas
              ref={canvasRef}
              width={WIDTH}
              height={HEIGHT}
              className="h-auto w-full rounded-[1.5rem] border border-white/10"
            />
          </section>

          <aside className="rounded-[2rem] border border-white/10 bg-white/[0.06] p-5 shadow-2xl shadow-black/40 backdrop-blur-xl">
            <div className="mb-4 rounded-3xl bg-gradient-to-br from-cyan-400/20 via-emerald-400/10 to-fuchsia-400/20 p-5">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm text-slate-300">Volume</span>
                <span className="text-3xl font-black">{Math.round(ui.volume)}</span>
              </div>

              <div className="relative h-6 overflow-hidden rounded-full bg-slate-950/70">
                <div className="absolute left-[65%] top-0 h-full w-[10%] bg-emerald-300/40" />
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    ui.volume >= 100
                      ? "bg-yellow-300"
                      : sweet
                      ? "bg-emerald-300"
                      : volumePercent > 80
                      ? "bg-rose-400"
                      : "bg-cyan-300"
                  }`}
                  style={{ width: `${volumePercent}%` }}
                />
              </div>

              <div className="mt-2 flex justify-between text-xs text-slate-400">
                <span>0</span>
                <span>Sweet</span>
                <span>100</span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                <div className="mb-2 text-sm font-black">Control</div>
                <p className="text-sm text-slate-400">Arrow key / WASD untuk gerak.</p>
              </div>

              <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                <div className="mb-2 text-sm font-black">Item</div>
                <div className="grid grid-cols-2 gap-2 text-sm text-slate-300">
                  <div>🍒 Food +volume</div>
                  <div>🦠 Poison -volume</div>
                  <div>⏸️ Pause</div>
                  <div>🔁 Restart</div>
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                <div className="mb-2 text-sm font-black">Goal</div>
                <p className="text-sm text-slate-400">
                  Ambil makanan untuk menaikkan volume, ambil racun untuk menurunkannya,
                  lalu jaga volume tetap sesuai target.
                </p>
              </div>
            </div>
          </aside>
        </div>
      </div>

      <style jsx global>{`
        @keyframes confettiBoom {
          0% {
            opacity: 0;
            transform: translate(0, 0) scale(0.2) rotate(0deg);
          }
          15% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: translate(var(--x), var(--y)) scale(1.6) rotate(var(--r));
          }
        }

        @keyframes celebrationPop {
          0% {
            opacity: 0;
            transform: translateX(-50%) translateY(-24px) scale(0.45);
          }
          20% {
            opacity: 1;
            transform: translateX(-50%) translateY(0) scale(1.15);
          }
          72% {
            opacity: 1;
            transform: translateX(-50%) translateY(0) scale(1);
          }
          100% {
            opacity: 0;
            transform: translateX(-50%) translateY(-50px) scale(0.78);
          }
        }

        @keyframes megaRing {
          0% {
            opacity: 0.95;
            transform: translate(-50%, -50%) scale(0.1);
          }
          100% {
            opacity: 0;
            transform: translate(-50%, -50%) scale(2.8);
          }
        }

        @keyframes sideBoom {
          0% {
            opacity: 0;
            transform: scale(0.2) rotate(-20deg);
          }
          25% {
            opacity: 1;
            transform: scale(1.3) rotate(10deg);
          }
          100% {
            opacity: 0;
            transform: scale(0.8) rotate(28deg);
          }
        }
      `}</style>
    </main>
  );
}