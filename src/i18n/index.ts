import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import vi from './locales/vi.json';

i18n.use(initReactI18next).init({
    resources: {
        en: { translation: en },
        vi: { translation: vi },
    },
    lng: localStorage.getItem('app-language') || 'en',
    fallbackLng: 'en',
    interpolation: {
        escapeValue: false, // React already escapes
    },
});

export default i18n;
