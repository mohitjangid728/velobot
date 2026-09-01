/** @type {import('tailwindcss').Config} */
export default {
  // Shadow DOM has no ancestor to inherit resets from, and Tailwind's
  // preflight is designed for a normal document — so it's disabled and a
  // minimal, self-contained reset lives in src/styles.css instead.
  corePlugins: { preflight: false },
  content: ["./src/**/*.ts"],
  // Prefixed so nothing here can ever collide with the host page's own
  // classes, even though Shadow DOM already isolates style application.
  prefix: "vb-",
  // No host page can see inside the Shadow DOM, so there's nothing to
  // namespace against — Tailwind's normal utility classes are safe as-is.
  theme: {
    extend: {
      colors: {
        "vb-primary": "var(--vb-primary)",
      },
      keyframes: {
        "vb-fade-in": { from: { opacity: "0", transform: "translateY(8px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        "vb-panel-in": {
          from: { opacity: "0", transform: "translateY(12px) scale(0.96)" },
          to: { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        "vb-launcher-in": {
          from: { opacity: "0", transform: "scale(0.5)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        "vb-fade-in": "vb-fade-in 150ms ease-out",
        "vb-panel-in": "vb-panel-in 200ms cubic-bezier(0.16, 1, 0.3, 1)",
        "vb-launcher-in": "vb-launcher-in 250ms cubic-bezier(0.34, 1.56, 0.64, 1)",
      },
    },
  },
  plugins: [],
};
