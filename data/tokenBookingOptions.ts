/**
 * Single source of truth for the OPD Token Booking wizard options.
 *
 * These lists used to live inside `TokenBookingModal.tsx`. They were extracted
 * so that the voice agent (`useVoiceTokenBooking`) and the visual wizard match
 * against exactly the same data — otherwise the two drift apart and the agent
 * "selects" values the modal cannot render.
 *
 * Every option carries:
 *   - `label`   what the UI renders (bilingual, unchanged from the original UI)
 *   - `spoken`  a short, clean form for text-to-speech prompts
 *   - `aliases` recognition keys in BOTH Latin and Devanagari script
 *
 * The Devanagari aliases matter because `SpeechRecognition.lang = "hi-IN"`
 * transcribes Hindi/Marathi speech in Devanagari — a user saying "Pune"
 * arrives as "पुणे", never as "Pune".
 */

export interface DistrictInfo {
  id: string;
  label: string;
  spoken: string;
  aliases: string[];
}

export interface HospitalInfo {
  id: string;
  districtId: string;
  name: string;
  spoken: string;
  aliases: string[];
}

export interface DepartmentInfo {
  /** Kept short — feeds the token code prefix, e.g. `MH-ORT-31`. */
  id: string;
  name: string;
  marathi: string;
  counter: string;
  room: string;
  spoken: string;
  aliases: string[];
}

export interface SymptomInfo {
  id: string;
  label: string;
  spoken: string;
  aliases: string[];
}

export const DISTRICTS: DistrictInfo[] = [
  {
    id: "PUNE",
    label: "Pune (पुणे)",
    spoken: "Pune",
    aliases: ["pune", "puna", "poona", "पुणे", "पुना", "पूणे", "पुण"],
  },
  {
    id: "MUMBAI",
    label: "Mumbai Suburban (मुंबई उपनगर)",
    spoken: "Mumbai",
    aliases: [
      "mumbai",
      "bombay",
      "mumbai suburban",
      "suburban",
      "मुंबई",
      "मुम्बई",
      "बॉम्बे",
      "उपनगर",
    ],
  },
  {
    id: "NAGPUR",
    label: "Nagpur (नागपूर)",
    spoken: "Nagpur",
    aliases: ["nagpur", "nagpoor", "नागपूर", "नागपुर"],
  },
  {
    id: "NASHIK",
    label: "Nashik (नाशिक)",
    spoken: "Nashik",
    aliases: ["nashik", "nasik", "nashique", "नाशिक", "नासिक"],
  },
  {
    id: "SAMBHAJINAGAR",
    label: "Chhatrapati Sambhajinagar (छ. संभाजीनगर)",
    spoken: "Chhatrapati Sambhajinagar",
    aliases: [
      "sambhajinagar",
      "chhatrapati sambhajinagar",
      "sambhaji nagar",
      "aurangabad",
      "संभाजीनगर",
      "छत्रपती संभाजीनगर",
      "छत्रपति संभाजीनगर",
      "संभाजी नगर",
      "औरंगाबाद",
    ],
  },
  {
    id: "THANE",
    label: "Thane (ठाणे)",
    spoken: "Thane",
    aliases: ["thane", "tane", "thana", "ठाणे", "थाने", "ठाण"],
  },
];

/**
 * Hospitals are keyed by district **id**, not by the bilingual display label.
 *
 * The previous implementation keyed this map by label and had a typo —
 * `"Nashik (नाशIC)"` instead of `"Nashik (नाशिक)"` — so picking Nashik silently
 * rendered an empty hospital list. Keying on a stable id removes that whole
 * class of bug.
 */
