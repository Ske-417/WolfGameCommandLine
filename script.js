const logEl = document.getElementById("log");
const panelEl = document.getElementById("panel");
const statusEl = document.getElementById("status");
const phaseEl = document.getElementById("phase");
const resetBtn = document.getElementById("resetBtn");

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
  state.pending = { wolfTarget: null, seerTarget: null, guardTarget: null };
  state.lastNight = "";
  addLog(`夜${state.night} が始まる。`);
  renderNightStep("wolf");
};

const renderNightStep = (roleKey) => {
  const rolePlayers = aliveByRole(roleKey);
  if (rolePlayers.length === 0) {
    if (roleKey === "wolf") return renderNightStep("seer");
    if (roleKey === "seer") return renderNightStep("guard");
    if (roleKey === "guard") return resolveNight();
  }

  clearPanel();
  mount(templates.night);
  setPhase("NIGHT", `${roles[roleKey].name}の行動`);

  const nightStep = document.getElementById("nightStep");
  const choiceList = document.getElementById("choiceList");
  const skipBtn = document.getElementById("skipBtn");

  nightStep.textContent = `${roles[roleKey].name}が対象を選ぶ。端末を回してね。`;

  const candidates = alivePlayers().filter((p) => p.role !== (roleKey === "wolf" ? "wolf" : "none"));
  candidates.forEach((p) => {
    const btn = document.createElement("button");
    btn.className = "choice-btn";
    btn.textContent = p.name;
    btn.addEventListener("click", () => {
      if (roleKey === "wolf") state.pending.wolfTarget = p.id;
      if (roleKey === "seer") state.pending.seerTarget = p.id;
      if (roleKey === "guard") state.pending.guardTarget = p.id;
      addLog(`${roles[roleKey].name}が${p.name}を選択。`);
      if (roleKey === "wolf") return renderNightStep("seer");
      if (roleKey === "seer") return renderNightStep("guard");
      return resolveNight();
    });
    choiceList.appendChild(btn);
  });

  skipBtn.addEventListener("click", () => {
    addLog(`${roles[roleKey].name}がスキップ。`);
    if (roleKey === "wolf") return renderNightStep("seer");
    if (roleKey === "seer") return renderNightStep("guard");
    return resolveNight();
  });
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

  if (state.pending.seerTarget) {
    const target = state.players.find((p) => p.id === state.pending.seerTarget);
    if (target) {
      addLog(`占い結果: ${target.name} は ${roles[target.role].name}。`);
    }
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

  startVoteBtn.addEventListener("click", () => {
    clearInterval(timerId);
    renderVote();
  });
};

const renderVote = () => {
  clearPanel();
  mount(templates.vote);
  setPhase("VOTE", "投票中");

  const voteList = document.getElementById("voteList");
  alivePlayers().forEach((p) => {
    const btn = document.createElement("button");
    btn.className = "choice-btn danger";
    btn.textContent = p.name;
    btn.addEventListener("click", () => {
      p.alive = false;
      state.lastVote = `${p.name} が処刑された。`;
      addLog(state.lastVote);
      const winner = winCheck();
      if (winner) return renderEnd(winner);
      state.night += 1;
      startNight();
    });
    voteList.appendChild(btn);
  });
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
