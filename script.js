const logEl = document.getElementById("log");
const panelEl = document.getElementById("panel");
const statusEl = document.getElementById("status");
const phaseEl = document.getElementById("phase");
const resetBtn = document.getElementById("resetBtn");

const lockAppWidth = () => {
  const maxWidth = 540;
  const width = Math.min(window.innerWidth, maxWidth);
  document.documentElement.style.setProperty("--app-width", `${width}px`);
};

lockAppWidth();

const templates = {
  setup: document.getElementById("setupTemplate"),
  pass: document.getElementById("passTemplate"),
  reveal: document.getElementById("revealTemplate"),
  night: document.getElementById("nightTemplate"),
  day: document.getElementById("dayTemplate"),
  vote: document.getElementById("voteTemplate"),
  end: document.getElementById("endTemplate")
};

const roles = {
  wolf: { name: "人狼", desc: "夜に誰かを襲撃できる。", team: "wolf" },
  seer: { name: "占い師", desc: "夜に1人の正体を確認できる。", team: "villager" },
  guard: { name: "騎士", desc: "夜に1人を守る。", team: "villager" },
  villager: { name: "村人", desc: "議論して人狼を見つけよう。", team: "villager" }
};

let state = {};

const addLog = (text) => {
  const line = document.createElement("div");
  line.textContent = text;
  logEl.appendChild(line);
  logEl.scrollTop = logEl.scrollHeight;
};

const setPhase = (phase, status) => {
  phaseEl.textContent = phase;
  statusEl.textContent = status;
};

const clearPanel = () => {
  panelEl.innerHTML = "";
};

const mount = (template) => {
  const node = template.content.cloneNode(true);
  panelEl.appendChild(node);
};

const shuffle = (arr) => {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const buildPlayers = (count) =>
  Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    name: `プレイヤー ${i + 1}`,
    alive: true,
    role: null
  }));

const assignRoles = (players, config) => {
  const pool = [];
  pool.push(...Array(config.wolf).fill("wolf"));
  pool.push(...Array(config.seer).fill("seer"));
  pool.push(...Array(config.guard).fill("guard"));
  while (pool.length < players.length) {
    pool.push("villager");
  }
  const shuffled = shuffle(pool);
  return players.map((p, idx) => ({ ...p, role: shuffled[idx] }));
};

const alivePlayers = () => state.players.filter((p) => p.alive);
const aliveByRole = (role) => alivePlayers().filter((p) => p.role === role);
const getPlayerById = (id) => state.players.find((p) => p.id === id);

const winCheck = () => {
  const wolves = aliveByRole("wolf").length;
  const villagers = alivePlayers().length - wolves;
  if (wolves === 0) return "villagers";
  if (wolves >= villagers) return "wolves";
  return null;
};

const renderSetup = () => {
  clearPanel();
  mount(templates.setup);
  setPhase("SETUP", "準備中");

  const playerCount = document.getElementById("playerCount");
  const wolfCount = document.getElementById("wolfCount");
  const seerCount = document.getElementById("seerCount");
  const guardCount = document.getElementById("guardCount");
  const startBtn = document.getElementById("startBtn");

  startBtn.addEventListener("click", () => {
    const total = Number(playerCount.value);
    const wolves = Number(wolfCount.value);
    const seers = Number(seerCount.value);
    const guards = Number(guardCount.value);

    if (total < 4 || total > 12) {
      addLog("プレイヤー人数は4〜12人で設定してね。");
      return;
    }

    if (wolves + seers + guards > total) {
      addLog("役職の合計が人数を超えています。");
      return;
    }

    state = {
      config: { total, wolf: wolves, seer: seers, guard: guards },
      players: assignRoles(buildPlayers(total), {
        wolf: wolves,
        seer: seers,
        guard: guards
      }),
      revealIndex: 0,
      night: 1,
      pending: {
        wolfTarget: null,
        seerTarget: null,
        guardTarget: null
      },
      lastNight: "",
      lastVote: ""
    };

    addLog(`ゲーム開始: プレイヤー${total}人。`);
    renderPass();
  });
};

const renderPass = () => {
  clearPanel();
  mount(templates.pass);
  setPhase("ROLE", "役職配布");

  const playerIndex = document.getElementById("playerIndex");
  const revealBtn = document.getElementById("revealBtn");

  const current = state.players[state.revealIndex];
  playerIndex.textContent = current.name;

  revealBtn.addEventListener("click", renderReveal);
};

