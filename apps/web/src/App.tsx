import { Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Layout } from "./components/Layout";
import { LoginPage } from "./pages/Login";
import { DashboardPage } from "./pages/Dashboard";
import { CompetitionDetailPage } from "./pages/CompetitionDetail";
import { CompetitionNewPage } from "./pages/CompetitionNew";
import { CandidatesPage } from "./pages/Candidates";
import { CandidateFormPage } from "./pages/CandidateForm";
import { JudgesPage } from "./pages/Judges";
import { SettingsPage } from "./pages/Settings";
import { ResultsPage } from "./pages/Results";

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/competitions/new" element={<CompetitionNewPage />} />
        <Route path="/competitions/:id" element={<CompetitionDetailPage />} />
        <Route path="/candidates" element={<CandidatesPage />} />
        <Route path="/candidates/new" element={<CandidateFormPage />} />
        <Route path="/candidates/:id/edit" element={<CandidateFormPage />} />
        <Route path="/judges" element={<JudgesPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/results" element={<ResultsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
