import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom"; // Import BrowserRouter
import App from "./App";
import "./index.css";
import i18n from "i18next";
import { I18nextProvider } from "react-i18next";
import { initReactI18next } from "react-i18next";

// Initialize i18n for language translations
i18n.use(initReactI18next).init({
  resources: {
    en: {
      translation: {
        "Create Post": "Create Post",
      },
    },
    ur: {
      translation: {
        "Create Post": "پوسٹ تخلیق کریں",
      },
    },
  },
  lng: "en", // default language
  fallbackLng: "en",
  interpolation: {
    escapeValue: false,
  },
});

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <I18nextProvider i18n={i18n}>
    {/* Wrap the App component with BrowserRouter */}
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </I18nextProvider>
);
