/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./*/*.ejs','./*/*.css','./*/*.js'],
  theme: {

    extend: {    screens: {

      'sm': '360px',
      // => @media (min-width: 640px) { ... }

      'md': '400px',
      // => @media (min-width: 768px) { ... }

      'lg': '1024px',
      // => @media (min-width: 1024px) { ... }

      'xl': '1280px',
      // => @media (min-width: 1280px) { ... }

      '2xl': '1536px'
      // => @media (min-width: 1536px) { ... }
    }},
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
  plugins: [    
    require('@tailwindcss/line-clamp'),
],
}

