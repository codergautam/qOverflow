/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./*/*.ejs', ],
  theme: {
    extend: {},
    display: ['group-hover'],
    fontFamily: {
      'helvet': ['Helvetica', 'sans-serif'],
      'dosis': ['Dosis', 'sans-serif'],
      'abril': ['Abril Fatface', 'cursive'],
      'edu': ['Edu SA Beginner', 'cursive'],
      'arvo': ['Arvo', 'serif'],
      'staat': ['Staatliches', 'cursive'],
      'bebas': ['Bebas Neue', 'cursive'],
      'oswald': ['Oswald', 'sans-serif']
    }
  },
  plugins: [],
}
