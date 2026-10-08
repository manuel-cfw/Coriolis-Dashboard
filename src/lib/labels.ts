// Deutsche Bezeichnungen für die (englisch gespeicherten) Spieldaten der App.

export const ATTRIBUTES = [
  { key: "strength", short: "STÄ", label: "Stärke" },
  { key: "agility", short: "GES", label: "Geschick" },
  { key: "wits", short: "VER", label: "Verstand" },
  { key: "empathy", short: "EMP", label: "Empathie" },
] as const;

type AttributeShort = (typeof ATTRIBUTES)[number]["short"];

export const SKILLS: Array<{ key: string; label: string; attr: AttributeShort; advanced: boolean }> = [
  { key: "Dexterity", label: "Geschicklichkeit", attr: "GES", advanced: false },
  { key: "Force", label: "Kraftakt", attr: "STÄ", advanced: false },
  { key: "Infiltration", label: "Infiltration", attr: "GES", advanced: false },
  { key: "Manipulation", label: "Manipulation", attr: "EMP", advanced: false },
  { key: "Melee Combat", label: "Nahkampf", attr: "STÄ", advanced: false },
  { key: "Observation", label: "Beobachtung", attr: "VER", advanced: false },
  { key: "Ranged Combat", label: "Fernkampf", attr: "GES", advanced: false },
  { key: "Survival", label: "Überleben", attr: "VER", advanced: false },
  { key: "Command", label: "Befehligen", attr: "EMP", advanced: true },
  { key: "Culture", label: "Kultur", attr: "EMP", advanced: true },
  { key: "Data Djinn", label: "Datendschinn", attr: "VER", advanced: true },
  { key: "Medicurgy", label: "Medikurgie", attr: "VER", advanced: true },
  { key: "Mystic Powers", label: "Mystische Kräfte", attr: "EMP", advanced: true },
  { key: "Pilot", label: "Pilot", attr: "GES", advanced: true },
  { key: "Science", label: "Wissenschaft", attr: "VER", advanced: true },
  { key: "Technology", label: "Technologie", attr: "VER", advanced: true },
];

export const RANGE_LABELS: Record<string, string> = {
  "Close": "Nah",
  "Short": "Kurz",
  "Long": "Weit",
  "Extreme": "Extrem",
  "Engaged": "Handgemenge",
};

/** Maximale Strahlung laut Charakterbogen */
export const RADIATION_MAX = 10;
