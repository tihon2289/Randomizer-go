import { readState, requestNumbers, saveState, withStateLock } from "./state.js";

const card = document.querySelector(".result");
const number = document.getElementById("number");
const message = document.getElementById("result-message");
const announcement = document.getElementById("result-announcement");
const button = document.getElementById("draw");
const label = document.getElementById("draw-label");
const error = document.getElementById("draw-error");
const settingsLink = document.querySelector(".icon-button");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const delays = [44, 47, 52, 60, 70, 82, 100, 120, 145, 175, 215];
let drawing = false;

function showNumber(value) {
  const text = value === null ? "—" : value.replace(/^-/, "−");
  number.textContent = text;
  number.style.setProperty("--number-size", `${Math.min(90, 246 / text.length)}px`);
}

function showSavedResult() {
  const { result } = readState();
  showNumber(result);
  card.classList.toggle("has-result", result !== null);
  message.textContent = result === null ? "Ожидает запуска" : "Число выбрано";
  announcement.textContent = result === null ? "" : `${result}. `;
}

async function draw() {
  if (drawing) return;

  drawing = true;
  card.classList.add("is-drawing");
  button.setAttribute("aria-disabled", "true");
  settingsLink.setAttribute("aria-disabled", "true");
  label.textContent = "Выбираем…";
  error.hidden = true;
  announcement.textContent = "";
  message.textContent = "Идёт выбор";
  if (!reducedMotion.matches) showNumber(null);

  try {
    await withStateLock(async () => {
      const state = readState();
      const response = await requestNumbers("/api/draw", state);
      if (response.error) throw new Error(response.error);

      if (!reducedMotion.matches) {
        for (const [index, delay] of delays.entries()) {
          showNumber(response.frames?.[index] ?? null);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }

      saveState({
        ...state,
        queueID: response.queueID,
        queueLength: response.queueLength,
        position: response.position,
        result: response.number,
      });
    });
  } catch (failure) {
    error.textContent = failure.message;
    error.hidden = false;
  } finally {
    drawing = false;
    card.classList.remove("is-drawing");
    button.removeAttribute("aria-disabled");
    settingsLink.removeAttribute("aria-disabled");
    label.textContent = "Выбрать число";
    showSavedResult();
  }
}

button.disabled = false;
button.addEventListener("click", draw);
settingsLink.addEventListener("click", (event) => {
  if (drawing) event.preventDefault();
});
window.addEventListener("pageshow", () => {
  if (!drawing) showSavedResult();
});
window.addEventListener("storage", () => {
  if (!drawing) showSavedResult();
});
showSavedResult();
