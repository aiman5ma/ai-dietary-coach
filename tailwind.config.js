import plugin from "tailwindcss/plugin";

/**
 * Loaded by Tailwind v4 through `@config` in src/index.css.
 *
 * `hoverOnlyWhenSupported` limits hover styles to devices that actually
 * hover. The rtl/ltr variants use the `[dir]` selector strategy, so
 * `rtl:` utilities follow the direction LanguageProvider sets on <html>.
 */
export default {
  darkMode: "class",
  future: {
    hoverOnlyWhenSupported: true,
  },
  plugins: [
    plugin(({ addVariant }) => {
      addVariant("dark", "&:where(.dark, .dark *)");
      addVariant("rtl", "&:where([dir='rtl'], [dir='rtl'] *)");
      addVariant("ltr", "&:where([dir='ltr'], [dir='ltr'] *)");
    }),
  ],
};
