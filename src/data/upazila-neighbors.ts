/**
 * Curated undirected upazila/area adjacency for Dhaka metro (geo_hop 1).
 * Rural districts use Sadar-star in SQL. Hop-2 is precomputed from these edges.
 */
import { slugifyUpazilaName } from "./district-neighbors";

/** [nameEnA, nameEnB] — order irrelevant */
export const DHAKA_UPAZILA_NEIGHBOR_PAIRS: [string, string][] = [
  // North / Mirpur belt
  ["Mirpur", "Pallabi"],
  ["Mirpur", "Kafrul"],
  ["Mirpur", "Cantonment"],
  ["Mirpur", "Mohammadpur"],
  ["Mirpur", "Adabor"],
  ["Pallabi", "Turag"],
  ["Pallabi", "Airport"],
  ["Kafrul", "Cantonment"],
  ["Kafrul", "Agargaon"],
  ["Cantonment", "Airport"],
  ["Cantonment", "Banani"],
  ["Cantonment", "Mohakhali"],
  ["Airport", "Uttara"],
  ["Airport", "Dakshinkhan"],
  ["Airport", "Khilkhet"],
  ["Uttara", "Dakshinkhan"],
  ["Uttara", "Turag"],
  ["Uttara", "Khilkhet"],
  ["Dakshinkhan", "Khilkhet"],
  ["Khilkhet", "Badda"],
  ["Khilkhet", "Bashundhara"],
  // Banani / Gulshan / Badda
  ["Banani", "Gulshan"],
  ["Banani", "Mohakhali"],
  ["Banani", "Baridhara"],
  ["Gulshan", "Baridhara"],
  ["Gulshan", "Badda"],
  ["Gulshan", "Mohakhali"],
  ["Baridhara", "Bashundhara"],
  ["Baridhara", "Badda"],
  ["Bashundhara", "Badda"],
  ["Badda", "Rampura"],
  ["Badda", "Hatirjheel"],
  ["Mohakhali", "Tejgaon"],
  ["Mohakhali", "Hatirjheel"],
  // Tejgaon / Farmgate / Panthapath
  ["Tejgaon", "Farmgate"],
  ["Tejgaon", "Agargaon"],
  ["Tejgaon", "Hatirjheel"],
  ["Farmgate", "Panthapath"],
  ["Farmgate", "Kalabagan"],
  ["Farmgate", "Elephant Road"],
  ["Panthapath", "Kalabagan"],
  ["Panthapath", "Dhanmondi"],
  // Dhanmondi / west
  ["Dhanmondi", "Kalabagan"],
  ["Dhanmondi", "Lalmatia"],
  ["Dhanmondi", "Mohammadpur"],
  ["Dhanmondi", "Elephant Road"],
  ["Dhanmondi", "New Market"],
  ["Kalabagan", "Elephant Road"],
  ["Lalmatia", "Mohammadpur"],
  ["Lalmatia", "Adabor"],
  ["Mohammadpur", "Adabor"],
  ["Mohammadpur", "Hazaribagh"],
  ["Adabor", "Hazaribagh"],
  ["New Market", "Azimpur"],
  ["New Market", "Elephant Road"],
  ["New Market", "Lalbagh"],
  ["Azimpur", "Lalbagh"],
  ["Azimpur", "Hazaribagh"],
  // Central / old Dhaka
  ["Shahbag", "New Market"],
  ["Shahbag", "Eskaton"],
  ["Shahbag", "Kakrail"],
  ["Shahbag", "Paltan"],
  ["Eskaton", "Moghbazar"],
  ["Eskaton", "Kakrail"],
  ["Kakrail", "Shantinagar"],
  ["Kakrail", "Paltan"],
  ["Kakrail", "Moghbazar"],
  ["Paltan", "Motijheel"],
  ["Paltan", "Shantinagar"],
  ["Motijheel", "Kotwali"],
  ["Motijheel", "Wari"],
  ["Motijheel", "Bangshal"],
  ["Kotwali", "Bangshal"],
  ["Kotwali", "Sutrapur"],
  ["Kotwali", "Lalbagh"],
  ["Bangshal", "Lalbagh"],
  ["Lalbagh", "Hazaribagh"],
  ["Lalbagh", "Kamrangirchar"],
  ["Wari", "Gendaria"],
  ["Wari", "Sutrapur"],
  ["Gendaria", "Jatrabari"],
  ["Gendaria", "Demra"],
  ["Sutrapur", "Gendaria"],
  // East / Malibagh belt
  ["Malibagh", "Shantinagar"],
  ["Malibagh", "Moghbazar"],
  ["Malibagh", "Rampura"],
  ["Malibagh", "Rajarbagh"],
  ["Shantinagar", "Rajarbagh"],
  ["Shantinagar", "Moghbazar"],
  ["Moghbazar", "Rampura"],
  ["Rampura", "Khilgaon"],
  ["Rampura", "Hatirjheel"],
  ["Khilgaon", "Mugda"],
  ["Khilgaon", "Sabujbagh"],
  ["Mugda", "Sabujbagh"],
  ["Mugda", "Jatrabari"],
  ["Sabujbagh", "Demra"],
  ["Jatrabari", "Demra"],
  ["Hatirjheel", "Rampura"],
  // Sher-e-Bangla / Agargaon
  ["Sher-e-Bangla Nagar", "Agargaon"],
  ["Sher-e-Bangla Nagar", "Mohammadpur"],
  ["Sher-e-Bangla Nagar", "Farmgate"],
  ["Agargaon", "Kafrul"],
  // Rural links into metro
  ["Savar", "Dhamrai"],
  ["Savar", "Keraniganj"],
  ["Savar", "Mohammadpur"],
  ["Keraniganj", "Hazaribagh"],
  ["Keraniganj", "Kamrangirchar"],
  ["Keraniganj", "Dohar"],
  ["Dohar", "Nawabganj"],
  ["Nawabganj", "Dhamrai"],
  ["Dhaka Sadar", "Shahbag"],
  ["Dhaka Sadar", "Motijheel"],
  ["Dhaka Sadar", "Paltan"],
];

