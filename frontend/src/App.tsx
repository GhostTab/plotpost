import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/Layout";
import { RequireAuth } from "@/components/RequireAuth";
import { ComposeRecommendationPage } from "@/pages/ComposeRecommendationPage";
import { LandingPage } from "@/pages/LandingPage";
import { LoginPage } from "@/pages/LoginPage";
import { MoviePage } from "@/pages/MoviePage";
import { NotificationsPage } from "@/pages/NotificationsPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { RecommendationsPage } from "@/pages/RecommendationsPage";
import { RegisterPage } from "@/pages/RegisterPage";
import { SearchPage } from "@/pages/SearchPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route element={<AppShell />}>
        <Route path="/search" element={<SearchPage />} />
        <Route path="/movies/:id" element={<MoviePage />} />
        <Route element={<RequireAuth />}>
          <Route path="/users/:username" element={<ProfilePage />} />
          <Route path="/recommendations" element={<RecommendationsPage />} />
          <Route path="/recommendations/new" element={<ComposeRecommendationPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
