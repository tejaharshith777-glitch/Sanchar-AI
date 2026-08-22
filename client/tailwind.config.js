/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#00695C',
        secondary: '#F59E0B',
        safety: '#D32F2F',
        success: '#2E7D32',
        background: '#FAFAF7',
        'main-text': '#1F2937',
        'secondary-text': '#64748B'
      }
    },
  },
  plugins: [],
}
