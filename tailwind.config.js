/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "node_modules/flowbite-react/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      spacing: {
        128: "32rem",
      },
      gridTemplateColumns: {
        envlist: "20rem minmax(0, 1fr) 3rem",
      },
    },
  },
  plugins: [require("flowbite/plugin")],
};
