/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./*/*.ejs', ],
  theme: {
    screens: {
      // 'sm': '475px',
      // // => @media (min-width: 640px) { ... }

      // 'md': '630px',
      // // => @media (min-width: 1024px) { ... }

      // 'lg': '700px'
    },
    extend: {},
    display: ['group-hover'],
    fontFamily: {
      'helvet': ['Helvetica', 'sans-serif'],
      'dosis': ['Dosis', 'sans-serif'],
      'arvo': ['Arvo', 'serif'],
      'staat': ['Staatliches', 'cursive'],
      'bebas': ['Bebas Neue', 'cursive'],
      'oswald': ['Oswald', 'sans-serif']
    }
  },
  plugins: [],
}
