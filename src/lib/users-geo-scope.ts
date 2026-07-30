export type UsersGeoScope = {
  /** "all" = every district; otherwise list of district UUIDs */
  districts: "all" | string[];
  /** "all" = every upazila; otherwise "districtId::name_bn" keys */
  upazilas: "all" | string[];
};

export const DEFAULT_USERS_GEO_SCOPE: UsersGeoScope = {
  districts: "all",
  upazilas: "all",
};

export function upazilaScopeKey(districtId: string, upazilaName: string) {
  return `${districtId}::${upazilaName.trim()}`;
}

export function parseUpazilaScopeKey(key: string): { districtId: string; name: string } | null {
  const i = key.indexOf("::");
  if (i <= 0) return null;
  return { districtId: key.slice(0, i), name: key.slice(i + 2) };
}

export function normalizeUsersGeoScope(raw: unknown): UsersGeoScope {
  const r = (raw && typeof raw === "object" ? raw : {}) as {
    districts?: unknown;
    upazilas?: unknown;
  };

  let districts: UsersGeoScope["districts"] = "all";
  if (r.districts === "all" || r.districts == null) {
    districts = "all";
  } else if (Array.isArray(r.districts)) {
    const ids = r.districts.map(String).filter(Boolean);
    districts = ids.length === 0 ? "all" : ids;
  }

  let upazilas: UsersGeoScope["upazilas"] = "all";
  if (r.upazilas === "all" || r.upazilas == null) {
    upazilas = "all";
  } else if (Array.isArray(r.upazilas)) {
    const keys = r.upazilas.map(String).filter(Boolean);
    upazilas = keys.length === 0 ? "all" : keys;
  }

  return { districts, upazilas };
}

export function isAllDistricts(scope: UsersGeoScope) {
  return scope.districts === "all";
}

export function isAllUpazilas(scope: UsersGeoScope) {
  return scope.upazilas === "all";
}

export function districtAllowed(scope: UsersGeoScope, districtId: string | null | undefined) {
  if (isAllDistricts(scope)) return true;
  if (!districtId) return false;
  return scope.districts.includes(districtId);
}

export function upazilaAllowed(
  scope: UsersGeoScope,
  districtId: string | null | undefined,
  upazilaName: string | null | undefined,
) {
  if (isAllUpazilas(scope)) return true;
  if (!districtId || !upazilaName?.trim()) return false;
  return scope.upazilas.includes(upazilaScopeKey(districtId, upazilaName));
}
