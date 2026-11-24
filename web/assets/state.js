const storageKey = "go-randomizer/v1";
const initialState = {
  poolText: "1, 2, 3, 4, 5, 6, 7, 8, 9, 10",
  queueText: "",
  queueID: "",
  queueLength: 0,
  position: 0,
  result: null,
};

export function readState() {
  try {
    return { ...initialState, ...JSON.parse(localStorage.getItem(storageKey)) };
  } catch {
    return { ...initialState };
  }
}

export function saveState(state) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(state));
  } catch {
    throw new Error("Не удалось сохранить данные. Проверь доступ к хранилищу браузера.");
  }
}

export function withStateLock(action) {
  return navigator.locks ? navigator.locks.request(storageKey, action) : action();
}

export async function requestNumbers(path, { poolText, queueText, queueID, position }) {
  try {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ poolText, queueText, queueID, position }),
    });
    const result = await response.json();
    if (response.ok || typeof result.error === "string") return result;
  } catch {
    // A network failure or a hosting error page gets the same retry message.
  }
  throw new Error("Не удалось связаться с сервером. Попробуй ещё раз.");
}
