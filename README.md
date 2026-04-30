# AI Dietary Coach

A modern, AI-powered nutrition coach in the browser. Look up macros for any
food, scan a photo of your plate, calculate your BMI with personalized
guidance, and chat with **Coach Nova** — all from one polished dark-mode app
that runs entirely on the OpenAI API.

> **Screenshot placeholder** — drop a `docs/screenshot.png` here and replace
> this paragraph with `![AI Dietary Coach](./docs/screenshot.png)`.

---

## Features

1. **Nutrition Analyzer** — type a food and weight, get instant macros, a
   visual macro bar, and an AI insight note. Save items to your food log.
2. **Food Scanner (vision)** — drag-and-drop or snap a photo; GPT-4o
   identifies the food and returns full nutrition info plus a description.
3. **BMI Calculator** — height/weight in cm/ft·in or kg/lbs with a smooth
   animated gauge, category badge, and a personalized 3–4 sentence advice
   paragraph from GPT-4o-mini. Save calculations to your BMI history.
4. **Coach Nova chat** — a conversational AI nutritionist with markdown
   formatting, suggested questions, typing indicator, and full conversation
   memory for the session.

Persistent food log + BMI history live in `localStorage` and surface in a
shared **History** drawer that's accessible from every page.

---

## Tech stack

| Layer            | Tool                              | Version  |
| ---------------- | --------------------------------- | -------- |
| UI framework     | [React](https://react.dev)        | 19.x     |
| Routing          | React Router                      | 7.x      |
| Build tool       | [Vite](https://vitejs.dev)        | 8.x      |
| Styling          | [Tailwind CSS](https://tailwindcss.com) | 4.x  |
| Icons            | [lucide-react](https://lucide.dev) | 1.x     |
| AI               | OpenAI (`gpt-4o`, `gpt-4o-mini`)  | API      |
| Lint             | ESLint + react-hooks + react-refresh | 10.x  |

---

## Setup

```bash
# 1. Clone the repo
git clone <your-fork-url> ai-dietary-coach
cd ai-dietary-coach

# 2. Install dependencies
npm install

# 3. Create your local .env
cp .env.example .env
#    then open .env and paste your OpenAI API key

# 4. Run the dev server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

If `VITE_OPENAI_API_KEY` is missing, the app shows a full-page setup screen
with step-by-step instructions instead of crashing.

### Useful scripts

| Script            | What it does                              |
| ----------------- | ----------------------------------------- |
| `npm run dev`     | Start the Vite dev server with HMR        |
| `npm run build`   | Build a production bundle into `dist/`    |
| `npm run preview` | Preview the production build locally      |
| `npm run lint`    | Run ESLint over the project               |

---

## Folder structure

```
ai-dietary-coach/
├── public/
│   └── favicon.svg              # 🥗 emoji favicon
├── src/
│   ├── api/
│   │   └── openai.js            # All OpenAI API calls (analyze, photo, chat, BMI advice)
│   ├── components/
│   │   ├── ApiKeySetup.jsx      # Full-page screen shown when the API key is missing
│   │   ├── BMIGauge.jsx         # Animated SVG BMI gauge
│   │   ├── ChatMessage.jsx      # User / Coach Nova chat bubble
│   │   ├── FoodCard.jsx         # Nutrition result card (with count-up numbers)
│   │   ├── FoodCardSkeleton.jsx # Pulsing loading placeholder for FoodCard
│   │   ├── HistoryPanel.jsx     # Slide-in drawer showing food log + BMI history
│   │   ├── Layout.jsx           # App shell: navbar, top action bar, history panel
│   │   ├── MacroBar.jsx         # Horizontal protein/carbs/fat bar
│   │   ├── Navbar.jsx           # Desktop sidebar + mobile bottom nav
│   │   └── Toast.jsx            # Top-center slide-down notifications
│   ├── context/
│   │   ├── HistoryProvider.jsx  # Owns food log + BMI history + drawer state
│   │   └── historyContext.js    # Context object + useHistory() hook + storage keys
│   ├── hooks/
│   │   ├── useCountUp.js        # Animated number tween hook (respects reduced-motion)
│   │   └── useLocalStorage.js   # localStorage-backed useState
│   ├── pages/
│   │   ├── BMICalculator.jsx    # /bmi
│   │   ├── NutritionAnalyzer.jsx# /
│   │   ├── NutritionChat.jsx    # /chat
│   │   └── PhotoScanner.jsx     # /scanner
│   ├── utils/
│   │   └── bmi.js               # BMI math, unit conversions, generateId
│   ├── App.jsx                  # Routes + API key guard + history provider
│   ├── index.css                # Theme tokens, animations, focus glow, btn-press
│   └── main.jsx                 # React entry
├── .env.example                 # Copy to .env and add your OpenAI key
├── eslint.config.js
├── index.html
├── package.json
└── vite.config.js
```

---

## Getting an OpenAI API key

1. Go to [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
   and sign in (or create an account).
2. Click **"Create new secret key"**, give it a name like
   `ai-dietary-coach-local`, and copy the value — it starts with `sk-…`.
3. Paste it into your `.env` file:

   ```dotenv
   VITE_OPENAI_API_KEY=sk-...your-key-here...
   ```

4. Stop and restart `npm run dev` — Vite only reads `.env` at startup.

> **Important:** this app calls OpenAI directly from the browser, which
> means the key is bundled into the client. That's perfect for personal
> use and demos. For anything public-facing, proxy requests through a
> server you control so the key never ships to users.

---

## Notes on costs

The app intentionally uses cheap models everywhere it can.

| Feature              | Model           | Why                                       |
| -------------------- | --------------- | ----------------------------------------- |
| Nutrition analyzer   | `gpt-4o-mini`   | Structured JSON, very low cost            |
| BMI advice           | `gpt-4o-mini`   | Short, friendly text                      |
| Chat with Coach Nova | `gpt-4o-mini`   | Multi-turn conversation, low cost         |
| **Photo scanner**    | **`gpt-4o`**    | Needs vision capability — the most costly |

- All four text features cost a fraction of a cent per request.
- The **photo scanner** is the only feature that uses `gpt-4o`. Vision
  requests are noticeably more expensive (typically a few cents per scan
  depending on image size and OpenAI's current pricing).
- Check [OpenAI pricing](https://openai.com/api/pricing) for the latest
  numbers and consider setting a usage cap on your API account.

---

## License

MIT — do whatever you like with this code, but the OpenAI key in your
`.env` is your responsibility.
