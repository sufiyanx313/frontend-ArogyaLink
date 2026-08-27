/**
 * Single source of truth for the Bed Availability, Doctor Availability and
 * Appointment wizards — the counterpart to `data/tokenBookingOptions.ts`.
 *
 * Districts and hospitals are *not* redefined here. Every service reuses
 * `DISTRICTS` / `HOSPITALS` from `tokenBookingOptions`, because the three modals
 * previously each carried their own label-keyed copy of the same lists and they
 * had already drifted apart (one of them keyed hospitals by a display label
 * containing a typo, which silently rendered an empty list). One roster, matched
 * by both the voice agent and the visual wizard, removes that class of bug.
 *
 * As in `tokenBookingOptions`, every option carries `spoken` (a clean form for
 * text-to-speech) and `aliases` in **both Latin and Devanagari**, since
 * `SpeechRecognition.lang = "hi-IN"` returns Devanagari for Hindi/Marathi
 * speech — a user asking for the ICU may arrive as "आयसीयू", never as "ICU".
 */

/* ------------------------------------------------------------------ */
/* Deterministic pseudo-random numbers                                */
/* ------------------------------------------------------------------ */

/**
 * FNV-1a, used to derive stable per-hospital figures.
 *
 * Bed counts must be *deterministic*: `Math.random()` would hand back different
 * occupancy on every render, and any figure the agent just read aloud would no
 * longer match the grid on screen. Hashing the ids means the same hospital always
 * reports the same numbers while different hospitals still look different.
 */
function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  // `>>> 0` forces an unsigned 32-bit result.
  return hash >>> 0;
}

/** A stable integer in `[min, max]` derived from `seed`. */
function seededInt(seed: string, min: number, max: number): number {
  if (max <= min) return min;
  return min + (hashString(seed) % (max - min + 1));
}

/* ------------------------------------------------------------------ */
/* Ward categories (Bed Availability)                                 */
/* ------------------------------------------------------------------ */

export interface WardCategoryInfo {
  id: string;
  name: string;
  marathi: string;
  spoken: string;
  aliases: string[];
  /** Nominal sanctioned strength; the per-hospital figure varies around it. */
  baseTotal: number;
  /** Plausible vacancy band, as a percentage of total. */
  minVacantPct: number;
  maxVacantPct: number;
}

export const WARD_CATEGORIES: WardCategoryInfo[] = [
  {
    id: "icu",
    name: "ICU / Ventilator",
    marathi: "तीव्र दक्षता विभाग",
    spoken: "I C U and ventilator",
    aliases: [
      "icu",
      "i c u",
      "intensive care",
      "critical care",
      "ventilator",
      "venti",
      "आयसीयू",
      "आईसीयू",
      "अतिदक्षता",
      "तीव्र दक्षता",
      "व्हेंटिलेटर",
      "वेंटिलेटर",
    ],
    baseTotal: 48,
    minVacantPct: 5,
    maxVacantPct: 20,
  },
  {
    id: "oxygen",
    name: "Oxygen Supported",
    marathi: "प्राणवायू बेड",
    spoken: "oxygen supported",
    aliases: [
      "oxygen",
      "oxigen",
      "o2",
      "oxygen bed",
      "ऑक्सिजन",
      "ऑक्सीजन",
      "प्राणवायू",
      "प्राणवायु",
    ],
    baseTotal: 120,
    minVacantPct: 15,
    maxVacantPct: 35,
  },
  {
    id: "general",
    name: "General Ward",
    marathi: "सामान्य वॉर्ड",
    spoken: "general ward",
    aliases: [
      "general",
      "general ward",
      "normal bed",
      "normal ward",
      "sadharan",
      "सामान्य",
      "साधारण",
      "जनरल",
      "वॉर्ड",
      "वार्ड",
    ],
    baseTotal: 250,
    minVacantPct: 20,
    maxVacantPct: 40,
  },
  {
    id: "emergency",
    name: "Emergency Trauma",
    marathi: "आपत्कालीन विभाग",
    spoken: "emergency and trauma",
    aliases: [
      "emergency",
      "trauma",
      "casualty",
      "accident",
      "emergency ward",
      "आपत्कालीन",
      "आकस्मिक",
      "अपघात",
      "इमरजेंसी",
      "ट्रॉमा",
    ],
    baseTotal: 30,
    minVacantPct: 8,
    maxVacantPct: 25,
  },
];

