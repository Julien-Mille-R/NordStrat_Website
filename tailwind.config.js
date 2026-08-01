/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./views/**/*.ejs",
    "./public/**/*.js"
  ],
  theme: {
    extend: {
      colors: {
        // Palette Fantasy Dark
        fantasy: {
          darkest: '#0a0806',
          darker: '#1a1511',
          dark: '#2d2520',
          brown: '#3d2f28',
          'brown-light': '#4a3930',
          gold: '#d4a574',
          'gold-light': '#e6c89c',
          'gold-dark': '#b8905f',
          orange: '#ff9f43',
          'orange-light': '#ffb366',
          'orange-dark': '#e68a2e',
          red: '#c9302c',
          'red-dark': '#a02622',
          emerald: '#2ecc71',
          'emerald-dark': '#27ae60',
          purple: '#8e44ad',
          'purple-dark': '#6c3483',
        },
        // Couleurs d'accent
        accent: {
          primary: '#d4a574',
          secondary: '#ff9f43',
          danger: '#c9302c',
          success: '#2ecc71',
          info: '#3498db',
        }
      },
      fontFamily: {
        // Polices système natives (aucun téléchargement)
        'fantasy': ['Georgia', 'Garamond', 'serif'],
        'medieval': ['"Times New Roman"', 'Times', 'serif'],
        'body': ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        'sans': ['system-ui', '-apple-system', 'sans-serif'],
        },
            backgroundImage: {
        'parchment': "url('/images/textures/parchment.jpg')",
        'wood': "url('/images/textures/wood.jpg')",
        'stone': "url('/images/textures/stone.jpg')",
        'gradient-gold': 'linear-gradient(135deg, #d4a574 0%, #b8905f 100%)',
        'gradient-dark': 'linear-gradient(180deg, rgba(10,8,6,0) 0%, rgba(10,8,6,0.9) 100%)',
      },
      boxShadow: {
        'glow-gold': '0 0 20px rgba(212, 165, 116, 0.5)',
        'glow-orange': '0 0 20px rgba(255, 159, 67, 0.5)',
        'inner-dark': 'inset 0 2px 8px rgba(0, 0, 0, 0.6)',
        'fantasy': '0 10px 30px rgba(0, 0, 0, 0.8)',
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'float': 'float 3s ease-in-out infinite',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 20px rgba(212, 165, 116, 0.3)' },
          '50%': { boxShadow: '0 0 30px rgba(212, 165, 116, 0.6)' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        }
      },
      borderWidth: {
        '3': '3px',
      }
    },
  },
  plugins: [],
}