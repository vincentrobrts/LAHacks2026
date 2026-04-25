import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      boxShadow: {
        glow: "0 24px 80px rgba(15, 23, 42, 0.18)"
      }
    }
  },
  plugins: []
};

export default config;