export const HOSPITALS: HospitalInfo[] = [
  // ---- Pune ----
  {
    id: "SASSOON",
    districtId: "PUNE",
    name: "Sassoon General Hospital & BJMC",
    spoken: "Sassoon General Hospital",
    aliases: [
      "sassoon",
      "sasoon",
      "sason",
      "bjmc",
      "b j medical",
      "ससून",
      "ससुन",
      "बीजेएमसी",
    ],
  },
  {
    id: "AUNDH",
    districtId: "PUNE",
    name: "Aundh District Civil Hospital",
    spoken: "Aundh District Civil Hospital",
    aliases: ["aundh", "aund", "औंध", "अौंध"],
  },
  {
    id: "YCM",
    districtId: "PUNE",
    name: "YCM Hospital & Medical College",
    spoken: "Y C M Hospital",
    aliases: [
      "ycm",
      "y c m",
      "yashwantrao",
      "yashwantrao chavan",
      "pcmc",
      "pimpri",
      "वायसीएम",
      "यशवंतराव",
      "पिंपरी",
    ],
  },

  // ---- Mumbai Suburban ----
  {
    id: "KEM",
    districtId: "MUMBAI",
    name: "KEM Hospital & Seth GS Medical College",
    spoken: "K E M Hospital, Parel",
    aliases: [
      "kem",
      "k e m",
      "seth gs",
      "seth g s",
      "parel",
      "केईएम",
      "के ई एम",
      "परेल",
    ],
  },
  {
    id: "SION",
    districtId: "MUMBAI",
    name: "Lokmanya Tilak Municipal General Hospital (Sion)",
    spoken: "Sion Hospital",
    aliases: [
      "sion",
      "shion",
      "lokmanya",
      "lokmanya tilak",
      "tilak",
      "ltmg",
      "सायन",
      "शीव",
      "लोकमान्य",
      "टिळक",
      "तिलक",
    ],
  },
  {
    id: "COOPER",
    districtId: "MUMBAI",
    name: "Cooper Hospital & HBT Medical College",
    spoken: "Cooper Hospital, Juhu",
    aliases: ["cooper", "kuper", "hbt", "juhu", "कूपर", "एचबीटी", "जुहू"],
  },

  // ---- Nagpur ----
  {
    id: "GMCH_NAGPUR",
    districtId: "NAGPUR",
    name: "Government Medical College & Hospital (GMCH)",
    spoken: "Government Medical College, Nagpur",
    aliases: [
      "gmch",
      "g m c h",
      "government medical",
      "medical college",
      "जीएमसीएच",
      "शासकीय वैद्यकीय",
      "मेडिकल कॉलेज",
    ],
  },
  {
    id: "MAYO",
    districtId: "NAGPUR",
    name: "Indira Gandhi GMC (Mayo Hospital)",
    spoken: "Mayo Hospital",
    aliases: [
      "mayo",
      "maayo",
      "indira gandhi",
      "igmc",
      "मेयो",
      "मायो",
      "इंदिरा गांधी",
    ],
  },

  // ---- Nashik ----
  {
    id: "NASHIK_CIVIL",
    districtId: "NASHIK",
    name: "Nashik District Civil Hospital",
    spoken: "Nashik District Civil Hospital",
    aliases: [
      "nashik civil",
      "civil",
      "district civil",
      "civil hospital",
      "सिविल",
      "जिल्हा रुग्णालय",
      "सिव्हिल",
    ],
  },
  {
    id: "MALEGAON",
    districtId: "NASHIK",
    name: "General Hospital Malegaon",
    spoken: "General Hospital Malegaon",
    aliases: ["malegaon", "malegav", "मालेगाव", "मालेगांव"],
  },

  // ---- Chhatrapati Sambhajinagar ----
  {
    id: "GHATI",
    districtId: "SAMBHAJINAGAR",
    name: "Government Medical College & Hospital (Ghati)",
    spoken: "Ghati Hospital",
    aliases: [
      "ghati",
      "gati",
      "government medical",
      "medical college",
      "घाटी",
      "शासकीय वैद्यकीय",
    ],
  },
  {
    id: "SAMBHAJINAGAR_CIVIL",
    districtId: "SAMBHAJINAGAR",
    name: "District Civil Hospital Chh. Sambhajinagar",
    spoken: "District Civil Hospital",
    aliases: [
      "civil",
      "district civil",
      "civil hospital",
      "सिविल",
      "जिल्हा",
      "सिव्हिल",
    ],
  },

  // ---- Thane ----
  {
    id: "THANE_CIVIL",
    districtId: "THANE",
    name: "Thane District Civil Hospital",
    spoken: "Thane District Civil Hospital",
    aliases: [
      "thane civil",
      "civil",
      "district civil",
      "civil hospital",
      "सिविल",
      "जिल्हा रुग्णालय",
      "सिव्हिल",
    ],
  },
  {
    id: "KALWA",
    districtId: "THANE",
    name: "Chhatrapati Shivaji Maharaj Hospital Kalwa",
    spoken: "Kalwa Hospital",
    aliases: [
      "kalwa",
      "kalva",
      "shivaji maharaj",
      "shivaji",
      "कळवा",
      "कलवा",
      "छत्रपती शिवाजी",
      "शिवाजी महाराज",
    ],
  },
];

