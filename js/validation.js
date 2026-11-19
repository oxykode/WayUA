/**
 * Валідація форми зворотного зв'язку без сторонніх бібліотек.
 */

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("contact-form");

  if (!form) {
    return;
  }

  const fields = {
    name: document.getElementById("contact-name"),
    email: document.getElementById("contact-email"),
    phone: document.getElementById("contact-phone"),
    message: document.getElementById("contact-message"),
    consent: document.getElementById("contact-consent")
  };
  const errors = {
    name: document.getElementById("contact-name-error"),
    email: document.getElementById("contact-email-error"),
    phone: document.getElementById("contact-phone-error"),
    message: document.getElementById("contact-message-error"),
    consent: document.getElementById("contact-consent-error")
  };
  const submitButton = document.getElementById("contact-submit");
  const messageCounter = document.getElementById("message-counter");
  const validationModal = document.getElementById("validation-modal");
  const validationModalClose = document.getElementById("validation-modal-close");
  const textFieldNames = ["name", "email", "phone", "message"];

  const emailLocalPartPattern = /^[A-Z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Z0-9!#$%&'*+/=?^_`{|}~-]+)*$/i;
  const domainLabelPattern = /^[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?$/i;
  const phonePattern = /^\+380\d{9}$/;

  // Перевіряє email, не допускаючи порожніх доменних міток і дефісів на їх краях.
  function isValidEmail(value) {
    const atIndex = value.indexOf("@");

    if (atIndex <= 0 || atIndex !== value.lastIndexOf("@")) {
      return false;
    }

    const localPart = value.slice(0, atIndex);
    const domain = value.slice(atIndex + 1);
    const labels = domain.split(".");

    return localPart.length <= 64
      && emailLocalPartPattern.test(localPart)
      && domain.length <= 253
      && labels.length >= 2
      && labels.every((label) => domainLabelPattern.test(label))
      && labels[labels.length - 1].length >= 2;
  }

  // Повертає зрозуміле повідомлення про помилку або порожній рядок для валідного значення.
  function getError(fieldName) {
    const field = fields[fieldName];
    const value = field.value.trim();

    if (fieldName === "name") {
      if (!value) return "Введіть ваше ім’я.";
      if (value.length < 2) return "Ім’я повинно містити щонайменше 2 символи.";
      if (value.length > 60 || !/^[\p{L}\s'’-]+$/u.test(value)) {
        return "Введіть коректне ім’я (до 60 символів).";
      }
    }

    if (fieldName === "email") {
      if (!value) return "Введіть електронну адресу.";
      if (field.value.length > 254 || !isValidEmail(value)) {
        return "Введіть коректну електронну адресу, наприклад: example@gmail.com.";
      }
    }

    if (fieldName === "phone") {
      if (!value) return "Введіть номер телефону.";
      if (!phonePattern.test(field.value)) {
        return "Введіть номер у форматі +380XXXXXXXXX без пробілів.";
      }
    }

    if (fieldName === "message") {
      if (!value) return "Опишіть ваше звернення.";
      if (value.length < 10) return "Повідомлення повинно містити щонайменше 10 символів.";
      if (value.length > 1000) return "Повідомлення повинно містити не більше 1000 символів.";
    }

    if (fieldName === "consent" && !field.checked) {
      return "Для продовження необхідно підтвердити згоду.";
    }

    return "";
  }

  // Застосовує стан і повідомлення помилки до одного поля.
  function validateField(fieldName) {
    const field = fields[fieldName];
    const errorMessage = getError(fieldName);
    const errorElement = errors[fieldName];

    field.setAttribute("aria-invalid", String(Boolean(errorMessage)));

    if (fieldName === "consent") {
      field.classList.toggle("ring-2", Boolean(errorMessage));
      field.classList.toggle("ring-danger", Boolean(errorMessage));
    } else {
      field.classList.remove("border-danger", "border-success", "border-muted");
      field.classList.add(errorMessage ? "border-danger" : "border-success");
    }

    errorElement.textContent = errorMessage;
    errorElement.classList.toggle("hidden", !errorMessage);

    return !errorMessage;
  }

  // Очищає форму та візуальні стани після успішної перевірки.
  function resetFormAfterValidation() {
    form.reset();
    messageCounter.textContent = `0 / ${fields.message.maxLength}`;

    textFieldNames.forEach((fieldName) => {
      const field = fields[fieldName];
      field.classList.remove("border-danger", "border-success");
      field.classList.add("border-muted");
      field.removeAttribute("aria-invalid");
      errors[fieldName].textContent = "";
      errors[fieldName].classList.add("hidden");
    });

    fields.consent.classList.remove("ring-2", "ring-danger");
    fields.consent.removeAttribute("aria-invalid");
    errors.consent.textContent = "";
    errors.consent.classList.add("hidden");
  }

  // Не показує помилки до взаємодії; після першого вводу оновлює стан одразу.
  textFieldNames.forEach((fieldName) => {
    const field = fields[fieldName];

    field.addEventListener("input", () => {
      validateField(fieldName);
    });

    field.addEventListener("blur", () => {
      validateField(fieldName);
    });
  });

  fields.consent.addEventListener("change", () => {
    validateField("consent");
  });

  fields.consent.addEventListener("blur", () => {
    validateField("consent");
  });

  fields.message.addEventListener("input", () => {
    messageCounter.textContent = `${fields.message.value.length} / 1000`;
  });

  validationModalClose.addEventListener("click", () => {
    validationModal.close();
  });

  validationModal.addEventListener("close", () => {
    submitButton.focus();
  });

  // Форма лише перевіряє введення: без сервера дані не відправляються й не очищаються.
  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const allValid = [...textFieldNames, "consent"].every((fieldName) => {
      return validateField(fieldName);
    });

    if (!allValid) {
      const firstInvalidField = [...textFieldNames, "consent"].find(
        (fieldName) => fields[fieldName].getAttribute("aria-invalid") === "true"
      );
      if (firstInvalidField) fields[firstInvalidField].focus();
      return;
    }

    resetFormAfterValidation();
    validationModal.showModal();
    validationModalClose.focus();
  });
});
