import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        brand: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#60B768',
          500: '#60B768',  // Основной цвет #60B768
          600: '#4fa058',
          700: '#3f8948',
          800: '#2f7238',
          900: '#1f5b28',
        },
      },
    },
  },
  plugins: [],
};
export default config;


