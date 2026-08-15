/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        space: {
          900: '#050817',
          800: '#0a0e27',
          700: '#11163d',
          600: '#1a2150',
        },
        neon: {
          pink: '#ff2a6d',
          cyan: '#05d9e8',
          purple: '#b026ff',
          yellow: '#f7ff58',
        },
        glass: {
          DEFAULT: 'rgba(17, 22, 61, 0.72)',
          light: 'rgba(255, 255, 255, 0.08)',
          border: 'rgba(255, 255, 255, 0.12)',
        }
      },
      fontFamily: {
        pixel: ['"Press Start 2P"', 'cursive', 'monospace'],
        mono: ['"Fira Code"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'pulse-glow': 'pulse-glow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'twinkle': 'twinkle 3s ease-in-out infinite',
        'bob-slow': 'bob-slow 3s ease-in-out infinite',
        'wobble': 'wobble 0.5s ease-in-out',
        'slide-in-right': 'slide-in-right 0.3s ease-out',
        'shake': 'shake 0.3s ease-in-out',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-12px)' },
        },
        'pulse-glow': {
          '0%, 100%': { opacity: '1', boxShadow: '0 0 12px rgba(255, 42, 109, 0.4)' },
          '50%': { opacity: '.85', boxShadow: '0 0 24px rgba(5, 217, 232, 0.6)' },
        },
        twinkle: {
          '0%, 100%': { opacity: '0.3', transform: 'scale(0.8)' },
          '50%': { opacity: '1', transform: 'scale(1.2)' },
        },
        'bob-slow': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        'wobble': {
          '0%, 100%': { transform: 'rotate(0deg)' },
          '25%': { transform: 'rotate(-12deg)' },
          '75%': { transform: 'rotate(12deg)' },
        },
        'slide-in-right': {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        'shake': {
          '0%, 100%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(-4px)' },
          '50%': { transform: 'translateX(4px)' },
          '75%': { transform: 'translateX(-4px)' },
        },
      },
      boxShadow: {
        'neon': '0 0 12px rgba(255, 42, 109, 0.5), 0 0 24px rgba(5, 217, 232, 0.25)',
        'neon-pink': '0 0 12px rgba(255, 42, 109, 0.6)',
        'neon-cyan': '0 0 12px rgba(5, 217, 232, 0.6)',
      }
    },
  },
  plugins: [],
}