export interface WardAvailability {
  ward: WardCategoryInfo;
  total: number;
  available: number;
  occupied: number;
}

/**
 * Live-looking bed figures for one hospital.
 *
 * Deterministic in `hospitalId`, so the number the agent speaks is the number the
 * dashboard renders, on this render and every later one.
 */
export function getWardAvailability(hospitalId: string | null): WardAvailability[] {
  if (!hospitalId) return [];

  return WARD_CATEGORIES.map((ward) => {
    const total = ward.baseTotal + seededInt(`${hospitalId}:${ward.id}:total`, -6, 10);
    const vacantPct = seededInt(
      `${hospitalId}:${ward.id}:vacancy`,
      ward.minVacantPct,
      ward.maxVacantPct,
    );
    // At least one free bed, so the demo never shows a fully blocked hospital.
    const available = Math.max(1, Math.round((total * vacantPct) / 100));
    return { ward, total, available, occupied: total - available };
  });
}

export function findWardById(id: string | null): WardCategoryInfo | null {
  if (!id) return null;
  return WARD_CATEGORIES.find((ward) => ward.id === id) ?? null;
}

/**
 * Vacancy flags for the ward floor plan — `true` means the bed is free.
 *
 * The proportion of free beds tracks the same vacancy rate as the summary card,
 * so the grid and the headline figure tell the same story.
 */
export function getBedGrid(
  hospitalId: string | null,
  wardId: string,
  size = 16,
): boolean[] {
  if (!hospitalId) return new Array<boolean>(size).fill(false);

  const summary = getWardAvailability(hospitalId).find(
    (entry) => entry.ward.id === wardId,
  );
  if (!summary) return new Array<boolean>(size).fill(false);

  const vacantCount = Math.max(
    1,
    Math.min(size - 1, Math.round((summary.available / summary.total) * size)),
  );

  // Spread the vacant beds out by walking a hash-derived stride, so the grid
  // looks scattered rather than showing a block of free beds at one end.
  const flags = new Array<boolean>(size).fill(false);
  const stride = 1 + (hashString(`${hospitalId}:${wardId}:stride`) % (size - 1));
  let cursor = hashString(`${hospitalId}:${wardId}:offset`) % size;

  for (let placed = 0; placed < vacantCount; placed += 1) {
    // Step forward past beds already marked vacant.
    let guard = 0;
    while (flags[cursor] && guard < size) {
      cursor = (cursor + 1) % size;
      guard += 1;
    }
    flags[cursor] = true;
    cursor = (cursor + stride) % size;
  }

  return flags;
}

/* ------------------------------------------------------------------ */
/* Specialist departments (Doctor Availability filter pills)          */
/* ------------------------------------------------------------------ */

export interface SpecialistDepartmentInfo {
  /** Short code, also used as the filter pill label. */
  id: string;
  name: string;
  marathi: string;
  spoken: string;
  aliases: string[];
}

/**
 * The doctor roster spans one specialty the OPD token flow does not offer
 * (Cardiology), so this list is a superset of `DEPARTMENTS` rather than a
 * reference to it. Ids are kept identical where they overlap.
 */
export const SPECIALIST_DEPARTMENTS: SpecialistDepartmentInfo[] = [
  {
    id: "MED",
    name: "General Medicine",
    marathi: "सामान्य औषधोपचार",
    spoken: "General Medicine",
    aliases: ["general medicine", "medicine", "physician", "medical", "जनरल", "औषधोपचार", "फिजिशियन"],
  },
  {
    id: "PED",
    name: "Pediatrics",
    marathi: "बालरोग विभाग",
    spoken: "Pediatrics",
    aliases: ["pediatrics", "paediatrics", "child", "children", "kids", "bacha", "बालरोग", "बच्चा", "लहान"],
  },
  {
    id: "ORT",
    name: "Orthopedics",
    marathi: "अस्थिरोग विभाग",
    spoken: "Orthopedics",
    aliases: ["orthopedics", "ortho", "bone", "joint", "fracture", "haddi", "अस्थिरोग", "हाड", "हड्डी"],
  },
  {
    id: "GYN",
    name: "Gynecology",
    marathi: "स्त्रीरोग विभाग",
    spoken: "Gynecology",
    aliases: ["gynecology", "gynaecology", "gynec", "pregnancy", "maternity", "स्त्रीरोग", "प्रसूती", "गर्भवती"],
  },
  {
    id: "CARD",
    name: "Cardiology",
    marathi: "हृदयरोग विभाग",
    spoken: "Cardiology",
    aliases: ["cardiology", "cardiac", "heart", "dil", "hriday", "हृदयरोग", "हृदय", "दिल", "कार्डियो"],
  },
];

