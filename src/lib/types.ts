// Ausschnitt der Datentypen der Coriolis-App, soweit das Dashboard sie nutzt.

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface GroupListEntry {
  id: string;
  name: string;
  user_role: "gm" | "player";
  member_count: number;
}

export interface GroupMember {
  id: string;
  role: "gm" | "player";
  crew_role: string | null;
  user_id: string;
  name: string;
}

export interface GroupCharacter {
  id: string;
  name: string;
  concept: string | null;
  user_id: string | null;
  profile_image_id: string | null;
  owner_name: string | null;
}

export interface GroupDetail {
  group: {
    id: string;
    name: string;
    group_concept: string | null;
    patron: string | null;
    nemesis: string | null;
    gm_user_id: string | null;
  };
  members: GroupMember[];
  characters: GroupCharacter[];
  userRole: "gm" | "player";
  darknessPoints: number;
}

export interface Ship {
  id: string;
  name: string | null;
  ship_type: string | null;
  hull_points: number | null;
  hull_points_current: number | null;
  energy_points: number | null;
  energy_points_current: number | null;
}

export interface TalentSlot {
  id: string;
  name: string;
  category: string;
  description: string;
}

export interface WeaponSlot {
  id: string;
  name: string;
  bonus: string;
  init: number;
  damage: string;
  crit: string;
  range: string;
  features: string[];
}

export interface ArmorSlot {
  id: string;
  name: string;
  armor_rating: number;
  features: string[];
}

export interface GearSlot {
  id: string;
  name: string;
  quantity: number;
}

export interface CriticalInjurySlot {
  id: string;
  name: string;
  effect: string;
  lethal: boolean;
  healing_time: string;
}

export interface Character {
  id: string;
  name: string;
  concept: string | null;
  sub_concept: string | null;
  origin: string | null;
  icon: string | null;
  crew_position: string | null;
  strength: number;
  agility: number;
  wits: number;
  empathy: number;
  hp_current: number;
  hp_max: number;
  mp_current: number;
  mp_max: number;
  radiation: number;
  reputation: number;
  birr: number;
  experience: number;
  skills: Record<string, number> | null;
  talents: TalentSlot[] | null;
  weapons: WeaponSlot[] | null;
  armor: ArmorSlot | null;
  gear: GearSlot[] | null;
  critical_injuries: CriticalInjurySlot[] | null;
  personal_problem: string | null;
  user_id: string | null;
  group_id: string | null;
  profile_image_id: string | null;
  updated_at: string;
  _permissions?: { canEdit: boolean; canDelete: boolean; isGM: boolean };
}
