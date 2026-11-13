/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Space Grotesk', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        sage: {
          50: '#F5F7F1',
          100: '#E7ECE0',
          200: '#D0DAC1',
          300: '#B2C19B',
          400: '#9EAD82',
          500: '#8B9A6E',
          600: '#728056',
          700: '#596543',
          800: '#424C32',
          900: '#23281E',
        },
        sand: {
          cream: '#F7F2EB',
          linen: '#EAE2D6',
          mist: '#EEEEEE',
          border: '#D6CCBE',
        },
      },
      keyframes: {
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-ring': {
          '0%': { transform: 'scale(0.85)', opacity: '0.8' },
          '70%': { transform: 'scale(1.9)', opacity: '0' },
          '100%': { transform: 'scale(1.9)', opacity: '0' },
        },
        'aurora-drift': {
          '0%, 100%': { transform: 'translate(0px, 0px) scale(1)' },
          '50%': { transform: 'translate(24px, -18px) scale(1.06)' },
        },
      },
      animation: {
        shimmer: 'shimmer 2.5s infinite',
        'fade-in-up': 'fade-in-up 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'pulse-ring': 'pulse-ring 2s cubic-bezier(0.215, 0.61, 0.355, 1) infinite',
        'aurora-drift': 'aurora-drift 14s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
