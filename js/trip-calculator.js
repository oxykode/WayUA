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
    przemysl: { name: "Перемишль", lat: 49.78, lon: 22.77 },
    chelm: { name: "Холм", lat: 51.14, lon: 23.47 },
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
  const DESTINATIONS = Object.freeze(["przemysl", "chelm", "krakow", "warsaw", "budapest", "vienna", "prague", "berlin", "rome", "paris"]);

  // Прямі міжнародні потяги Укрзалізниці (за повідомленнями УЗ, графік 2025–2026; перевіряти на uz.gov.ua).
  // from — міста виїзду з цього списку, де поїзд має зупинку; to — міста призначення.
  const UZ_TRAINS = Object.freeze([
    { number: "67/68", route: "Київ — Варшава", from: ["kyiv"], to: ["warsaw"] },
    { number: "23/24", route: "Київ — Холм", from: ["kyiv"], to: ["chelm"] },
    { number: "31/32", route: "Київ — Перемишль", from: ["kyiv", "vinnytsia", "lviv"], to: ["przemysl"] },
    { number: "63/64", route: "Харків — Київ — Перемишль «Оберіг»", from: ["kharkiv", "kyiv", "lviv"], to: ["przemysl"] },
    { number: "73/74", route: "Дніпро — Перемишль", from: ["dnipro", "lviv"], to: ["przemysl"] },
    { number: "7/8", route: "Ужгород — Будапешт — Відень", from: ["uzhhorod"], to: ["budapest", "vienna"] }
  ]);

  const findUzTrains = (origin, destination) =>
    UZ_TRAINS.filter((train) => train.from.includes(origin) && train.to.includes(destination));

  // До прикордонних міст трансфер не потрібен: туди веде прямий потяг.
  const NO_TRANSFER = Object.freeze(["przemysl", "chelm"]);

  // perKm — за пасажира (автобус, потяг) або за авто (пальне); border — середнє очікування на кордоні, год.
  const MODES = Object.freeze({
    bus: { name: "автобус", perKm: 1.6, perPassenger: true, speed: 60, border: 4 },
    train: { name: "потяг", perKm: 2.0, perPassenger: true, speed: 70, border: 2 },
    car: { name: "авто", perKm: 4.2, perPassenger: false, speed: 75, border: 6, insurance: 1200, maxPassengers: 5 },
    // Зручний трансфер: потяг до прикордонного хабу, далі автобус; одне бронювання з гарантованою пересадкою.
    transfer: { name: "зручний трансфер", perPassenger: true, border: 2, transferHours: 1, guaranteePerPassenger: 150 }
  });

  // Прикордонні хаби для трансферу: до Польщі, Чехії, Німеччини, Франції — через Перемишль; до Угорщини, Австрії, Італії — через Чоп.
  const HUBS = Object.freeze({
    przemysl: { name: "Перемишль", nameGenitive: "Перемишля", lat: 49.78, lon: 22.77 },
    chop: { name: "Чоп", nameGenitive: "Чопа", lat: 48.43, lon: 22.2 }
  });
  const TRANSFER_HUB = Object.freeze({
    przemysl: "przemysl", chelm: "przemysl",
    krakow: "przemysl", warsaw: "przemysl", prague: "przemysl", berlin: "przemysl", paris: "przemysl",
    budapest: "chop", vienna: "chop", rome: "chop"
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
    const trips = roundTrip ? 2 : 1;
    let distance;
    let hours;
    let farePerTrip;
    let hub = null;

    if (mode === "transfer") {
      // Сегмент 1: потяг до хабу; сегмент 2: автобус від хабу до міста призначення.
      hub = HUBS[TRANSFER_HUB[destination]];
      const trainKm = roadDistanceKm(CITIES[origin], hub);
      const busKm = roadDistanceKm(hub, CITIES[destination]);
      distance = trainKm + busKm;
      hours = trainKm / MODES.train.speed + busKm / MODES.bus.speed + transport.border + transport.transferHours;
      farePerTrip = Math.round((trainKm * MODES.train.perKm + busKm * MODES.bus.perKm) * passengers);
    } else {
      distance = roadDistanceKm(CITIES[origin], CITIES[destination]);
      hours = distance / transport.speed + transport.border;
      farePerTrip = Math.round(distance * transport.perKm * (transport.perPassenger ? passengers : 1));
    }

    const fare = farePerTrip * trips;
    const insurance = transport.insurance || 0;
    const luggageCost = luggage && transport.perPassenger ? RULES.luggagePerPassenger * passengers * trips : 0;
    const guarantee = (transport.guaranteePerPassenger || 0) * passengers * trips;
    const discount = roundTrip ? Math.round((fare + luggageCost + guarantee) * RULES.roundTripDiscount) : 0;
    const subtotal = fare + insurance + luggageCost + guarantee - discount;
    const service = Math.max(RULES.serviceMin, Math.round(subtotal * RULES.serviceRate));
    const total = subtotal + service;

    return {
      distance,
      hours,
      hub,
      items: { fare, insurance, luggage: luggageCost, guarantee, service, discount },
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
      explanation: byId("trip-cost-explanation-text"),
      modeError: byId("trip-mode-error"),
      trainRadio: byId("trip-mode-train"),
      trainCaption: byId("trip-train-caption"),
      transferRadio: byId("trip-mode-transfer")
    };
    const TRAIN_CAPTION_DEFAULT = ui.trainCaption ? ui.trainCaption.textContent : "";

    const itemKeys = ["fare", "insurance", "luggage", "guarantee", "service", "discount"];
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

    // Потяг доступний лише за наявності прямого рейсу УЗ; трансфер не має сенсу до прикордонних міст.
    // Повертає текст помилки для вибраного транспорту (або порожній рядок) і список потягів.
    function syncModeAvailability(mode) {
      const origin = ui.origin.value;
      const destination = ui.destination.value;
      const citiesChosen = ORIGINS.includes(origin) && DESTINATIONS.includes(destination);
      const trains = citiesChosen ? findUzTrains(origin, destination) : [];

      ui.trainRadio.disabled = citiesChosen && !trains.length && mode !== "train";
      ui.transferRadio.disabled = citiesChosen && NO_TRANSFER.includes(destination) && mode !== "transfer";
      ui.trainCaption.textContent = !citiesChosen
        ? TRAIN_CAPTION_DEFAULT
        : trains.length
          ? `№${trains.map((train) => train.number).join(", №")} · 2,0 грн/км`
          : "немає прямого рейсу УЗ";

      let message = "";
      if (citiesChosen && mode === "train" && !trains.length) {
        message = `Прямого потяга Укрзалізниці з міста ${CITIES[origin].name} до міста ${CITIES[destination].name} немає. ` +
          "Оберіть «Зручний трансфер» або автобус.";
      } else if (citiesChosen && mode === "transfer" && NO_TRANSFER.includes(destination)) {
        message = `До міста ${CITIES[destination].name} пересадка не потрібна — ` +
          (findUzTrains(origin, destination).length ? "оберіть «Потяг УЗ»." : "оберіть автобус або авто.");
      }

      ui.modeError.textContent = message;
      ui.modeError.classList.toggle("hidden", !message);
      return { message, trains };
    }

    function update() {
      let firstInvalid = null;
      let hasVisibleErrors = false;

      fields.forEach((field) => {
        const message = field.validate();
        if (message && !firstInvalid) firstInvalid = field.input;
        if (renderFieldError(field, message)) hasVisibleErrors = true;
      });

      const modeCheck = syncModeAvailability(getMode());
      if (modeCheck.message) {
        hasVisibleErrors = true;
        if (!firstInvalid) firstInvalid = form.querySelector('input[name="mode"]:checked') || ui.trainRadio;
      }

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
      const tripNote = roundTrip ? ", туди й назад" : "";
      if (mode === "transfer") {
        ui.fareLabel.textContent = `Потяг до ${result.hub.nameGenitive} + автобус (${formatPassengers(passengers)}${tripNote})`;
      } else if (MODES[mode].perPassenger) {
        ui.fareLabel.textContent = `Квитки (${formatPassengers(passengers)}${tripNote})`;
      } else {
        ui.fareLabel.textContent = `Пальне${roundTrip ? " (туди й назад)" : ""}`;
      }
      itemKeys.forEach((key) => {
        const value = result.items[key];
        itemOutputs[key].textContent = key === "discount" && value ? `−${formatPrice(value)}` : formatPrice(value);
      });
      const modeName = mode === "train"
        ? `потяг УЗ №${modeCheck.trains[0].number} ${modeCheck.trains[0].route}`
        : MODES[mode].name;
      ui.explanation.textContent =
        `${CITIES[ui.origin.value].name} → ${result.hub ? result.hub.name + " → " : ""}${CITIES[ui.destination.value].name}: ${modeName}, ` +
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
