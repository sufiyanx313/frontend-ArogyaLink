// Hero copy in the three languages the portal serves.
//
// Single source of truth for both the LanguageSelector (which reads LANGUAGES
// for its pill labels) and app/page.tsx (which reads COPY for the hero text).
// Keeping the shape typed as Record<Language, HeroCopy> means adding a language
// is a compile error until every string is translated.

export type Language = "en" | "mr" | "hi";

export const LANGUAGES: { code: Language; label: string; name: string }[] = [
  { code: "en", label: "EN", name: "English" },
  { code: "mr", label: "मराठी", name: "Marathi" },
  { code: "hi", label: "हिंदी", name: "Hindi" },
];

export interface HeroCopy {
  /** Small caps line in the header */
  govLine: string;
  /** Department line in the header */
  deptLine: string;
  /** Floating status pill above the 3D wordmark */
  statusPill: string;
  /** Official portal subtitle below the 3D wordmark */
  subtitle: string;
  /** The three feature badges, in order */
  badges: [string, string, string];
  /** Scroll affordance at the bottom of the hero */
  scrollHint: string;
}

export const HERO_COPY: Record<Language, HeroCopy> = {
  en: {
    govLine: "Government of Maharashtra",
    deptLine: "PUBLIC HEALTH DEPARTMENT • आरोग्य विभाग",
    statusPill: "Live State Health Network",
    subtitle:
      "Maharashtra's Unified AI-Powered OPD Queue, Doctor Availability & Emergency Telemedicine Gateway",
    badges: [
      "Real-Time OPD Slots",
      "Empaneled Facility Network",
      "24x7 Emergency SOS",
    ],
    scrollHint: "Scroll down to explore services",
  },
  mr: {
    govLine: "महाराष्ट्र शासन",
    deptLine: "सार्वजनिक आरोग्य विभाग • PUBLIC HEALTH DEPARTMENT",
    statusPill: "थेट राज्य आरोग्य नेटवर्क",
    subtitle:
      "महाराष्ट्राचे एकत्रित एआय-आधारित ओपीडी रांग, डॉक्टर उपलब्धता आणि आपत्कालीन टेलिमेडिसिन प्रवेशद्वार",
    badges: [
      "थेट ओपीडी स्लॉट",
      "संलग्न रुग्णालय नेटवर्क",
      "२४x७ आपत्कालीन एसओएस",
    ],
    scrollHint: "सेवा पाहण्यासाठी खाली स्क्रोल करा",
  },
  hi: {
    govLine: "महाराष्ट्र शासन",
    deptLine: "सार्वजनिक स्वास्थ्य विभाग • PUBLIC HEALTH DEPARTMENT",
    statusPill: "लाइव राज्य स्वास्थ्य नेटवर्क",
    subtitle:
      "महाराष्ट्र का एकीकृत एआई-संचालित ओपीडी क्यू, डॉक्टर उपलब्धता एवं आपातकालीन टेलीमेडिसिन गेटवे",
    badges: [
      "रियल-टाइम ओपीडी स्लॉट",
      "संलग्न अस्पताल नेटवर्क",
      "24x7 आपातकालीन एसओएस",
    ],
    scrollHint: "सेवाएं देखने के लिए नीचे स्क्रॉल करें",
  },
};
