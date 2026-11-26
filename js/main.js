/**
 * Загальна логіка лендингу: обмін міст, мобільне меню, галерея (Swiper + Fancybox), поява секцій.
 * Підключається з defer останнім: DOM уже розібрано, бібліотеки завантажено.
 */
(function () {
  "use strict";

  // Системне налаштування «зменшити рух»: без автопрокрутки й анімацій.
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Обмін міст у формі пошуку ---------- */
  const originInput = document.getElementById("origin");
  const destinationInput = document.getElementById("destination");
  const swapButton = document.getElementById("swap-cities");
  const swapStatus = document.getElementById("swap-status");

  if (originInput && destinationInput && swapButton && swapStatus) {
    swapButton.addEventListener("click", () => {
      const originValue = originInput.value;
      originInput.value = destinationInput.value;
      destinationInput.value = originValue;
      originInput.dispatchEvent(new Event("input", { bubbles: true }));
      destinationInput.dispatchEvent(new Event("input", { bubbles: true }));
      swapStatus.textContent = `Міста поміняно місцями. Звідки: ${originInput.value || "не вказано"}; куди: ${destinationInput.value || "не вказано"}.`;
    });
  }

  /* ---------- Мобільне меню ---------- */
  const menuButton = document.querySelector(".mobile-menu-button");
  const primaryNavigation = document.getElementById("primary-navigation");

  if (menuButton && primaryNavigation) {
    const isMenuOpen = () => menuButton.getAttribute("aria-expanded") === "true";

    const closeMenu = () => {
      if (!isMenuOpen()) return;
      menuButton.setAttribute("aria-expanded", "false");
      menuButton.setAttribute("aria-label", "Відкрити меню");
      primaryNavigation.classList.remove("flex");
      primaryNavigation.classList.add("hidden");
    };

    menuButton.addEventListener("click", () => {
      const isExpanded = isMenuOpen();
      menuButton.setAttribute("aria-expanded", String(!isExpanded));
      menuButton.setAttribute("aria-label", isExpanded ? "Відкрити меню" : "Закрити меню");
      primaryNavigation.classList.toggle("hidden", isExpanded);
      primaryNavigation.classList.toggle("flex", !isExpanded);
    });

    primaryNavigation.addEventListener("click", (event) => {
      if (event.target.closest("a")) {
        closeMenu();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && isMenuOpen()) {
        closeMenu();
        menuButton.focus();
      }
    });

    // Спрацьовує один раз при переході через 1280 px, а не на кожну подію resize.
    const desktopQuery = window.matchMedia("(min-width: 1280px)");
    desktopQuery.addEventListener("change", (event) => {
      if (event.matches) {
        closeMenu();
      }
    });
  }

  /* ---------- Галерея: Swiper ---------- */
  const galleryElement = document.querySelector(".gallery-swiper");

  // Swiper ініціалізується, лише коли галерея наближається до екрана:
  // його розрахунок розмітки не займає головний потік під час завантаження сторінки.
  const initGallery = () => {
    const gallerySwiper = new window.Swiper(galleryElement, {
      loop: true,
      speed: reduceMotion ? 0 : 700,
      spaceBetween: 16,
      slidesPerView: 1,
      grabCursor: true,
      autoplay: {
        delay: 3500,
        disableOnInteraction: false,
        pauseOnMouseEnter: true
      },
      pagination: {
        el: ".gallery-swiper .swiper-pagination",
        clickable: true
      },
      navigation: {
        prevEl: ".gallery-swiper .swiper-button-prev",
        nextEl: ".gallery-swiper .swiper-button-next"
      },
      breakpoints: {
        768: { slidesPerView: 2 },
        1024: { slidesPerView: 3 }
      },
      a11y: {
        enabled: true,
        prevSlideMessage: "Попередній слайд",
        nextSlideMessage: "Наступний слайд",
        firstSlideMessage: "Це перший слайд",
        lastSlideMessage: "Це останній слайд",
        paginationBulletMessage: "Перейти до слайда {{index}}"
      }
    });

    // WCAG 2.2.2: автопрокрутка працює лише коли користувач її не зупинив,
    // фокус не всередині слайдера і слайдер видно на екрані.
    const autoplayToggle = document.getElementById("gallery-autoplay-toggle");
    const autoplayToggleLabel = document.getElementById("gallery-autoplay-label");
    const autoplayToggleIcon = document.getElementById("gallery-autoplay-icon");
    const state = { pausedByUser: reduceMotion, focusInside: false, onScreen: true };

    const syncAutoplay = () => {
      const shouldRun = !state.pausedByUser && !state.focusInside && state.onScreen;
      if (shouldRun && !gallerySwiper.autoplay.running) {
        gallerySwiper.autoplay.start();
      } else if (!shouldRun && gallerySwiper.autoplay.running) {
        gallerySwiper.autoplay.stop();
      }
    };

    const renderAutoplayToggle = () => {
      if (!autoplayToggle || !autoplayToggleLabel || !autoplayToggleIcon) return;
      autoplayToggleLabel.textContent = state.pausedByUser ? "Увімкнути автопрокрутку" : "Зупинити автопрокрутку";
      autoplayToggleIcon.textContent = state.pausedByUser ? "▶" : "❚❚";
    };

    autoplayToggle?.addEventListener("click", () => {
      state.pausedByUser = !state.pausedByUser;
      renderAutoplayToggle();
      syncAutoplay();
    });

    galleryElement.addEventListener("focusin", () => {
      state.focusInside = true;
      syncAutoplay();
    });

    galleryElement.addEventListener("focusout", (event) => {
      if (!galleryElement.contains(event.relatedTarget)) {
        state.focusInside = false;
        syncAutoplay();
      }
    });

    // Не крутимо слайди, поки галерея поза екраном.
    if ("IntersectionObserver" in window) {
      new IntersectionObserver((entries) => {
        state.onScreen = entries[0].isIntersecting;
        syncAutoplay();
      }).observe(galleryElement);
    }

    renderAutoplayToggle();
    syncAutoplay();
  };

  // CSS галереї (Swiper, Fancybox) підвантажується разом з ініціалізацією, а не під час завантаження
  // сторінки: інакше кожен файл після першого кадру змушує браузер перераховувати розмітку всієї сторінки.
  const GALLERY_STYLES = [
    {
      href: "https://cdn.jsdelivr.net/npm/swiper@11.2.10/swiper-bundle.min.css",
      integrity: "sha384-gAPqlBuTCdtVcYt9ocMOYWrnBZ4XSL6q+4eXqwNycOr4iFczhNKtnYhF3NEXJM51"
    },
    {
      href: "https://cdn.jsdelivr.net/npm/@fancyapps/ui@5.0.36/dist/fancybox/fancybox.css",
      integrity: "sha384-qlUhevqmCF5AxtnfkF0zXJClBzA6GJuX/UrLejCfE61bBGt+zo/My0AJ+ojVmUSb"
    }
  ];

  const loadGalleryStyles = () => Promise.all(GALLERY_STYLES.map(({ href, integrity }) => new Promise((resolve) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.integrity = integrity;
    link.crossOrigin = "anonymous";
    link.onload = resolve;
    link.onerror = resolve; // галерея має запуститися навіть без стилів бібліотеки
    document.head.appendChild(link);
  })));

  if (galleryElement && typeof window.Swiper === "function") {
    const startGallery = () => loadGalleryStyles().then(initGallery);

    if ("IntersectionObserver" in window) {
      const lazyObserver = new IntersectionObserver((entries, observer) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          startGallery();
        }
      }, { rootMargin: "600px 0px" });
      lazyObserver.observe(galleryElement);
    } else {
      startGallery();
    }
  }

  /* ---------- Галерея: Fancybox ---------- */
  if (window.Fancybox) {
    window.Fancybox.bind('[data-fancybox="wayua-gallery"]', {
      animated: !reduceMotion,
      l10n: {
        CLOSE: "Закрити",
        NEXT: "Наступне фото",
        PREV: "Попереднє фото",
        MODAL: "Закрити перегляд можна клавішею Esc",
        ERROR: "Щось пішло не так, спробуйте пізніше",
        IMAGE_ERROR: "Зображення не знайдено",
        TOGGLE_ZOOM: "Змінити масштаб",
        TOGGLEZOOM: "Змінити масштаб",
        ZOOMIN: "Збільшити",
        ZOOMOUT: "Зменшити",
        TOGGLE_FULLSCREEN: "Повноекранний режим",
        TOGGLEFS: "Повноекранний режим",
        DOWNLOAD: "Завантажити"
      },
      Carousel: {
        l10n: {
          NEXT: "Наступне фото",
          PREV: "Попереднє фото",
          GOTO: "Перейти до фото %d"
        }
      },
      showClass: "fancybox-fadeIn",
      hideClass: "fancybox-fadeOut",
      Images: {
        zoom: true
      },
      Toolbar: {
        display: {
          left: [],
          middle: [],
          right: ["zoom", "fullscreen", "close"]
        }
      }
    });
  }

  /* ---------- Поява секцій при прокрутці (замість бібліотеки AOS) ---------- */
  const revealElements = document.querySelectorAll(".reveal");

  if (revealElements.length && !reduceMotion && "IntersectionObserver" in window) {
    document.documentElement.classList.add("reveal-ready");
    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { rootMargin: "0px 0px -80px 0px" });
    revealElements.forEach((element) => revealObserver.observe(element));
  }
})();
