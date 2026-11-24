import { readState, requestNumbers, saveState, withStateLock } from "./state.js";

const form = document.getElementById("settings");
const pool = document.getElementById("pool");
const queue = document.getElementById("queue");
const queueCount = document.getElementById("queue-count");
const restart = document.getElementById("restart");
const save = document.getElementById("save");
let busy = false;

function showError(id, message = "") {
  const element = document.getElementById(id);
  element.textContent = message;
  element.hidden = message === "";
}

function showFieldError(field, message = "") {
  field.setAttribute("aria-invalid", String(message !== ""));
  showError(`${field.id}-error`, message);
}

function showQueueProgress() {
  const state = readState();
  const matches = queue.value === state.queueText;
  queueCount.textContent = matches && state.queueLength > 0
    ? `Осталось ${state.queueLength - state.position} из ${state.queueLength}`
    : "";
  restart.hidden = !matches || state.position === 0;
}

function setBusy(value) {
  busy = value;
  save.disabled = value;
  restart.disabled = value;
  pool.readOnly = value;
  queue.readOnly = value;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (busy) return;
  setBusy(true);
  save.textContent = "Сохраняем…";
  showError("settings-error");
  let invalidField;

  try {
    const response = await withStateLock(async () => {
      const state = { ...readState(), poolText: pool.value, queueText: queue.value };
      const response = await requestNumbers("/api/settings", state);
      if (!response.error) {
        saveState({
          ...state,
          queueID: response.queueID,
          queueLength: response.queueLength,
          position: response.position,
        });
      }
      return response;
    });

    if (response.error) {
      showFieldError(pool, response.fields?.pool);
      showFieldError(queue, response.fields?.queue);
      showError("settings-error", response.error);
      invalidField = response.fields?.pool ? pool : response.fields?.queue ? queue : undefined;
    } else {
      window.location.assign("/");
    }
  } catch (failure) {
    showError("settings-error", failure.message);
  } finally {
    setBusy(false);
    save.textContent = "Сохранить и вернуться";
  }
  invalidField?.focus();
});

restart.addEventListener("click", async () => {
  if (busy) return;
  setBusy(true);
  showError("settings-error");
  try {
    await withStateLock(() => {
      const state = readState();
      if (state.queueText === queue.value) saveState({ ...state, position: 0 });
    });
    showQueueProgress();
  } catch (failure) {
    showError("settings-error", failure.message);
  } finally {
    setBusy(false);
  }
});

for (const field of [pool, queue]) {
  field.addEventListener("input", () => {
    showFieldError(field);
    showError("settings-error");
    showQueueProgress();
  });
}

const state = readState();
pool.value = state.poolText;
queue.value = state.queueText;
save.disabled = false;
showQueueProgress();
window.addEventListener("pageshow", showQueueProgress);
window.addEventListener("storage", showQueueProgress);
