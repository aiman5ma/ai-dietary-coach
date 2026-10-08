import { Loader2 } from "lucide-react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import ApiKeySetup from "./components/ApiKeySetup.jsx";
import Layout from "./components/Layout.jsx";
import { isApiKeyConfigured } from "./api/openai.js";
import { useAuth } from "./context/AuthContext.jsx";
import { useLanguage } from "./context/LanguageContext.jsx";
import HistoryProvider from "./context/HistoryProvider.jsx";

import LandingPage from "./pages/LandingPage.jsx";
import NutritionAnalyzer from "./pages/NutritionAnalyzer.jsx";
import BMICalculator from "./pages/BMICalculator.jsx";
import PhotoScanner from "./pages/PhotoScanner.jsx";
import NutritionChat from "./pages/NutritionChat.jsx";
import CalorieTracker from "./pages/CalorieTracker.jsx";
import ProfilePage from "./pages/ProfilePage.jsx";

function AuthLoading() {
  const { t } = useLanguage();
  return (
    <div className="grid min-h-dvh place-items-center bg-[var(--bg-primary)] text-[var(--text-secondary)] dark:bg-[#0d1117] dark:text-[#f0f6fc]">
      <Loader2
        className="h-8 w-8 animate-spin text-[var(--accent-green)]"
        aria-label={t("common.loading")}
      />
    </div>
  );
}

function AppRoutes() {
  const { user, isGuest, loading } = useAuth();

  if (loading) {
    return <AuthLoading />;
  }

  if (!user && !isGuest) {
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
          <Route path="/profile" element={<ProfilePage />} />
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
      <AppRoutes />
    </BrowserRouter>
  );
}
