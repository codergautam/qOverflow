/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./*/*.ejs', ],
  theme: {
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
