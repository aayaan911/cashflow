const path = require("path");

// Pin the Tailwind config to this folder: the tailwindcss plugin otherwise looks it up from process.cwd().
module.exports = {
  plugins: { tailwindcss: { config: path.join(__dirname, "tailwind.config.ts") }, autoprefixer: {} }
};