/** Normalized slug pairs for Dhaka (a < b lexicographically). */
export function getDhakaUpazilaNeighborSlugPairs(): [string, string][] {
  const seen = new Set<string>();
  const out: [string, string][] = [];
  for (const [a, b] of DHAKA_UPAZILA_NEIGHBOR_PAIRS) {
    const sa = slugifyUpazilaName(a);
    const sb = slugifyUpazilaName(b);
    if (!sa || !sb || sa === sb) continue;
    const lo = sa < sb ? sa : sb;
    const hi = sa < sb ? sb : sa;
    const key = `${lo}::${hi}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push([lo, hi]);
  }
  return out;
}

/**
 * Pure geo_hop calculator for tests / client docs.
 * hopsMap: undirected keys `${districtId}:${loSlug}:${hiSlug}` → 1|2
 * neighborDistricts: Set of "idA::idB" with idA < idB
 */
export function computeGeoHop(opts: {
  viewerDistrictId: string | null;
  viewerSlug: string | null;
  requestDistrictId: string | null;
  requestSlug: string | null;
  upazilaHops: Map<string, number>;
  neighborDistrictKeys: Set<string>;
  preferProximity: boolean;
}): number {
  const {
    viewerDistrictId: vd,
    viewerSlug: vs,
    requestDistrictId: rd,
    requestSlug: rs,
    upazilaHops,
    neighborDistrictKeys,
    preferProximity,
  } = opts;
  if (!preferProximity) return 5;
  if (!vd || !rd) return 5;
  if (vd === rd) {
    if (vs && rs && vs === rs) return 0;
    if (vs && rs) {
      const lo = vs < rs ? vs : rs;
      const hi = vs < rs ? rs : vs;
      const hops = upazilaHops.get(`${vd}:${lo}:${hi}`);
      if (hops === 1) return 1;
      if (hops === 2) return 2;
    }
    return 3;
  }
  const lo = vd < rd ? vd : rd;
  const hi = vd < rd ? rd : vd;
  if (neighborDistrictKeys.has(`${lo}::${hi}`)) return 4;
  return 5;
}
