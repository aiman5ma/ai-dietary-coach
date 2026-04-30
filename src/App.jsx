import { BrowserRouter, Routes, Route } from "react-router-dom";

import ApiKeySetup from "./components/ApiKeySetup.jsx";
import Layout from "./components/Layout.jsx";
import { isApiKeyConfigured } from "./api/openai.js";
import HistoryProvider from "./context/HistoryProvider.jsx";

import NutritionAnalyzer from "./pages/NutritionAnalyzer.jsx";
import BMICalculator from "./pages/BMICalculator.jsx";
import PhotoScanner from "./pages/PhotoScanner.jsx";
import NutritionChat from "./pages/NutritionChat.jsx";

export default function App() {
  // The OpenAI API key is read from import.meta.env at module-load time,
  // so this check is effectively a one-shot guard. If the user adds a key
  // and saves their .env, Vite will reload and re-evaluate this module.
  if (!isApiKeyConfigured()) {
    return <ApiKeySetup />;
  }

  return (
    <BrowserRouter>
      <HistoryProvider>
        <Layout>
          <Routes>
            <Route path="/" element={<NutritionAnalyzer />} />
            <Route path="/bmi" element={<BMICalculator />} />
            <Route path="/scanner" element={<PhotoScanner />} />
            <Route path="/chat" element={<NutritionChat />} />
          </Routes>
        </Layout>
      </HistoryProvider>
    </BrowserRouter>
  );
}