const renderReveal = () => {
  clearPanel();
  mount(templates.reveal);

  const roleName = document.getElementById("roleName");
  const roleDesc = document.getElementById("roleDesc");
  const hideBtn = document.getElementById("hideBtn");

  const current = state.players[state.revealIndex];
  const role = roles[current.role];

  roleName.textContent = role.name;
  roleDesc.textContent = role.desc;
  addLog(`${current.name} が役職を確認。`);

  hideBtn.addEventListener("click", () => {
    state.revealIndex += 1;
    if (state.revealIndex >= state.players.length) {
      addLog("全員の役職配布が完了。");
      startNight();
      return;
    }
    renderPass();
  });
};

const startNight = () => {
  state.pending = { wolfTarget: null, seerTargets: [], guardTarget: null };
  state.lastNight = "";
  state.nightOrder = alivePlayers().map((p) => p.id);
  state.nightIndex = 0;
  addLog(`夜${state.night} が始まる。`);
  renderNightTurn();
};

const renderNightTurn = () => {
  if (state.nightIndex >= state.nightOrder.length) {
    return resolveNight();
  }
  clearPanel();
  mount(templates.night);
  setPhase("NIGHT", `夜${state.night}`);

  const nightStep = document.getElementById("nightStep");
  const choiceList = document.getElementById("choiceList");
  const skipBtn = document.getElementById("skipBtn");
  const countdown = document.getElementById("countdown");

  const currentId = state.nightOrder[state.nightIndex];
  const current = getPlayerById(currentId);

  nightStep.textContent = `${current.name} の番。`;
  countdown.textContent = "";
  skipBtn.style.display = "none";

  if (!current.alive) {
    addLog("脱落者は行動なし。");
    return renderNightWait(countdown, skipBtn);
  }

  if (current.role === "wolf" || current.role === "seer" || current.role === "guard") {
    return renderNightAction(current, current.role);
  }

  return renderNightWait(countdown, skipBtn);
};

const renderNightWait = (countdownEl, buttonEl) => {
  countdownEl.textContent = "待機中...";
  buttonEl.style.display = "inline-flex";
  buttonEl.textContent = "次へ";
  buttonEl.disabled = true;

  let left = 15;
  const update = () => {
    countdownEl.textContent = `${left}秒後に次へ進めます。`;
    if (left <= 0) {
      clearInterval(timerId);
      buttonEl.disabled = false;
    }
  };
  update();
  const timerId = setInterval(() => {
    left -= 1;
    update();
  }, 1000);
  buttonEl.onclick = () => {
    if (buttonEl.disabled) return;
    clearInterval(timerId);
    advanceNightTurn();
  };
};

const renderNightAction = (current, roleKey) => {
  clearPanel();
  mount(templates.night);
  setPhase("NIGHT", `${roles[roleKey].name}の行動`);

  const nightStep = document.getElementById("nightStep");
  const choiceList = document.getElementById("choiceList");
  const skipBtn = document.getElementById("skipBtn");
  const countdown = document.getElementById("countdown");

  nightStep.textContent = `${current.name} が対象を選ぶ。`;
  countdown.textContent = "";
  skipBtn.style.display = "inline-flex";
  skipBtn.textContent = "次へ";
  skipBtn.disabled = false;

  const candidates = alivePlayers().filter((p) => {
    if (roleKey === "wolf") return p.role !== "wolf";
    return true;
  });

  candidates.forEach((p) => {
    const btn = document.createElement("button");
    btn.className = "choice-btn";
    btn.textContent = p.name;
    btn.addEventListener("click", () => {
      if (roleKey === "wolf") state.pending.wolfTarget = p.id;
      if (roleKey === "seer") state.pending.seerTargets.push(p.id);
      if (roleKey === "guard") state.pending.guardTarget = p.id;
      addLog("夜の行動が記録された。");
      advanceNightTurn();
    });
    choiceList.appendChild(btn);
  });

  skipBtn.addEventListener("click", () => {
    addLog("夜の行動をスキップ。");
    advanceNightTurn();
  });
};

const advanceNightTurn = () => {
  state.nightIndex += 1;
  renderNightTurn();
};

