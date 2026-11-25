(function () {
  "use strict";

  // Бізнес-правила калькулятора (грн). Єдине місце, де задаються ціни.
  const PRICES = Object.freeze({
    base: 900,
    border: Object.freeze({
      "shehyni-medika": 650,
      "krakovets-korczowa": 900,
      "chop-zahony": 500,
      "yahodyn-dorohusk": 1100
    }),
    transport: Object.freeze({
      train: 900,
      bus: 650,
      transfer: 1800,
      car: 1200
    }),
    load: Object.freeze({
      low: 0,
      medium: 250,
      high: 700
    }),
    waitingPerHour: 100,
    extraTransfer: 450,
    protection: 600,
    refundable: 350
  });

  const LIMITS = Object.freeze({
    cityMin: 2,
    cityMax: 40,
    bufferMin: 1,
    bufferMax: 24,
    transfersMin: 1,
    transfersMax: 4
  });

  const NBSP = String.fromCharCode(0xa0); // нерозривний пробіл між числом і одиницею
  // Класи стану поля: звичайний / помилка (включно зі станом фокуса, щоб червона рамка не ховалась під синьою).
  const INPUT_STATE_CLASSES = Object.freeze({
    normal: ["border-muted", "focus:border-brand-secondary", "focus:ring-brand-tint"],
    error: ["border-danger", "focus:border-danger", "focus:ring-danger/20"]
  });

  const FRAME_STATE_CLASSES = Object.freeze({
    normal: ["border-muted", "focus-within:border-brand-secondary", "focus-within:ring-brand-tint"],
    error: ["border-danger", "focus-within:border-danger", "focus-within:ring-danger/20"]
  });

  const CITY_PATTERN = /^\p{L}[\p{L}\s'’.-]*$/u;

  const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  const minOf = (map) => Math.min(...Object.values(map));
  const maxOf = (map) => Math.max(...Object.values(map));

  // Чиста функція: лише рахує, не торкається DOM.
  function calculateCost(input) {
    const items = {
      base: PRICES.base,
      transport: PRICES.transport[input.transport],
      border: PRICES.border[input.border],
      load: PRICES.load[input.load],
      waiting: input.buffer * PRICES.waitingPerHour,
      transfers: (input.transfers - 1) * PRICES.extraTransfer,
      protection: input.protection ? PRICES.protection : 0,
      refundable: input.refundable ? PRICES.refundable : 0
    };

    const total = Object.values(items).reduce((sum, value) => sum + value, 0);
    return { items, total };
  }

  const PRICE_RANGE = Object.freeze({
    min: calculateCost({
      transport: Object.keys(PRICES.transport).find((key) => PRICES.transport[key] === minOf(PRICES.transport)),
      border: Object.keys(PRICES.border).find((key) => PRICES.border[key] === minOf(PRICES.border)),
      load: "low",
      buffer: LIMITS.bufferMin,
      transfers: LIMITS.transfersMin,
      protection: false,
      refundable: false
    }).total,
    max: calculateCost({
      transport: Object.keys(PRICES.transport).find((key) => PRICES.transport[key] === maxOf(PRICES.transport)),
      border: Object.keys(PRICES.border).find((key) => PRICES.border[key] === maxOf(PRICES.border)),
      load: "high",
      buffer: LIMITS.bufferMax,
      transfers: LIMITS.transfersMax,
      protection: true,
      refundable: true
    }).total
  });

  function formatPrice(value) {
    if (!Number.isFinite(value) || value < 0) {
      return "—";
    }

    return `${Math.round(value).toLocaleString("uk-UA")}${NBSP}грн`;
  }

  function formatHours(value) {
    return `${value.toLocaleString("uk-UA")}${NBSP}год`;
  }

  function formatTransfers(value) {
    return `${value} ${value === 1 ? "пересадка" : "пересадки"}`;
  }

  function validateCity(value, emptyMessage) {
    const city = value.trim();

    if (!city) {
      return emptyMessage;
    }

    if (city.length < LIMITS.cityMin) {
      return `Назва міста має містити щонайменше ${LIMITS.cityMin} літери.`;
    }

    if (city.length > LIMITS.cityMax) {
      return `Назва міста — не довше ${LIMITS.cityMax} символів.`;
    }

    if (!CITY_PATTERN.test(city)) {
      return "Використовуйте лише літери, пробіл, дефіс або апостроф.";
    }

    return "";
  }

  function validateOption(value, map, emptyMessage, unknownMessage) {
    if (!value) {
      return emptyMessage;
    }

    return hasOwn(map, value) ? "" : unknownMessage;
  }

  function validateBuffer(input) {
    const range = `від ${LIMITS.bufferMin} до ${LIMITS.bufferMax} год`;

    if (input.validity.badInput) {
      return "Введіть число, наприклад 2,5.";
    }

    const raw = input.value.trim();

    if (!raw) {
      return `Вкажіть час очікування ${range}.`;
    }

    const hours = Number(raw);

    if (!Number.isFinite(hours) || hours < LIMITS.bufferMin || hours > LIMITS.bufferMax) {
      return `Час очікування має бути ${range}.`;
    }

    if (!Number.isInteger(hours * 2)) {
      return "Вкажіть значення з кроком 0,5 год (наприклад, 2,5).";
    }

    return "";
  }

  function readTransfers(input) {
    const value = Math.round(Number(input.value));

    if (!Number.isFinite(value)) {
      return LIMITS.transfersMin;
    }

    return Math.min(LIMITS.transfersMax, Math.max(LIMITS.transfersMin, value));
  }

  function initCalculator(form) {
    const byId = (id) => form.ownerDocument.getElementById(id);

    const ui = {
      origin: byId("trip-origin"),
      destination: byId("trip-destination"),
      border: byId("trip-border-point"),
      transport: byId("trip-transport"),
      buffer: byId("trip-buffer"),
      bufferFrame: byId("trip-buffer-frame"),
      transfers: byId("trip-transfers"),
      transfersOutput: byId("trip-transfers-value"),
      protection: byId("trip-transfer-protection"),
      refundable: byId("trip-refundable-ticket"),
      status: byId("trip-cost-status"),
      bufferSummary: byId("trip-buffer-summary"),
      total: byId("trip-total-cost-value"),
      meterValue: byId("trip-cost-meter-value"),
      meterTrack: byId("trip-cost-meter-track"),
      meterBar: byId("trip-cost-meter-bar"),
      explanation: byId("trip-cost-explanation-text")
    };

    const itemKeys = ["base", "transport", "border", "load", "waiting", "transfers", "protection", "refundable"];
    const itemOutputs = {};
    itemKeys.forEach((key) => {
      itemOutputs[key] = byId(`trip-cost-item-${key}`);
    });

    const fields = [
      {
        input: ui.origin,
        error: byId("trip-origin-error"),
        validate: () => validateCity(ui.origin.value, "Вкажіть місто виїзду.")
      },
      {
        input: ui.destination,
        error: byId("trip-destination-error"),
        validate: () => validateCity(ui.destination.value, "Вкажіть місто призначення.")
      },
      {
        input: ui.border,
        error: byId("trip-border-point-error"),
        validate: () => validateOption(ui.border.value, PRICES.border, "Оберіть пункт перетину.", "Оберіть пункт перетину зі списку.")
      },
      {
        input: ui.transport,
        error: byId("trip-transport-error"),
        validate: () => validateOption(ui.transport.value, PRICES.transport, "Оберіть транспорт.", "Оберіть транспорт зі списку.")
      },
      {
        input: ui.buffer,
        frame: ui.bufferFrame,
        error: byId("trip-buffer-error"),
        validate: () => validateBuffer(ui.buffer)
      }
    ];

    const missing = [
      ...Object.entries(ui),
      ...Object.entries(itemOutputs),
      ...fields.map((field, index) => [`error #${index}`, field.error])
    ].filter(([, element]) => !element).map(([name]) => name);

    if (missing.length) {
      console.warn("[trip-calculator] Віджет не запущено, бракує елементів:", missing.join(", "));
      return;
    }

    const touched = new Set();

    function getSelectedLoad() {
      const selected = form.querySelector('input[name="border-load"]:checked');
      return selected && hasOwn(PRICES.load, selected.value) ? selected.value : "medium";
    }

    function renderFieldError(field, message) {
      const visible = Boolean(message) && touched.has(field.input);
      const target = field.frame || field.input;
      const states = field.frame ? FRAME_STATE_CLASSES : INPUT_STATE_CLASSES;

      field.input.setAttribute("aria-invalid", String(visible));
      target.classList.remove(...(visible ? states.normal : states.error));
      target.classList.add(...(visible ? states.error : states.normal));
      field.error.textContent = visible ? message : "";
      field.error.classList.toggle("hidden", !visible);

      return visible;
    }

    function selectedText(select) {
      const option = select.options[select.selectedIndex];
      return option ? option.text.replace(/\s*\(.*\)$/, "") : "";
    }

    // «Потяг УЗ» → «потяг УЗ»: змінюємо лише першу літеру, абревіатури лишаються.
    function lowerFirst(text) {
      return text ? text.charAt(0).toLocaleLowerCase("uk-UA") + text.slice(1) : "";
    }

    function renderEmpty(hasVisibleErrors) {
      ui.status.textContent = hasVisibleErrors ? "Перевірте поля" : "Заповніть параметри";
      ui.status.classList.toggle("text-danger", hasVisibleErrors);
      ui.status.classList.toggle("text-brand-primary", !hasVisibleErrors);
      ui.bufferSummary.textContent = "—";
      ui.total.textContent = "—";
      ui.meterValue.textContent = "—";
      ui.meterBar.style.width = "0%";
      ui.meterTrack.setAttribute("aria-label", "Ціновий рівень не розраховано");
      itemKeys.forEach((key) => {
        itemOutputs[key].textContent = "—";
      });
      ui.explanation.textContent = hasVisibleErrors
        ? "Виправте позначені поля — вартість з’явиться автоматично."
        : "Вкажіть міста, пункт перетину й транспорт, щоб побачити кошторис.";
    }

    function update() {
      const transfers = readTransfers(ui.transfers);
      ui.transfersOutput.textContent = formatTransfers(transfers);

      let firstInvalid = null;
      let hasVisibleErrors = false;

      fields.forEach((field) => {
        const message = field.validate();

        if (message && !firstInvalid) {
          firstInvalid = field.input;
        }

        if (renderFieldError(field, message)) {
          hasVisibleErrors = true;
        }
      });

      if (firstInvalid) {
        renderEmpty(hasVisibleErrors);
        return firstInvalid;
      }

      const buffer = Number(ui.buffer.value);
      const result = calculateCost({
        transport: ui.transport.value,
        border: ui.border.value,
        load: getSelectedLoad(),
        buffer,
        transfers,
        protection: ui.protection.checked,
        refundable: ui.refundable.checked
      });

      if (!Number.isFinite(result.total) || result.total < 0) {
        renderEmpty(true);
        return ui.transport;
      }

      const share = (result.total - PRICE_RANGE.min) / (PRICE_RANGE.max - PRICE_RANGE.min);
      const percent = Math.round(Math.min(1, Math.max(0, share)) * 100);
      const level = percent < 34 ? "Економ" : percent < 67 ? "Стандарт" : "Преміум";

      ui.status.textContent = "Розраховано";
      ui.status.classList.remove("text-danger");
      ui.status.classList.add("text-brand-primary");
      ui.bufferSummary.textContent = formatHours(buffer);
      ui.total.textContent = formatPrice(result.total);
      ui.meterValue.textContent = level;
      ui.meterBar.style.width = `${Math.max(percent, 4)}%`;
      ui.meterTrack.setAttribute(
        "aria-label",
        `Ціновий рівень: ${level}, ${percent}% діапазону від ${formatPrice(PRICE_RANGE.min)} до ${formatPrice(PRICE_RANGE.max)}`
      );
      itemKeys.forEach((key) => {
        itemOutputs[key].textContent = formatPrice(result.items[key]);
      });
      ui.explanation.textContent =
        `${ui.origin.value.trim()} — ${ui.destination.value.trim()}: ${lowerFirst(selectedText(ui.transport))} ` +
        `через пункт «${selectedText(ui.border)}», ${formatTransfers(transfers)}. ` +
        "Ціни орієнтовні, на основі демонстраційних тарифів.";

      return null;
    }

    form.addEventListener("input", update);

    // Значення вже перераховане подією input; change лише позначає поле «торкнутим»,
    // тому перераховуємо повторно тільки коли це сталося вперше (щоб показати помилку).
    form.addEventListener("change", (event) => {
      if (!touched.has(event.target)) {
        touched.add(event.target);
        update();
      }
    });

    form.addEventListener("focusout", (event) => {
      if (fields.some((field) => field.input === event.target)) {
        touched.add(event.target);
        update();
      }
    });

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      fields.forEach((field) => touched.add(field.input));

      const firstInvalid = update();

      if (firstInvalid) {
        firstInvalid.focus();
      }
    });

    form.addEventListener("reset", () => {
      touched.clear();
      window.requestAnimationFrame(update);
    });

    update();
  }

  document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("trip-cost-form");

    if (form) {
      initCalculator(form);
    }
  });
})();
