/** @type {import('tailwindcss').Config} */
module.exports = {
  prefix: "unsplash-",
  content: ["./index.html", "./src/**/*.{vue,js,ts,jsx,tsx}"],
  theme: {
    extend: {},
  },
  plugins: [require("@tailwindcss/aspect-ratio")],
};
