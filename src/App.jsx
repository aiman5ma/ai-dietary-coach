import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import ApiKeySetup from "./components/ApiKeySetup.jsx";
import Layout from "./components/Layout.jsx";
import { isApiKeyConfigured } from "./api/openai.js";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";
import HistoryProvider from "./context/HistoryProvider.jsx";

import LandingPage from "./pages/LandingPage.jsx";
import NutritionAnalyzer from "./pages/NutritionAnalyzer.jsx";
import BMICalculator from "./pages/BMICalculator.jsx";
import PhotoScanner from "./pages/PhotoScanner.jsx";
import NutritionChat from "./pages/NutritionChat.jsx";
import CalorieTracker from "./pages/CalorieTracker.jsx";

function AppRoutes() {
  const { isAuthed } = useAuth();

  if (!isAuthed) {
    return (
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  return (
    <HistoryProvider>
      <Layout>
        <Routes>
          <Route path="/" element={<NutritionAnalyzer />} />
          <Route path="/bmi" element={<BMICalculator />} />
          <Route path="/scanner" element={<PhotoScanner />} />
          <Route path="/chat" element={<NutritionChat />} />
          <Route path="/tracker" element={<CalorieTracker />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </HistoryProvider>
  );
}

export default function App() {
  // The OpenAI API key is read from import.meta.env at module-load time,
  // so this check is effectively a one-shot guard. If the user adds a key
  // and saves their .env, Vite will reload and re-evaluate this module.
  if (!isApiKeyConfigured()) {
    return <ApiKeySetup />;
  }

  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
