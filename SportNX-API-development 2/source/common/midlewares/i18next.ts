import i18next from "i18next";
import Backend from "i18next-node-fs-backend";
import i18nextMiddleware from "i18next-http-middleware";
import path from "path";

// Extend Express Request interface to include t function
declare global {
  namespace Express {
    interface Request {
      t: (key: string, options?: any) => string;
    }
  }
}

const localesPath = path.join(__dirname, "../../locales/{{lng}}/{{ns}}.json");

// Using i18next for localization.
i18next
  .use(Backend)
  .use(i18nextMiddleware.LanguageDetector)
  .init({
    backend: {
      loadPath: localesPath,
    },
    fallbackLng: "en",
    preload: ["en", "es"],
  });

export default i18next;
