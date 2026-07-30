/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        heading: ['Outfit', 'sans-serif'],
      },
      colors: {
        glass: {
          bg: 'rgba(255, 255, 255, 0.6)',
          border: 'rgba(255, 255, 255, 0.2)',
          darkBg: 'rgba(0, 0, 0, 0.6)',
          darkBorder: 'rgba(255, 255, 255, 0.1)',
        }
      }
    },
  },
  plugins: [],
}
