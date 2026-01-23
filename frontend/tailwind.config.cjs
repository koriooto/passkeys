/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./popup.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: "#1F1F24",
        panel: "#2A2A31",
        accent: "#2E90FA"
      }
    }
  },
  plugins: []
};
