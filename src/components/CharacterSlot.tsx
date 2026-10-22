import { useState, type Dispatch } from "react";
import {
  characters, charByKey, ELEMENT_COLORS, img, MAX_LEVELS, setByKey, sets, STATS, weaponByKey, weapons,
} from "../data";
import { useI18n } from "../i18n";
import type { Action, CharConfig, SetChoice } from "../state";
import { Picker, type PickerItem } from "./Picker";

const RARITY_COLORS: Record<number, string> = { 5: "#b8823e", 4: "#8a6bbf", 3: "#4f7fa8" };

const byName = (a: PickerItem, b: PickerItem) => a.name.localeCompare(b.name);

type PickerKind = null | "char" | "weapon" | 0 | 1;

interface Props {
  slot: number;
  char: CharConfig | null;
  taken: string[];
  dispatch: Dispatch<Action>;
}

export function CharacterSlot({ slot, char, taken, dispatch }: Props) {
  const { t, name } = useI18n();
  const [picker, setPicker] = useState<PickerKind>(null);
  const info = char ? charByKey.get(char.key) : undefined;
  const update = (patch: Partial<CharConfig>) => dispatch({ type: "updateChar", slot, patch });

  const pickerEl = (() => {
    const close = () => setPicker(null);
    if (picker === "char")
      return (
        <Picker
          title={t("chooseCharacter")}
          items={characters
            .map((c) => ({
              key: c.key,
              name: name(c),
              names: c.names,
              img: img.char(c.key),
              accent: RARITY_COLORS[c.rarity],
              disabled: taken.includes(c.key),
            }))
            .sort(byName)}
          onClose={close}
          onPick={(key) => {
            dispatch({ type: "setChar", slot, key });
            close();
          }}
        />
      );
    if (picker === "weapon" && char && info)
      return (
        <Picker
          title={`${t("chooseWeapon")} (${t(`weapon.${info.weapon}`)})`}
          items={weapons
            .filter((w) => w.type === info.weapon)
            .map((w) => ({ key: w.key, name: name(w), names: w.names, img: img.weapon(w.key) }))
            .sort(byName)}
          onClose={close}
          onPick={(key) => {
            update({ weapon: { ...char.weapon, key } });
            close();
          }}
        />
      );
    if ((picker === 0 || picker === 1) && char) {
      const idx = picker;
      return (
        <Picker
          title={t("chooseSet")}
          items={sets.map((s) => ({ key: s.key, name: name(s), names: s.names, img: img.set(s.key) })).sort(byName)}
          onClose={close}
          onPick={(key) => {
            const next: SetChoice[] = [...char.sets];
            next[idx] = { key, count: idx === 0 ? next[0]?.count ?? 4 : 2 };
            update({ sets: next });
            close();
          }}
        />
      );
    }
    return null;
  })();

  if (!char || !info) {
    return (
      <div className="slot empty">
        <button className="add-char" onClick={() => setPicker("char")}>
          <span>+</span>
          {t("addCharacter")}
        </button>
        {pickerEl}
      </div>
    );
  }

  const weapon = weaponByKey.get(char.weapon.key);
  const set0 = char.sets[0];
  const setCount = (count: 2 | 4) =>
    update({ sets: count === 4 ? (set0 ? [{ ...set0, count }] : []) : set0 ? [{ ...set0, count }, ...char.sets.slice(1)] : [] });

  return (
    <div className="slot" style={{ ["--elem" as string]: ELEMENT_COLORS[info.element] }}>
      <div className="slot-head">
        <button className="portrait" onClick={() => setPicker("char")} title={t("changeCharacter")}>
          <img src={img.char(char.key)} alt="" />
        </button>
        <div className="slot-title">
          <strong>{name(info)}</strong>
          <span className="muted">
            {info.rarity}★ · {t(`elem.${info.element}`)} · {t(`weapon.${info.weapon}`)}
          </span>
        </div>
        <button className="icon-btn" title={t("remove")} onClick={() => dispatch({ type: "setChar", slot, key: null })}>
          ×
        </button>
      </div>

      <label className="field">
        <span>{t("constellation")}</span>
        <div className="seg">
          {[0, 1, 2, 3, 4, 5, 6].map((n) => (
            <button key={n} className={n === char.cons ? "on" : ""} onClick={() => update({ cons: n })}>
              C{n}
            </button>
          ))}
        </div>
      </label>

      <div className="row">
        <label className="field">
          <span>{t("level")}</span>
          <LevelInput
            level={char.level}
            max={char.maxLevel}
            caps={MAX_LEVELS}
            onChange={(level, maxLevel) => update({ level, maxLevel })}
          />
        </label>
        <label className="field">
          <span>{t("talents")}</span>
          <div className="talents">
            {char.talents.map((t, i) => (
              <input
                key={i}
                type="number"
                min={1}
                max={10}
                value={t}
                onChange={(e) => {
                  const talents = [...char.talents] as CharConfig["talents"];
                  talents[i] = clamp(+e.target.value, 1, 10);
                  update({ talents });
                }}
              />
            ))}
          </div>
        </label>
      </div>

      <div className="section-label">{t("weapon")}</div>
      <button className="pick-row" onClick={() => setPicker("weapon")}>
        <img src={img.weapon(char.weapon.key)} alt="" />
        <span>{weapon ? name(weapon) : char.weapon.key}</span>
      </button>
      <div className="row">
        <label className="field">
          <span>{t("refine")}</span>
          <div className="seg">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                className={n === char.weapon.refine ? "on" : ""}
                onClick={() => update({ weapon: { ...char.weapon, refine: n } })}
              >
                R{n}
              </button>
            ))}
          </div>
        </label>
        <label className="field">
          <span>{t("level")}</span>
          <LevelInput
            level={char.weapon.level}
            max={char.weapon.maxLevel}
            caps={MAX_LEVELS.filter((l) => l <= 90)}
            onChange={(level, maxLevel) => update({ weapon: { ...char.weapon, level, maxLevel } })}
          />
        </label>
      </div>

      <div className="section-label">{t("artifacts")}</div>
      <div className="row">
        <SetButton set={set0} onClick={() => setPicker(0)} onClear={() => update({ sets: [] })} />
        <div className="seg small">
          {([4, 2] as const).map((n) => (
            <button key={n} className={(set0?.count ?? 4) === n ? "on" : ""} onClick={() => setCount(n)} disabled={!set0}>
              {n}pc
            </button>
          ))}
        </div>
      </div>
      {set0?.count === 2 && (
        <div className="row">
          <SetButton
            set={char.sets[1]}
            onClick={() => setPicker(1)}
            onClear={() => update({ sets: [set0] })}
          />
          <div className="seg small">
            <button className="on" disabled>
              2pc
            </button>
          </div>
        </div>
      )}

      <div className="section-label">{t("artifactStats")}</div>
      <p className="muted tiny">{t("artifactStatsHint")}</p>
      <div className="subs">
        {STATS.map(({ key, pct }) => (
          <label key={key} className="sub" title={t(`stat.${key}`)}>
            <span>{t(`short.${key}`)}</span>
            <input
              type="number"
              step="0.1"
              min={0}
              value={char.stats[key] ?? ""}
              placeholder="0"
              onChange={(e) => {
                const stats = { ...char.stats };
                if (e.target.value === "") delete stats[key];
                else stats[key] = +e.target.value;
                update({ stats });
              }}
            />
            <em>{pct ? "%" : ""}</em>
          </label>
        ))}
      </div>
      {pickerEl}
    </div>
  );
}

function SetButton({ set, onClick, onClear }: { set?: SetChoice; onClick: () => void; onClear: () => void }) {
  const { t, name } = useI18n();
  const info = set ? setByKey.get(set.key) : undefined;
  return (
    <div className="pick-row set">
      <button onClick={onClick}>
        {info ? <img src={img.set(info.key)} alt="" /> : <span className="ph">+</span>}
        <span>{info ? name(info) : t("chooseSetShort")}</span>
      </button>
      {info && (
        <button className="icon-btn" onClick={onClear} title={t("clear")}>
          ×
        </button>
      )}
    </div>
  );
}

function LevelInput({
  level, max, caps, onChange,
}: { level: number; max: number; caps: number[]; onChange: (level: number, max: number) => void }) {
  return (
    <div className="level">
      <input
        type="number"
        min={1}
        max={max}
        value={level}
        onChange={(e) => onChange(clamp(+e.target.value, 1, max), max)}
      />
      <span>/</span>
      <select value={max} onChange={(e) => onChange(Math.min(level, +e.target.value), +e.target.value)}>
        {caps.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
    </div>
  );
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Number.isFinite(v) ? v : lo));
