/* ============ MindPulse · Frontend logic ============ */

// 👉 Change this if your FastAPI server runs on a different host/port
const API_BASE = "https://mindpulse-1-dpih.onrender.com";

// The dataset score is assumed to be on a 0–10 scale. Adjust if your model differs.
const SCORE_MAX = 10;
const GAUGE_LENGTH = 527.8; // circumference of r=84 circle (2πr)

const $ = (id) => document.getElementById(id);

const form = $("predictForm");
const submitBtn = $("submitBtn");
const errorBox = $("errorBox");
const gaugeBar = $("gaugeBar");
const scoreValue = $("scoreValue");
const verdict = $("verdict");
const verdictTitle = $("verdictTitle");
const verdictText = $("verdictText");
const tips = $("tips");
const tipsList = $("tipsList");

let stressLevel = "Medium";

/* ---------- Sliders: live value + filled track ---------- */
const sliders = [
  ["avg_daily_usage_hours", "o_usage"],
  ["study_hours", "o_study"],
  ["physical_activity_hours", "o_activity"],
  ["sleep_hours_per_night", "o_sleep"],
];

function updateSlider(input, output) {
  const pct = ((input.value - input.min) / (input.max - input.min)) * 100;
  input.style.setProperty("--p", pct + "%");
  output.textContent = Number(input.value).toFixed(1) + " h";
}

sliders.forEach(([inputId, outId]) => {
  const input = $(inputId);
  const output = $(outId);
  updateSlider(input, output);
  input.addEventListener("input", () => updateSlider(input, output));
});

/* ---------- Stress pills ---------- */
$("stressPills").addEventListener("click", (e) => {
  const pill = e.target.closest(".pill");
  if (!pill) return;
  document.querySelectorAll(".pill").forEach((p) => {
    p.classList.remove("active");
    p.setAttribute("aria-checked", "false");
  });
  pill.classList.add("active");
  pill.setAttribute("aria-checked", "true");
  stressLevel = pill.dataset.value;
});

/* ---------- API health check ---------- */
async function checkApi() {
  const box = $("apiStatus");
  const text = $("apiStatusText");
  try {
    const res = await fetch(API_BASE + "/", { method: "GET" });
    if (!res.ok) throw new Error();
    box.className = "api-status online";
    text.textContent = "API online";
  } catch {
    box.className = "api-status offline";
    text.textContent = "API offline";
  }
}
checkApi();
setInterval(checkApi, 15000);

/* ---------- Helpers ---------- */
function showError(msg) {
  errorBox.textContent = msg;
  errorBox.hidden = false;
}
function clearError() {
  errorBox.hidden = true;
  document.querySelectorAll(".invalid").forEach((el) => el.classList.remove("invalid"));
}

function buildPayload() {
  return {
    age: parseInt($("age").value, 10),
    gender: $("gender").value,
    country: $("country").value.trim(),
    academic_level: $("academic_level").value,
    most_used_platform: $("most_used_platform").value,
    purpose_of_use: $("purpose_of_use").value,
    avg_daily_usage_hours: parseFloat($("avg_daily_usage_hours").value),
    daily_unlocks: parseInt($("daily_unlocks").value, 10),
    study_hours: parseFloat($("study_hours").value),
    physical_activity_hours: parseFloat($("physical_activity_hours").value),
    sleep_hours_per_night: parseFloat($("sleep_hours_per_night").value),
    stress_level: stressLevel,
  };
}

function validate(p) {
  const bad = (id, msg) => {
    $(id).classList.add("invalid");
    $(id).focus();
    showError(msg);
    return false;
  };
  if (!Number.isInteger(p.age) || p.age < 10 || p.age > 100) return bad("age", "Age must be between 10 and 100.");
  if (!p.country) return bad("country", "Please enter your country.");
  if (!Number.isInteger(p.daily_unlocks) || p.daily_unlocks < 0) return bad("daily_unlocks", "Phone unlocks must be 0 or more.");
  return true;
}

