/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    screens: {
      'sm': '0px',
      'md': '0px',
      'lg': '0px',
      'xl': '0px',
      '2xl': '0px',
    },
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        heading: ['Outfit', 'sans-serif'],
      },
      colors: {
        indigo: { // Tosca
          50: '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
          950: '#042f2e',
        },
        slate: { // Milk (light) & Navy (dark)
          50: '#FDFBF7',
          100: '#F5F0E6',
          200: '#EAE0CD',
          300: '#D4C49F',
          400: '#B8A375',
          500: '#94a3b8',
          600: '#475569',
          700: '#1E293B',
          800: '#0A1128',
          900: '#060B19',
          950: '#03060d',
        },
        purple: { // Metallic Gold
          50: '#FDFBF7',
          100: '#F5F0E6',
          200: '#EAE0CD',
          300: '#D4C49F',
          400: '#C0AF85',
          500: '#B8A375',
          600: '#9A855A',
          700: '#7C6842',
          800: '#5F4D2E',
          900: '#43351C',
          950: '#2A2010',
        },
        emerald: { // Metallic Gold
          50: '#FDFBF7',
          100: '#F5F0E6',
          200: '#EAE0CD',
          300: '#D4C49F',
          400: '#C0AF85',
          500: '#B8A375',
          600: '#9A855A',
          700: '#7C6842',
          800: '#5F4D2E',
          900: '#43351C',
          950: '#2A2010',
        },
        teal: { // Tosca (redirected)
          50: '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
          950: '#042f2e',
        },
        glass: {
          bg: 'rgba(255, 255, 255, 0.6)',
          border: 'rgba(255, 255, 255, 0.2)',
          darkBg: 'rgba(10, 17, 40, 0.6)', // Navy
          darkBorder: 'rgba(253, 251, 247, 0.1)', // Milk
        }
      }
    },
  },
  plugins: [],
}
