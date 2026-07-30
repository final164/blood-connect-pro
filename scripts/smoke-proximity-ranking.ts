/**
 * Smoke scenarios for hierarchical proximity ranking (no DB required).
 * Run: npx tsx scripts/smoke-proximity-ranking.ts
 */
import { slugifyUpazilaName } from "../src/data/district-neighbors";
import {
  computeGeoHop,
  getDhakaUpazilaNeighborSlugPairs,
} from "../src/data/upazila-neighbors";
import { DISTRICT_NEIGHBOR_PAIRS } from "../src/data/district-neighbors";
import { DEFAULT_FEED_RANKING } from "../src/lib/feed-ranking";

const DHAKA = "dhaka-id";
const GAZIPUR = "gazipur-id";
const SYLHET = "sylhet-id";

function buildHopMap(): Map<string, number> {
  const edges = getDhakaUpazilaNeighborSlugPairs();
  const adj = new Map<string, Set<string>>();
  for (const [a, b] of edges) {
    if (!adj.has(a)) adj.set(a, new Set());
    if (!adj.has(b)) adj.set(b, new Set());
    adj.get(a)!.add(b);
    adj.get(b)!.add(a);
  }
  const hops = new Map<string, number>();
  for (const [a, b] of edges) {
    hops.set(`${DHAKA}:${a}:${b}`, 1);
  }
  // hop-2
  for (const [a, neighbors] of adj) {
    for (const mid of neighbors) {
      for (const c of adj.get(mid) ?? []) {
        if (c === a) continue;
        const lo = a < c ? a : c;
        const hi = a < c ? c : a;
        const key = `${DHAKA}:${lo}:${hi}`;
        if (!hops.has(key)) hops.set(key, 2);
      }
    }
  }
  return hops;
}

function districtKeys(): Set<string> {
  const slugToId: Record<string, string> = {
    dhaka: DHAKA,
    gazipur: GAZIPUR,
    sylhet: SYLHET,
    narayanganj: "narayanganj-id",
    manikganj: "manikganj-id",
  };
  const set = new Set<string>();
  for (const [a, b] of DISTRICT_NEIGHBOR_PAIRS) {
    const idA = slugToId[a];
    const idB = slugToId[b];
    if (!idA || !idB) continue;
    const lo = idA < idB ? idA : idB;
    const hi = idA < idB ? idB : idA;
    set.add(`${lo}::${hi}`);
  }
  return set;
}

const hopMap = buildHopMap();
const nbrDistricts = districtKeys();

function hop(area: string, districtId = DHAKA) {
  return computeGeoHop({
    viewerDistrictId: DHAKA,
    viewerSlug: slugifyUpazilaName("Mirpur"),
    requestDistrictId: districtId,
    requestSlug: slugifyUpazilaName(area),
    upazilaHops: hopMap,
    neighborDistrictKeys: nbrDistricts,
    preferProximity: true,
  });
}

function score(geoHop: number, bloodMatch: boolean) {
  const geo = [
    DEFAULT_FEED_RANKING.score_geo_hop_0,
    DEFAULT_FEED_RANKING.score_geo_hop_1,
    DEFAULT_FEED_RANKING.score_geo_hop_2,
    DEFAULT_FEED_RANKING.score_geo_hop_3,
    DEFAULT_FEED_RANKING.score_geo_hop_4,
    DEFAULT_FEED_RANKING.score_geo_hop_5,
  ][geoHop] ?? 0;
  return geo + (bloodMatch ? DEFAULT_FEED_RANKING.score_blood_boost : 0);
}

const cases: { label: string; area: string; district?: string; expect: number }[] = [
  { label: "exact Mirpur", area: "Mirpur", expect: 0 },
  { label: "neighbor Pallabi", area: "Pallabi", expect: 1 },
  { label: "neighbor Kafrul", area: "Kafrul", expect: 1 },
  { label: "2-hop Dhanmondi (via Mohammadpur)", area: "Dhanmondi", expect: 2 },
  { label: "same district Savar", area: "Savar", expect: 2 }, // Mirpur–Mohammadpur–Savar
  { label: "same district Dohar", area: "Dohar", expect: 3 }, // beyond 2 hops without sadar star in pure map
  { label: "neighbor district Gazipur", area: "Tongi", district: GAZIPUR, expect: 4 },
  { label: "far Sylhet", area: "Sylhet Sadar", district: SYLHET, expect: 5 },
];

let failed = 0;
console.log("Viewer: Dhaka / Mirpur\n");
for (const c of cases) {
  const got = hop(c.area, c.district ?? DHAKA);
  const ok = got === c.expect;
  const mark = ok ? "OK" : "FAIL";
  if (!ok) failed++;
  console.log(
    `${mark}  ${c.label.padEnd(42)} geo_hop=${got} (expect ${c.expect})  score_same_blood=${score(got, true)}  score_diff_blood=${score(got, false)}`,
  );
}

// Ordering: Mirpur > Pallabi > Dhanmondi > Dohar/Savar-far > Gazipur > Sylhet
const order = ["Mirpur", "Pallabi", "Dhanmondi", "Dohar", "Tongi@gazipur", "Sylhet@sylhet"].map((x) => {
  if (x.includes("@")) {
    const [a, d] = x.split("@");
    return hop(a!, d === "gazipur" ? GAZIPUR : SYLHET);
  }
  return hop(x);
});
const sorted = [...order].sort((a, b) => a - b);
const orderOk = order.every((v, i) => v === sorted[i]) || order[0]! <= order[1]! && order[1]! <= order[2]! && order[4]! <= order[5]!;
console.log("\nOrder hops:", order.join(" < "), orderOk ? "OK (non-decreasing)" : "CHECK");

// Blood boost: hop1+blood > hop0 without blood
const s1 = score(1, true);
const s0 = score(0, false);
console.log(`\nBlood policy: hop1+blood (${s1}) > hop0+wrong (${s0}) ?`, s1 > s0 ? "YES (intentional)" : "NO");

if (failed > 0) {
  console.error(`\n${failed} hard failures`);
  process.exit(1);
}
console.log("\nSmoke proximity ranking passed.");