/* ---------- Result rendering ---------- */
function animateNumber(el, to, duration = 1500) {
  const start = performance.now();
  function frame(now) {
    const t = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = (to * eased).toFixed(1);
    if (t < 1) requestAnimationFrame(frame);
    else el.textContent = to.toFixed(1);
  }
  requestAnimationFrame(frame);
}

function interpret(score) {
  const ratio = score / SCORE_MAX;
  if (ratio >= 0.7)
    return { cls: "good", title: "Thriving", text: "Your habits point to a healthy mental state. Keep protecting the routines that got you here." };
  if (ratio >= 0.5)
    return { cls: "mid", title: "Balanced, with room to grow", text: "You're doing okay, but a few lifestyle tweaks could noticeably lift your wellbeing." };
  return { cls: "low", title: "Needs attention", text: "Your pattern suggests added strain. Gentle changes — and talking to someone you trust — can make a real difference." };
}

function buildTips(p) {
  const list = [];
  if (p.sleep_hours_per_night < 7) list.push("Aim for 7–9 hours of sleep — it's the single biggest lever for mood.");
  if (p.avg_daily_usage_hours > 5) list.push("Try capping social media at under 4 hours; use app timers after 9 PM.");
  if (p.daily_unlocks > 100) list.push("Turn off non-essential notifications to cut compulsive phone checks.");
  if (p.physical_activity_hours < 1) list.push("Add a 30-minute walk or workout — even light movement boosts mood.");
  if (p.stress_level === "High" || p.stress_level === "Very High") list.push("Schedule short breaks, breathing exercises or a chat with a friend each day.");
  if (p.purpose_of_use === "Entertainment" && p.avg_daily_usage_hours > 4) list.push("Swap some scrolling time for a hobby or time offline with people.");
  if (!list.length) list.push("Great balance! Keep your sleep, movement and screen time consistent.");
  return list.slice(0, 4);
}

function renderResult(score, payload) {
  const clamped = Math.max(0, Math.min(score, SCORE_MAX));
  const offset = GAUGE_LENGTH * (1 - clamped / SCORE_MAX);
  gaugeBar.style.strokeDashoffset = offset;
  animateNumber(scoreValue, score);

  const v = interpret(score);
  verdict.className = "verdict " + v.cls;
  verdictTitle.textContent = v.title;
  verdictText.textContent = v.text;

  tipsList.innerHTML = "";
  buildTips(payload).forEach((t) => {
    const li = document.createElement("li");
    li.textContent = t;
    tipsList.appendChild(li);
  });
  tips.hidden = false;

  if (window.innerWidth <= 980) {
    $("resultCard").scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

/* ---------- Submit ---------- */
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearError();

  const payload = buildPayload();
  if (!validate(payload)) return;

  submitBtn.disabled = true;
  submitBtn.classList.add("loading");
  submitBtn.querySelector(".cta-label").textContent = "Analysing…";

  try {
    const res = await fetch(API_BASE + "/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      let detail = "Server returned an error (" + res.status + ").";
      try {
        const data = await res.json();
        if (Array.isArray(data.detail)) {
          detail = data.detail.map((d) => (d.loc ? d.loc.slice(-1)[0] + ": " : "") + d.msg).join(" · ");
        } else if (data.detail) {
          detail = String(data.detail);
        }
      } catch {}
      throw new Error(detail);
    }

    const data = await res.json();
    renderResult(data.predicted_mental_health_score, payload);
  } catch (err) {
    if (err instanceof TypeError) {
      showError("Can't reach the API at " + API_BASE + ". Make sure the FastAPI server is running (uvicorn main:app --reload).");
    } else {
      showError(err.message);
    }
  } finally {
    submitBtn.disabled = false;
    submitBtn.classList.remove("loading");
    submitBtn.querySelector(".cta-label").textContent = "Predict my score";
  }
});
