import { useEffect, useMemo, useState } from "react";
import { fetchAllDistrictsAdmin, type District } from "@/lib/api";
import { fetchUpazilaOptions } from "@/lib/upazilas";
import {
  DEFAULT_USERS_GEO_SCOPE,
  normalizeUsersGeoScope,
  upazilaScopeKey,
  type UsersGeoScope,
} from "@/lib/users-geo-scope";

const sel =
  "w-full rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-100 outline-none focus:ring-1 focus:ring-rose-500/40";

export function UsersGeoScopeEditor({
  value,
  onChange,
  lang,
  disabled,
}: {
  value: unknown;
  onChange: (next: UsersGeoScope) => void;
  lang: "bn" | "en";
  disabled?: boolean;
}) {
  const scope = normalizeUsersGeoScope(value ?? DEFAULT_USERS_GEO_SCOPE);
  const [districts, setDistricts] = useState<District[]>([]);
  const [upazilasByDistrict, setUpazilasByDistrict] = useState<Record<string, string[]>>({});
  const [focusDistrict, setFocusDistrict] = useState<string>("");

  useEffect(() => {
    fetchAllDistrictsAdmin().then(setDistricts);
  }, []);

  const allowedDistrictIds = useMemo(() => {
    if (scope.districts === "all") return districts.map((d) => d.id);
    return scope.districts;
  }, [scope.districts, districts]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ids = allowedDistrictIds.slice(0, 80);
      const next: Record<string, string[]> = { ...upazilasByDistrict };
      for (const id of ids) {
        if (next[id]) continue;
        const d = districts.find((x) => x.id === id);
        if (!d) continue;
        const opts = await fetchUpazilaOptions(d);
        next[id] = opts.map((o) => o.name_bn);
      }
      if (!cancelled) setUpazilasByDistrict(next);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowedDistrictIds.join(","), districts]);

  useEffect(() => {
    if (!focusDistrict && allowedDistrictIds[0]) setFocusDistrict(allowedDistrictIds[0]!);
  }, [allowedDistrictIds, focusDistrict]);

  function setDistrictsAll() {
    onChange({ ...scope, districts: "all", upazilas: scope.upazilas === "all" ? "all" : scope.upazilas });
  }

  function toggleDistrict(id: string) {
    if (scope.districts === "all") {
      // Switch from all → only this one unchecked means all-minus-one; start with all others
      const rest = districts.map((d) => d.id).filter((x) => x !== id);
      onChange({
        districts: rest.length ? rest : [],
        upazilas:
          scope.upazilas === "all"
            ? "all"
            : scope.upazilas.filter((k) => !k.startsWith(`${id}::`)),
      });
      return;
    }
    const has = scope.districts.includes(id);
    const next = has ? scope.districts.filter((x) => x !== id) : [...scope.districts, id];
    if (next.length === 0 || next.length === districts.length) {
      onChange({
        districts: "all",
        upazilas: has
          ? scope.upazilas === "all"
            ? "all"
            : scope.upazilas.filter((k) => !k.startsWith(`${id}::`))
          : scope.upazilas,
      });
      return;
    }
    onChange({
      districts: next,
      upazilas:
        scope.upazilas === "all"
          ? "all"
          : has
            ? scope.upazilas.filter((k) => !k.startsWith(`${id}::`))
            : scope.upazilas,
    });
  }

  function setUpazilasAll() {
    onChange({ ...scope, upazilas: "all" });
  }

  function toggleUpazila(districtId: string, name: string) {
    const key = upazilaScopeKey(districtId, name);
    if (scope.upazilas === "all") {
      // Leaving "all": keep all current visible except this one
      const keys: string[] = [];
      for (const did of allowedDistrictIds) {
        for (const u of upazilasByDistrict[did] ?? []) {
          const k = upazilaScopeKey(did, u);
          if (k !== key) keys.push(k);
        }
      }
      onChange({ ...scope, upazilas: keys });
      return;
    }
    const has = scope.upazilas.includes(key);
    const next = has ? scope.upazilas.filter((x) => x !== key) : [...scope.upazilas, key];
    onChange({ ...scope, upazilas: next.length === 0 ? "all" : next });
  }

  const districtIsChecked = (id: string) =>
    scope.districts === "all" || scope.districts.includes(id);

  const upazilaIsChecked = (districtId: string, name: string) =>
    scope.upazilas === "all" || scope.upazilas.includes(upazilaScopeKey(districtId, name));

  return (
    <div className="rounded-lg border border-rose-500/20 bg-slate-950/50 p-3 space-y-3">
      <div>
        <p className="text-xs font-semibold text-rose-200">
          {lang === "bn" ? "ইউজার ফিল্টার — জেলা / উপজেলা স্কোপ" : "Users filter — district / upazila scope"}
        </p>
        <p className="text-[10px] text-slate-500 mt-0.5">
          {lang === "bn"
            ? "সিলেক্ট করা জেলা/উপজেলাই Users পেজের ফিল্টারে আসবে। All = সব।"
            : "Selected districts/upazilas appear in Users filters. All = everything."}
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[10px] text-slate-400 uppercase tracking-wide">
              {lang === "bn" ? "জেলা" : "District"}
            </label>
            <button
              type="button"
              disabled={disabled}
              onClick={setDistrictsAll}
              className={`text-[10px] px-2 py-0.5 rounded ${
                scope.districts === "all"
                  ? "bg-rose-600/30 text-rose-200"
                  : "bg-slate-800 text-slate-400 hover:text-slate-200"
              }`}
            >
              {lang === "bn" ? "সব সিলেক্ট" : "Select all"}
            </button>
          </div>
          <div className="max-h-40 overflow-auto rounded-lg border border-slate-800 divide-y divide-slate-800">
            {districts.map((d) => (
              <label
                key={d.id}
                className="flex items-center gap-2 px-2 py-1.5 text-xs hover:bg-slate-900 cursor-pointer"
              >
                <input
                  type="checkbox"
                  disabled={disabled}
                  checked={districtIsChecked(d.id)}
                  onChange={() => toggleDistrict(d.id)}
                  className="h-3.5 w-3.5 accent-rose-500"
                />
                <span className="truncate">{lang === "bn" ? d.name_bn : d.name_en}</span>
              </label>
            ))}
          </div>
          <p className="text-[10px] text-slate-500 mt-1">
            {scope.districts === "all"
              ? lang === "bn"
                ? "স্কোপ: সব জেলা"
                : "Scope: all districts"
              : lang === "bn"
                ? `স্কোপ: ${scope.districts.length} জেলা`
                : `Scope: ${scope.districts.length} districts`}
          </p>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[10px] text-slate-400 uppercase tracking-wide">
              {lang === "bn" ? "উপজেলা" : "Upazila"}
            </label>
            <button
              type="button"
              disabled={disabled}
              onClick={setUpazilasAll}
              className={`text-[10px] px-2 py-0.5 rounded ${
                scope.upazilas === "all"
                  ? "bg-rose-600/30 text-rose-200"
                  : "bg-slate-800 text-slate-400 hover:text-slate-200"
              }`}
            >
              {lang === "bn" ? "সব সিলেক্ট" : "Select all"}
            </button>
          </div>
          <select
            className={sel + " mb-1.5"}
            disabled={disabled}
            value={focusDistrict}
            onChange={(e) => setFocusDistrict(e.target.value)}
          >
            <option value="">{lang === "bn" ? "জেলা বেছে নিন…" : "Pick district…"}</option>
            {allowedDistrictIds.map((id) => {
              const d = districts.find((x) => x.id === id);
              if (!d) return null;
              return (
                <option key={id} value={id}>
                  {lang === "bn" ? d.name_bn : d.name_en}
                </option>
              );
            })}
          </select>
          <div className="max-h-40 overflow-auto rounded-lg border border-slate-800 divide-y divide-slate-800">
            {(upazilasByDistrict[focusDistrict] ?? []).map((name) => (
              <label
                key={name}
                className="flex items-center gap-2 px-2 py-1.5 text-xs hover:bg-slate-900 cursor-pointer"
              >
                <input
                  type="checkbox"
                  disabled={disabled || !focusDistrict}
                  checked={!!focusDistrict && upazilaIsChecked(focusDistrict, name)}
                  onChange={() => focusDistrict && toggleUpazila(focusDistrict, name)}
                  className="h-3.5 w-3.5 accent-rose-500"
                />
                <span className="truncate">{name}</span>
              </label>
            ))}
            {focusDistrict && !(upazilasByDistrict[focusDistrict] ?? []).length && (
              <p className="p-2 text-[10px] text-slate-500">
                {lang === "bn" ? "উপজেলা লোড হচ্ছে…" : "Loading upazilas…"}
              </p>
            )}
          </div>
          <p className="text-[10px] text-slate-500 mt-1">
            {scope.upazilas === "all"
              ? lang === "bn"
                ? "স্কোপ: সব উপজেলা"
                : "Scope: all upazilas"
              : lang === "bn"
                ? `স্কোপ: ${scope.upazilas.length} উপজেলা`
                : `Scope: ${scope.upazilas.length} upazilas`}
          </p>
        </div>
      </div>
    </div>
  );
}
