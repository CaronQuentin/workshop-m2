/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eff5ff", 100: "#dbe8fe", 200: "#bfd6fe", 300: "#93b8fd",
          400: "#6093fa", 500: "#3b6ef5", 600: "#2551ea", 700: "#1d3fd7",
          800: "#1e3aae", 900: "#1e3689", 950: "#172354",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
    },
  },
  plugins: [],
};
