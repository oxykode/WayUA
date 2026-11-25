/** @type {import('tailwindcss').Config} */
module.exports = {
  // Класи шукаються і в HTML, і в JS (віджет та валідація додають класи стану динамічно).
  content: ["./index.html", "./js/**/*.js"],
  theme: {
    extend: {
      colors: {
        copy: {
          primary: "#0F172A",
          secondary: "#515F78"
        },
        brand: {
          primary: "#0A192F",
          secondary: "#1E3A8A",
          accent: "#00F0FF",
          "accent-hover": "#00D4E0",
          "accent-active": "#00BFCB",
          tint: "rgba(0, 240, 255, 0.1)"
        },
        page: "#F2F3FF",
        muted: "#E2E7FF",
        footer: "#050E1A",
        success: "#10B981",
        "success-ink": "#047857",
        // #C81E1E: ≥ 4,5:1 і на білому (5,74), і на фоні сторінки (5,20) — WCAG 1.4.3
        danger: "#C81E1E",
        // Межа полів форм: ≥ 3:1 на білому (3,48) і на фоні сторінки (3,15) — WCAG 1.4.11
        field: "#7D8AA3",
        "muted-inverse": "#94A3B8",
        overlay: "rgba(255, 255, 255, 0.1)"
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        brand: ["Plus Jakarta Sans", "Inter", "system-ui", "sans-serif"]
      },
      fontSize: {
        caption: "10px",
        "body-xs": "12px",
        "body-sm": "13px",
        body: "14px",
        "body-lg": "18px",
        "heading-sm": "24px",
        "heading-md": "32px",
        hero: "clamp(2rem, 3.8vw, 3rem)",
        "section-mobile": "clamp(24px, 7vw, 28px)"
      },
      borderRadius: {
        control: "6px",
        panel: "20px"
      },
      lineHeight: {
        body: "1.5",
        heading: "1.2"
      },
      boxShadow: {
        card: "0 2px 4px rgba(15, 23, 42, 0.03)",
        hero: "0 20px 40px rgba(0, 0, 0, 0.2)"
      },
      transitionDuration: {
        180: "180ms"
      },
      spacing: {
        "field-icon": "38px"
      },
      width: {
        "menu-icon": "18px"
      },
      minHeight: {
        timeline: "68px"
      },
      maxWidth: {
        "hero-copy": "660px",
        "section-intro": "380px",
        "cta-copy": "620px",
        "footer-copy": "300px"
      }
    }
  }
};