export const DEPARTMENTS: DepartmentInfo[] = [
  {
    id: "MED",
    name: "General Medicine",
    marathi: "सामान्य औषधोपचार",
    counter: "Desk 02",
    room: "Room 14",
    spoken: "General Medicine",
    aliases: [
      "general medicine",
      "medicine",
      "general",
      "physician",
      "medical",
      "सामान्य",
      "औषधोपचार",
      "औषध",
      "फिजिशियन",
      "जनरल",
      "दवा",
    ],
  },
  {
    id: "PED",
    name: "Pediatrics (Child OPD)",
    marathi: "बालरोग विभाग",
    counter: "Desk 05",
    room: "Room 08",
    spoken: "Pediatrics, the child O P D",
    aliases: [
      "pediatrics",
      "paediatrics",
      "pediatric",
      "child",
      "children",
      "kids",
      "baby",
      "bacha",
      "baccha",
      "बालरोग",
      "बच्चा",
      "बच्चे",
      "बच्चों",
      "मूल",
      "लहान",
    ],
  },
  {
    id: "ORT",
    name: "Orthopedics",
    marathi: "अस्थिरोग विभाग",
    counter: "Desk 09",
    room: "Room 22",
    spoken: "Orthopedics",
    aliases: [
      "orthopedics",
      "orthopaedics",
      "orthopedic",
      "ortho",
      "bone",
      "joint",
      "fracture",
      "haddi",
      "अस्थिरोग",
      "हड्डी",
      "हाड",
      "ऑर्थो",
      "जोड़",
      "फ्रैक्चर",
    ],
  },
  {
    id: "GYN",
    name: "Gynecology & Obstetrics",
    marathi: "स्त्रीरोग व प्रसूती",
    counter: "Desk 03",
    room: "Room 11",
    spoken: "Gynecology and Obstetrics",
    aliases: [
      "gynecology",
      "gynaecology",
      "gynec",
      "gyno",
      "obstetrics",
      "pregnancy",
      "maternity",
      "delivery",
      "स्त्रीरोग",
      "प्रसूती",
      "गर्भ",
      "गर्भवती",
      "महिला",
      "प्रेग्नेंसी",
    ],
  },
  {
    id: "ENT",
    name: "ENT & Ophthalmology",
    marathi: "कान-नाक-घसा व नेत्ररोग",
    counter: "Desk 07",
    room: "Room 18",
    spoken: "E N T and Eye department",
    aliases: [
      "ent",
      "e n t",
      "ear nose throat",
      "ear",
      "nose",
      "throat",
      "eye",
      "ophthalmology",
      "opthalmology",
      "vision",
      "कान",
      "नाक",
      "गला",
      "घसा",
      "आंख",
      "आँख",
      "नेत्र",
      "डोळा",
    ],
  },
];

export const SYMPTOMS: SymptomInfo[] = [
  {
    id: "FEVER",
    label: "Fever / ताप & Chills",
    spoken: "Fever",
    aliases: [
      "fever",
      "temperature",
      "chills",
      "bukhar",
      "taap",
      "बुखार",
      "ताप",
      "ठंड",
      "थंडी",
      "तापमान",
    ],
  },
  {
    id: "HEADACHE",
    label: "Severe Headache / डोकेदुखी",
    spoken: "Severe headache",
    aliases: [
      "headache",
      "head ache",
      "head pain",
      "migraine",
      "sir dard",
      "sardard",
      "सिरदर्द",
      "सिर दर्द",
      "डोकेदुखी",
      "डोके",
      "माइग्रेन",
    ],
  },
  {
    id: "COUGH_COLD",
    label: "Cough & Cold / खोकला व सर्दी",
    spoken: "Cough and cold",
    aliases: [
      "cough",
      "cold",
      "khansi",
      "sardi",
      "zukam",
      "jukam",
      "sneezing",
      "खांसी",
      "सर्दी",
      "जुकाम",
      "खोकला",
      "शिंका",
    ],
  },
  {
    id: "BODY_ACHE",
    label: "Joint & Body Ache / अंगदुखी",
    spoken: "Joint and body ache",
    aliases: [
      "body ache",
      "bodyache",
      "joint pain",
      "body pain",
      "back pain",
      "badan dard",
      "kamar dard",
      "अंगदुखी",
      "बदन दर्द",
      "अंग दुखी",
      "जोड़ों",
      "कमर",
      "अंगदु",
    ],
  },
  {
    id: "STOMACH",
    label: "Stomach Pain / पोटदुखी",
    spoken: "Stomach pain",
    aliases: [
      "stomach",
      "stomach pain",
      "abdominal",
      "pet dard",
      "acidity",
      "gas",
      "vomiting",
      "पेट",
      "पेट दर्द",
      "पोटदुखी",
      "पोट",
      "उलटी",
      "गैस",
    ],
  },
  {
    id: "CHECKUP",
    label: "Routine Health Checkup / नियमित तपासणी",
    spoken: "Routine health checkup",
    aliases: [
      "checkup",
      "check up",
      "routine",
      "routine checkup",
      "health checkup",
      "jaanch",
      "normal",
      "तपासणी",
      "जांच",
      "नियमित",
      "चेकअप",
      "तपास",
    ],
  },
];

/** Hospitals belonging to one district, in display order. */
export function getHospitalsForDistrict(
  districtId: string | null,
): HospitalInfo[] {
  if (!districtId) return [];
  return HOSPITALS.filter((hospital) => hospital.districtId === districtId);
}

export function findDistrictById(id: string | null): DistrictInfo | null {
  if (!id) return null;
  return DISTRICTS.find((district) => district.id === id) ?? null;
}

export function findHospitalById(id: string | null): HospitalInfo | null {
  if (!id) return null;
  return HOSPITALS.find((hospital) => hospital.id === id) ?? null;
}

export function findDepartmentById(id: string | null): DepartmentInfo | null {
  if (!id) return null;
  return DEPARTMENTS.find((department) => department.id === id) ?? null;
}

export function findSymptomById(id: string | null): SymptomInfo | null {
  if (!id) return null;
  return SYMPTOMS.find((symptom) => symptom.id === id) ?? null;
}
