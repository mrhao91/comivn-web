/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: 'var(--color-primary)', 
        secondary: 'var(--color-secondary)',
        dark: 'var(--color-dark)', 
        darker: 'var(--color-darker)',
        card: 'var(--color-card)',
      },
      fontFamily: {
        sans: ['var(--font-family)', 'ui-sans-serif', 'system-ui'],
      }
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
