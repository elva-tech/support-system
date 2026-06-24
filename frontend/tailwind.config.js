/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{html,ts}"],
  theme: {
    extend: {
      colors: {
        elva: {
          50: "#f4f6f9",
          100: "#e8ecf2",
          200: "#c5d0de",
          300: "#9aadc4",
          400: "#6b86a8",
          500: "#4a6789",
          600: "#354f6e",
          700: "#243a56",
          800: "#1a2b4c",
          900: "#13294b",
          950: "#0c1a30",
          brand: "#13294b"
        }
      }
    }
  },
  plugins: []
};
