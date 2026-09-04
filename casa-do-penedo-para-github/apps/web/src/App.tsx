import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AdminPage from "./pages/AdminPage";
import BookingPage from "./pages/BookingPage";
import { AdminGate } from "./components/AdminGate";
import { PwaHead } from "./components/PwaHead";
import { LanguageProvider } from "./i18n/LanguageContext";

export default function App() {
  return (
    <LanguageProvider>
      <BrowserRouter>
        <PwaHead />
        <Routes>
          <Route path="/" element={<Navigate to="/reservar" replace />} />
          <Route path="/reservar" element={<BookingPage />} />
          <Route
            path="/gestao"
            element={
              <AdminGate>
                <AdminPage />
              </AdminGate>
            }
          />
          <Route path="*" element={<Navigate to="/reservar" replace />} />
        </Routes>
      </BrowserRouter>
    </LanguageProvider>
  );
}
