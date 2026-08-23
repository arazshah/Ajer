import type { Config } from "tailwindcss";
export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: { colors: { brick: "#C65D35", ink: "#172033", cream: "#F7F4EF" } },
  },
  plugins: [],
} satisfies Config;
