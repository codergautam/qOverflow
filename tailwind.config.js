/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./*/*.ejs', ],
  theme: {
    extend: {},
    display: ['group-hover'],
    fontFamily: {
      'staat': ['Staatliches', 'cursive'],
      'bebas': ['Bebas Neue', 'cursive'],
      'oswald': ['Oswald', 'sans-serif']
    }
  },
  plugins: [],
}