export function findSpecialistDepartmentById(
  id: string | null,
): SpecialistDepartmentInfo | null {
  if (!id) return null;
  return SPECIALIST_DEPARTMENTS.find((department) => department.id === id) ?? null;
}

/* ------------------------------------------------------------------ */
/* Doctor roster (Doctor Availability + Appointment)                  */
/* ------------------------------------------------------------------ */

/** Duty state shown on the roster board. */
export type DoctorStatus = "ON_DUTY_OPD" | "WARD_ROUND" | "IN_OT" | "OTHER_HOSPITAL";

export interface DoctorInfo {
  id: string;
  name: string;
  /** Without the honorific — TTS already says "Doctor". */
  spoken: string;
  marathiName: string;
  qualifications: string;
  departmentId: string;
  /** Full department name as printed on the roster card. */
  deptName: string;
  room: string;
  experience: string;
  status: DoctorStatus;
  /** Where the attendance beacon last placed them. */
  currentLocation: string;
  /** What they are doing right now. */
  servingState: string;
  shift: string;
  estimatedWait: string;
  aliases: string[];
}

/**
 * One roster, shared by both doctor-facing services.
 *
 * The two modals previously carried separate copies with different field names
 * and, for two doctors, different duty statuses — so the same specialist could be
 * "in OT" on one screen and bookable on the other. The figures below are the
 * roster the Doctor Availability screen was already showing; the appointment
 * picker now reads from it too.
 *
 * Aliases list surname *and* first name separately, because callers say "Dr
 * Kulkarni" far more often than the full name, and hi-IN returns the Devanagari
 * spelling either way.
 */