const resolveNight = () => {
  const targetId = state.pending.wolfTarget;
  const guardId = state.pending.guardTarget;
  if (targetId && targetId !== guardId) {
    const target = state.players.find((p) => p.id === targetId);
    if (target) {
      target.alive = false;
      state.lastNight = `${target.name} が襲撃された。`;
    }
  } else if (targetId && targetId === guardId) {
    state.lastNight = "騎士の護衛で襲撃は防がれた。";
  } else {
    state.lastNight = "静かな夜が明けた。";
  }

  if (state.pending.seerTargets.length > 0) {
    state.pending.seerTargets.forEach((targetId) => {
      const target = getPlayerById(targetId);
      if (target) {
        addLog(`占い結果: ${target.name} は ${roles[target.role].name}。`);
      }
    });
  }

  const winner = winCheck();
  if (winner) return renderEnd(winner);
  renderDay();
};

const renderDay = () => {
  clearPanel();
  mount(templates.day);
  setPhase("DAY", `昼${state.night}`);

  const dayResult = document.getElementById("dayResult");
  const startVoteBtn = document.getElementById("startVoteBtn");
  const timerBar = document.getElementById("timerBar");

  dayResult.textContent = state.lastNight || "朝になった。";

  let timeLeft = 30;
  const tick = () => {
    timeLeft -= 1;
    const width = Math.max((timeLeft / 30) * 100, 0);
    timerBar.style.width = `${width}%`;
    if (timeLeft <= 0) {
      clearInterval(timerId);
      startVoteBtn.disabled = false;
      startVoteBtn.textContent = "投票へ進む";
    }
  };
  const timerId = setInterval(tick, 1000);
  startVoteBtn.disabled = true;
  startVoteBtn.textContent = "議論中...";

  startVoteBtn.addEventListener("click", () => {
    clearInterval(timerId);
    startVotePhase();
  });
};

const startVotePhase = () => {
  state.votes = {};
  state.voteOrder = alivePlayers().map((p) => p.id);
  state.voteIndex = 0;
  renderVoteTurn();
};

const renderVoteTurn = () => {
  if (state.voteIndex >= state.voteOrder.length) {
    return resolveVote();
  }
  clearPanel();
  mount(templates.vote);
  setPhase("VOTE", "投票中");

  const voterLabel = document.getElementById("voterLabel");
  const voteList = document.getElementById("voteList");
  const currentId = state.voteOrder[state.voteIndex];
  const current = getPlayerById(currentId);
  voterLabel.textContent = `${current.name} の投票`;

  alivePlayers()
    .filter((p) => p.id !== currentId)
    .forEach((p) => {
    const btn = document.createElement("button");
    btn.className = "choice-btn danger";
    btn.textContent = p.name;
    btn.addEventListener("click", () => {
      state.votes[p.id] = (state.votes[p.id] || 0) + 1;
      addLog("投票が記録された。");
      state.voteIndex += 1;
      renderVoteTurn();
    });
    voteList.appendChild(btn);
  });
};

const resolveVote = () => {
  const entries = Object.entries(state.votes);
  if (entries.length === 0) {
    state.lastVote = "投票がありませんでした。";
    addLog(state.lastVote);
    state.night += 1;
    return startNight();
  }

  const maxVotes = Math.max(...entries.map(([, count]) => count));
  const top = entries.filter(([, count]) => count === maxVotes);
  if (top.length !== 1) {
    state.lastVote = "同票のため処刑なし。";
    addLog(state.lastVote);
  } else {
    const [playerId] = top[0];
    const target = getPlayerById(Number(playerId));
    if (target) {
      target.alive = false;
      state.lastVote = `${target.name} が処刑された。`;
      addLog(state.lastVote);
    }
  }

  const winner = winCheck();
  if (winner) return renderEnd(winner);
  state.night += 1;
  startNight();
};

const renderEnd = (winner) => {
  clearPanel();
  mount(templates.end);
  setPhase("END", "ゲーム終了");

  const endTitle = document.getElementById("endTitle");
  const endDesc = document.getElementById("endDesc");
  const restartBtn = document.getElementById("restartBtn");

  if (winner === "wolves") {
    endTitle.textContent = "人狼の勝利";
    endDesc.textContent = "人狼が村を支配した。";
  } else {
    endTitle.textContent = "村人の勝利";
    endDesc.textContent = "人狼は全滅した。";
  }

  restartBtn.addEventListener("click", () => {
    addLog("新しいゲームを開始。");
    renderSetup();
  });
};

resetBtn.addEventListener("click", () => {
  addLog("リセットしました。");
  renderSetup();
});

renderSetup();
