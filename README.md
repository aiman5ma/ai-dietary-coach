# AI Dietary Coach

A modern, AI-powered nutrition coach in the browser. Look up macros for any
food, scan a photo of your plate, calculate your BMI with personalized
guidance, and chat with **Coach Nova** — all from one polished dark-mode app
that calls OpenAI through a server function, so the API key never reaches the browser.

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
| AI               | OpenAI via `/api/ai` (`gpt-4o`, `gpt-4o-mini`) | Server |
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
#    then set OPENAI_API_KEY, SUPABASE_URL, and SUPABASE_ANON_KEY
#    Do not prefix the OpenAI key with VITE_

# 4. Run the dev server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

`npm run dev` serves `POST /api/ai` locally. On Vercel that same file is a
serverless function. The OpenAI key stays in `OPENAI_API_KEY`.

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
│   │   └── openai.js            # Browser calls to /api/ai (analyze, photo, chat, BMI advice)
│   ├── components/
│   │   ├── GuestAiNotice.jsx    # Asks guests to sign in before using AI
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
│   ├── App.jsx                  # Routes + history provider
│   ├── index.css                # Theme tokens, animations, focus glow, btn-press
│   └── main.jsx                 # React entry
├── api/
│   └── ai.js                    # Vercel function: auth, limits, OpenAI proxy
├── .env.example                 # Copy to .env. Server key is not prefixed with VITE_
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
   `ai-dietary-coach`, and copy the value.
3. Put it in `.env` for local development, and in the Vercel project
   environment variables for production:

   ```dotenv
   OPENAI_API_KEY=your_openai_api_key_here
   SUPABASE_URL=https://your-project-ref.supabase.co
   SUPABASE_ANON_KEY=your_supabase_anon_key_here
   ```

4. Stop and restart `npm run dev` — the dev server reads `.env` at startup.

The browser only receives `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
AI requests go to `/api/ai`, which checks the Supabase access token and
then calls OpenAI. Guest mode can browse the app, but AI features ask the
guest to sign in.

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

MIT — do whatever you like with this code. Keep `OPENAI_API_KEY` on the
server. Do not commit a real `.env`.