export const DOCTORS: DoctorInfo[] = [
  {
    id: "doc-1",
    name: "Dr. Rajeshwar Kulkarni",
    spoken: "Rajeshwar Kulkarni",
    marathiName: "डॉ. राजेश्वर कुलकर्णी",
    qualifications: "MBBS, MD (General Medicine)",
    departmentId: "MED",
    deptName: "General Medicine",
    room: "Room 14",
    experience: "14+ Yrs Exp",
    status: "ON_DUTY_OPD",
    currentLocation: "OPD Room 14 (Desk 02)",
    servingState: "Attending Patient #24",
    shift: "08:30 AM - 02:30 PM",
    estimatedWait: "~10 Mins",
    aliases: ["kulkarni", "rajeshwar", "rajeshwar kulkarni", "कुलकर्णी", "राजेश्वर"],
  },
  {
    id: "doc-2",
    name: "Dr. Ananya Deshmukh",
    spoken: "Ananya Deshmukh",
    marathiName: "डॉ. अनन्या देशमुख",
    qualifications: "MBBS, MS (Orthopedics), M.Ch",
    departmentId: "ORT",
    deptName: "Orthopedics & Trauma",
    room: "Room 22",
    experience: "11+ Yrs Exp",
    status: "WARD_ROUND",
    currentLocation: "ICU Ward 3 & Post-Op Recovery",
    servingState: "Round in progress (Back to OPD at 11:45 AM)",
    shift: "09:00 AM - 03:00 PM",
    estimatedWait: "~25 Mins",
    aliases: ["deshmukh", "ananya", "ananya deshmukh", "देशमुख", "अनन्या"],
  },
  {
    id: "doc-3",
    name: "Dr. Sanjay Patil",
    spoken: "Sanjay Patil",
    marathiName: "डॉ. संजय पाटील",
    qualifications: "MBBS, DCH, MD (Pediatrics)",
    departmentId: "PED",
    deptName: "Pediatrics (Child Care)",
    room: "Room 08",
    experience: "16+ Yrs Exp",
    status: "IN_OT",
    currentLocation: "Emergency OT Block - Floor 2",
    servingState: "Emergency Neonatal Procedure",
    shift: "09:00 AM - 02:00 PM",
    estimatedWait: "Post 01:30 PM",
    aliases: ["patil", "sanjay", "sanjay patil", "पाटील", "पाटिल", "संजय"],
  },
  {
    id: "doc-4",
    name: "Dr. Shalini Shinde",
    spoken: "Shalini Shinde",
    marathiName: "डॉ. शालिनी शिंदे",
    qualifications: "MBBS, DGO, MD (Obstetrics & Gynae)",
    departmentId: "GYN",
    deptName: "Gynecology & Maternity",
    room: "Room 11",
    experience: "18+ Yrs Exp",
    status: "ON_DUTY_OPD",
    currentLocation: "OPD Room 11 (Desk 03)",
    servingState: "Attending Patient #18",
    shift: "08:00 AM - 02:00 PM",
    estimatedWait: "~15 Mins",
    aliases: ["shinde", "shalini", "shalini shinde", "शिंदे", "शालिनी"],
  },
  {
    id: "doc-5",
    name: "Dr. Milind Wagh",
    spoken: "Milind Wagh",
    marathiName: "डॉ. मिलिंद वाघ",
    qualifications: "MBBS, MD, DM (Cardiology)",
    departmentId: "CARD",
    deptName: "Cardiology & Cardiac Care",
    room: "Room 31",
    experience: "20+ Yrs Exp",
    // Deputed elsewhere today — the roster says so, and `getBookableDoctors`
    // filters this doctor out rather than offering a slot nobody can honour.
    status: "OTHER_HOSPITAL",
    currentLocation: "Aundh District Civil Hospital (Deputed)",
    servingState: "On Weekly Cross-Hospital Specialist Visit",
    shift: "Visiting Schedule: Wed / Fri",
    estimatedWait: "Available here Tomorrow 09:00 AM",
    aliases: ["wagh", "milind", "milind wagh", "वाघ", "मिलिंद"],
  },
];

/** Doctors who can be given an appointment slot today. */
export function getBookableDoctors(): DoctorInfo[] {
  return DOCTORS.filter((doctor) => doctor.status !== "OTHER_HOSPITAL");
}

export function findDoctorById(id: string | null): DoctorInfo | null {
  if (!id) return null;
  return DOCTORS.find((doctor) => doctor.id === id) ?? null;
}

/** Human-readable duty status, for the roster board and for TTS. */
export const DOCTOR_STATUS_LABEL: Record<DoctorStatus, { en: string; marathi: string }> = {
  ON_DUTY_OPD: { en: "On duty • OPD", marathi: "ओपीडीत उपस्थित" },
  WARD_ROUND: { en: "On ward round", marathi: "वॉर्ड राउंडवर" },
  IN_OT: { en: "In operation theatre", marathi: "शस्त्रक्रिया गृहात" },
  OTHER_HOSPITAL: { en: "Deputed elsewhere", marathi: "अन्य रुग्णालयात" },
};

/* ------------------------------------------------------------------ */
/* Appointment dates and slots                                        */
/* ------------------------------------------------------------------ */

export interface AppointmentDateInfo {
  id: string;
  label: string;
  spoken: string;
  /** Days from today, for rendering the actual calendar date. */
  offsetDays: number;
  aliases: string[];
}

export const APPOINTMENT_DATES: AppointmentDateInfo[] = [
  {
    id: "D1",
    label: "Tomorrow (उद्या)",
    spoken: "tomorrow",
    offsetDays: 1,
    aliases: ["tomorrow", "kal", "kaal", "next day", "उद्या", "कल", "उद्याला"],
  },
  {
    id: "D2",
    label: "Day After (परवा)",
    spoken: "the day after tomorrow",
    offsetDays: 2,
    aliases: ["day after", "day after tomorrow", "parso", "parva", "परवा", "परसों"],
  },
  {
    id: "D3",
    label: "In 3 Days",
    spoken: "in three days",
    offsetDays: 3,
    aliases: ["in 3 days", "3 days", "three days", "teen din", "तीन दिवस", "तीन दिन"],
  },
];

