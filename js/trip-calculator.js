(function () {
  "use strict";

  // ---------- Бізнес-правила (демонстраційні тарифи, грн) ----------

  // Координати міст [широта, довгота] — відстань рахується за ними, а не вводиться вручну.
  const CITIES = Object.freeze({
    kyiv: { name: "Київ", lat: 50.45, lon: 30.52 },
    lviv: { name: "Львів", lat: 49.84, lon: 24.03 },
    kharkiv: { name: "Харків", lat: 49.99, lon: 36.23 },
    odesa: { name: "Одеса", lat: 46.48, lon: 30.72 },
    dnipro: { name: "Дніпро", lat: 48.46, lon: 35.05 },
    vinnytsia: { name: "Вінниця", lat: 49.23, lon: 28.47 },
    uzhhorod: { name: "Ужгород", lat: 48.62, lon: 22.29 },
    krakow: { name: "Краків", lat: 50.06, lon: 19.94 },
    warsaw: { name: "Варшава", lat: 52.23, lon: 21.01 },
    budapest: { name: "Будапешт", lat: 47.5, lon: 19.04 },
    vienna: { name: "Відень", lat: 48.21, lon: 16.37 },
    prague: { name: "Прага", lat: 50.08, lon: 14.44 },
    berlin: { name: "Берлін", lat: 52.52, lon: 13.4 },
    rome: { name: "Рим", lat: 41.9, lon: 12.5 },
    paris: { name: "Париж", lat: 48.86, lon: 2.35 }
  });

  const ORIGINS = Object.freeze(["kyiv", "lviv", "kharkiv", "odesa", "dnipro", "vinnytsia", "uzhhorod"]);
  const DESTINATIONS = Object.freeze(["krakow", "warsaw", "budapest", "vienna", "prague", "berlin", "rome", "paris"]);

  // perKm — за пасажира (автобус, потяг) або за авто (пальне); border — середнє очікування на кордоні, год.
  const MODES = Object.freeze({
    bus: { name: "автобус", perKm: 1.6, perPassenger: true, speed: 60, border: 4 },
    train: { name: "потяг", perKm: 2.0, perPassenger: true, speed: 70, border: 2 },
    car: { name: "авто", perKm: 4.2, perPassenger: false, speed: 75, border: 6, insurance: 1200, maxPassengers: 5 }
  });

  const RULES = Object.freeze({
    roadFactor: 1.25, // дороги довші за пряму лінію між містами
    luggagePerPassenger: 250,
    serviceRate: 0.05,
    serviceMin: 150,
    roundTripDiscount: 0.1,
    passengersMin: 1,
    passengersMax: 8
  });

  const NBSP = String.fromCharCode(0xa0); // нерозривний пробіл між числом і одиницею
  const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

  // Відстань по дорогах: формула гаверсинуса × дорожній коефіцієнт, округлення до 10 км.
  function roadDistanceKm(from, to) {
    const rad = (deg) => (deg * Math.PI) / 180;
    const dLat = rad(to.lat - from.lat);
    const dLon = rad(to.lon - from.lon);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(from.lat)) * Math.cos(rad(to.lat)) * Math.sin(dLon / 2) ** 2;
    const straight = 2 * 6371 * Math.asin(Math.sqrt(a));
    return Math.round((straight * RULES.roadFactor) / 10) * 10;
  }

  // Чиста функція: лише рахує, не торкається DOM.
  function calculateTrip({ origin, destination, mode, passengers, luggage, roundTrip }) {
    const transport = MODES[mode];
    const distance = roadDistanceKm(CITIES[origin], CITIES[destination]);
    const trips = roundTrip ? 2 : 1;

    const fare = Math.round(distance * transport.perKm * (transport.perPassenger ? passengers : 1)) * trips;
    const insurance = transport.insurance || 0;
    const luggageCost = luggage && transport.perPassenger ? RULES.luggagePerPassenger * passengers * trips : 0;
    const discount = roundTrip ? Math.round((fare + luggageCost) * RULES.roundTripDiscount) : 0;
    const subtotal = fare + insurance + luggageCost - discount;
    const service = Math.max(RULES.serviceMin, Math.round(subtotal * RULES.serviceRate));
    const total = subtotal + service;

    return {
      distance,
      hours: distance / transport.speed + transport.border,
      items: { fare, insurance, luggage: luggageCost, service, discount },
      total,
      perPerson: Math.round(total / passengers)
    };
  }

  function formatPrice(value) {
    if (!Number.isFinite(value) || value < 0) {
      return "—";
    }

    return `${Math.round(value).toLocaleString("uk-UA")}${NBSP}грн`;
  }

  function formatDuration(hours) {
    const total = Math.round(hours * 60);
    const h = Math.floor(total / 60);
    const m = total % 60;
    return m ? `${h}${NBSP}год ${m}${NBSP}хв` : `${h}${NBSP}год`;
  }

  function formatPassengers(n) {
    const lastTwo = n % 100;
    const last = n % 10;
    if (last === 1 && lastTwo !== 11) return `${n} пасажир`;
    if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) return `${n} пасажири`;
    return `${n} пасажирів`;
  }

  // Класи стану поля: звичайний / помилка (включно зі станом фокуса).
  const INPUT_STATE_CLASSES = Object.freeze({
    normal: ["border-field", "focus:border-brand-secondary", "focus:ring-brand-tint"],
    error: ["border-danger", "focus:border-danger", "focus:ring-danger/20"]
  });

  const FRAME_STATE_CLASSES = Object.freeze({
    normal: ["border-field", "focus-within:border-brand-secondary", "focus-within:ring-brand-tint"],
    error: ["border-danger", "focus-within:border-danger", "focus-within:ring-danger/20"]
  });

  function validateCity(value, allowed, emptyMessage) {
    if (!value) return emptyMessage;
    return allowed.includes(value) && hasOwn(CITIES, value) ? "" : "Оберіть місто зі списку.";
  }

  function validatePassengers(input, mode) {
    const range = `від ${RULES.passengersMin} до ${RULES.passengersMax}`;

    if (input.validity.badInput) return "Введіть ціле число, наприклад 2.";

    const raw = input.value.trim();
    if (!raw) return `Вкажіть кількість пасажирів ${range}.`;

    const n = Number(raw);
    if (!Number.isFinite(n) || !Number.isInteger(n)) return "Кількість пасажирів — ціле число.";
    if (n < RULES.passengersMin || n > RULES.passengersMax) return `Кількість пасажирів має бути ${range}.`;

    const transport = MODES[mode];
    if (transport && transport.maxPassengers && n > transport.maxPassengers) {
      return `В авто — не більше ${transport.maxPassengers} пасажирів.`;
    }

    return "";
  }

  function initCalculator(form) {
    const byId = (id) => form.ownerDocument.getElementById(id);

    const ui = {
      origin: byId("trip-origin"),
      destination: byId("trip-destination"),
      passengers: byId("trip-passengers"),
      passengersFrame: byId("trip-passengers-frame"),
      luggage: byId("trip-luggage"),
      roundTrip: byId("trip-round"),
      status: byId("trip-cost-status"),
      distance: byId("trip-distance-value"),
      total: byId("trip-total-cost-value"),
      duration: byId("trip-duration-value"),
      perPerson: byId("trip-per-person-value"),
      fareLabel: byId("trip-cost-item-fare-label"),
      explanation: byId("trip-cost-explanation-text")
    };

    const itemKeys = ["fare", "insurance", "luggage", "service", "discount"];
    const itemOutputs = {};
    itemKeys.forEach((key) => {
      itemOutputs[key] = byId(`trip-cost-item-${key}`);
    });

    const getMode = () => {
      const selected = form.querySelector('input[name="mode"]:checked');
      return selected && hasOwn(MODES, selected.value) ? selected.value : "bus";
    };

    const fields = [
      {
        input: ui.origin,
        error: byId("trip-origin-error"),
        validate: () => validateCity(ui.origin.value, ORIGINS, "Оберіть місто виїзду.")
      },
      {
        input: ui.destination,
        error: byId("trip-destination-error"),
        validate: () => validateCity(ui.destination.value, DESTINATIONS, "Оберіть місто призначення.")
      },
      {
        input: ui.passengers,
        frame: ui.passengersFrame,
        error: byId("trip-passengers-error"),
        validate: () => validatePassengers(ui.passengers, getMode())
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

    function renderEmpty(hasVisibleErrors) {
      ui.status.textContent = hasVisibleErrors ? "Перевірте поля" : "Заповніть параметри";
      ui.status.classList.toggle("text-danger", hasVisibleErrors);
      ui.status.classList.toggle("text-brand-primary", !hasVisibleErrors);
      [ui.distance, ui.total, ui.duration, ui.perPerson].forEach((el) => { el.textContent = "—"; });
      itemKeys.forEach((key) => { itemOutputs[key].textContent = "—"; });
      ui.explanation.textContent = hasVisibleErrors
        ? "Виправте позначені поля — вартість з’явиться автоматично."
        : "Оберіть міста, щоб побачити кошторис.";
    }

    function update() {
      let firstInvalid = null;
      let hasVisibleErrors = false;

      fields.forEach((field) => {
        const message = field.validate();
        if (message && !firstInvalid) firstInvalid = field.input;
        if (renderFieldError(field, message)) hasVisibleErrors = true;
      });

      if (firstInvalid) {
        renderEmpty(hasVisibleErrors);
        return firstInvalid;
      }

      const mode = getMode();
      const passengers = Number(ui.passengers.value);
      const roundTrip = ui.roundTrip.checked;
      const result = calculateTrip({
        origin: ui.origin.value,
        destination: ui.destination.value,
        mode,
        passengers,
        luggage: ui.luggage.checked,
        roundTrip
      });

      if (!Number.isFinite(result.total) || result.total < 0) {
        renderEmpty(true);
        return ui.origin;
      }

      ui.status.textContent = "Розраховано";
      ui.status.classList.remove("text-danger");
      ui.status.classList.add("text-brand-primary");
      ui.distance.textContent = `≈${NBSP}${result.distance.toLocaleString("uk-UA")}${NBSP}км`;
      ui.total.textContent = formatPrice(result.total);
      ui.duration.textContent = `≈${NBSP}${formatDuration(result.hours)}` + (roundTrip ? " в один бік" : "");
      ui.perPerson.textContent = formatPrice(result.perPerson);
      ui.fareLabel.textContent = MODES[mode].perPassenger
        ? `Квитки (${formatPassengers(passengers)}${roundTrip ? ", туди й назад" : ""})`
        : `Пальне${roundTrip ? " (туди й назад)" : ""}`;
      itemKeys.forEach((key) => {
        const value = result.items[key];
        itemOutputs[key].textContent = key === "discount" && value ? `−${formatPrice(value)}` : formatPrice(value);
      });
      ui.explanation.textContent =
        `${CITIES[ui.origin.value].name} → ${CITIES[ui.destination.value].name}: ${MODES[mode].name}, ` +
        `${formatPassengers(passengers)}, з урахуванням ~${MODES[mode].border}${NBSP}год на кордоні. ` +
        "Ціни орієнтовні, на основі демонстраційних тарифів.";

      return null;
    }

    form.addEventListener("input", update);

    // change лише позначає поле «торкнутим»; перераховуємо повторно тільки вперше (щоб показати помилку).
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
      if (firstInvalid) firstInvalid.focus();
    });

    form.addEventListener("reset", () => {
      touched.clear();
      window.requestAnimationFrame(update);
    });

    update();
  }

  document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("trip-cost-form");
    if (form) initCalculator(form);
  });
})();