export interface AppointmentSlotInfo {
  id: string;
  label: string;
  spoken: string;
  period: "morning" | "afternoon";
  aliases: string[];
}

/**
 * Slot aliases include the bare "9 30" form on purpose: `normalizeTranscript`
 * turns punctuation into spaces, so "9:30" and "9.30" both arrive as "9 30" and
 * hit the multi-word phrase branch of the matcher.
 */
export const APPOINTMENT_SLOTS: AppointmentSlotInfo[] = [
  {
    id: "S1",
    label: "09:30 AM",
    spoken: "nine thirty in the morning",
    period: "morning",
    aliases: ["9 30", "930", "nine thirty", "nau tees", "साढ़े नौ", "नऊ तीस", "नौ तीस"],
  },
  {
    id: "S2",
    label: "10:15 AM",
    spoken: "ten fifteen in the morning",
    period: "morning",
    aliases: ["10 15", "1015", "ten fifteen", "das pandrah", "सव्वा दहा", "दस पंद्रह", "दहा पंधरा"],
  },
  {
    id: "S3",
    label: "11:00 AM",
    spoken: "eleven o clock in the morning",
    period: "morning",
    aliases: ["11 00", "11", "eleven", "eleven o clock", "gyarah", "अकरा", "ग्यारह"],
  },
  {
    id: "S4",
    label: "11:45 AM",
    spoken: "eleven forty five in the morning",
    period: "morning",
    aliases: ["11 45", "1145", "eleven forty five", "gyarah pentalis", "पावणे बारा", "ग्यारह पैंतालीस"],
  },
  {
    id: "S5",
    label: "01:30 PM",
    spoken: "one thirty in the afternoon",
    period: "afternoon",
    aliases: ["1 30", "130", "one thirty", "ek tees", "दीड", "साढ़े एक", "एक तीस"],
  },
  {
    id: "S6",
    label: "02:15 PM",
    spoken: "two fifteen in the afternoon",
    period: "afternoon",
    aliases: ["2 15", "215", "two fifteen", "do pandrah", "सव्वा दोन", "दो पंद्रह"],
  },
  {
    id: "S7",
    label: "03:00 PM",
    spoken: "three o clock in the afternoon",
    period: "afternoon",
    aliases: ["3 00", "three", "three o clock", "teen baje", "तीन", "तीन वाजता"],
  },
];

/** Period words, so "koi bhi morning slot" resolves without naming a time. */
const MORNING_WORDS = ["morning", "subah", "savere", "सकाळ", "सकाळी", "सुबह", "सवेरे"];
const AFTERNOON_WORDS = ["afternoon", "dopahar", "dupari", "evening", "दुपार", "दुपारी", "दोपहर", "शाम"];

/**
 * Resolves a bare period word to the first slot of that half-day.
 * Returns `null` when the utterance names no period.
 */
export function matchSlotPeriod(tokens: readonly string[]): AppointmentSlotInfo | null {
  const hasMorning = MORNING_WORDS.some((word) => tokens.includes(word));
  const hasAfternoon = AFTERNOON_WORDS.some((word) => tokens.includes(word));

  // Both mentioned: too ambiguous to guess.
  if (hasMorning === hasAfternoon) return null;

  const period = hasMorning ? "morning" : "afternoon";
  return APPOINTMENT_SLOTS.find((slot) => slot.period === period) ?? null;
}

export function findAppointmentDateById(id: string | null): AppointmentDateInfo | null {
  if (!id) return null;
  return APPOINTMENT_DATES.find((date) => date.id === id) ?? null;
}

export function findAppointmentSlotById(id: string | null): AppointmentSlotInfo | null {
  if (!id) return null;
  return APPOINTMENT_SLOTS.find((slot) => slot.id === id) ?? null;
}

/** Formats an appointment date pill as a real calendar date. */
export function formatAppointmentDate(offsetDays: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}
