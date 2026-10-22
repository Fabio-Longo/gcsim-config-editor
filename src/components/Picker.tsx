import { useEffect, useMemo, useRef, useState } from "react";

export interface PickerItem {
  key: string;
  name: string;
  img: string;
  /** Optional accent (rarity/element) for the tile background. */
  accent?: string;
  disabled?: boolean;
}

interface Props {
  title: string;
  items: PickerItem[];
  onPick: (key: string) => void;
  onClose: () => void;
}

export function Picker({ title, items, onPick, onClose }: Props) {
  const [query, setQuery] = useState("");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.name.toLowerCase().includes(q) || i.key.includes(q.replace(/[^a-z0-9]/g, "")));
  }, [items, query]);

  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <input
          ref={input}
          className="search"
          placeholder="Search by name…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
            if (e.key === "Enter") {
              const first = filtered.find((i) => !i.disabled);
              if (first) onPick(first.key);
            }
          }}
        />
        <div className="grid">
          {filtered.map((i) => (
            <button
              key={i.key}
              className="tile"
              disabled={i.disabled}
              style={i.accent ? { ["--tile" as string]: i.accent } : undefined}
              onClick={() => onPick(i.key)}
              title={i.name}
            >
              <img src={i.img} alt="" loading="lazy" />
              <span>{i.name}</span>
            </button>
          ))}
          {!filtered.length && <p className="muted">Nothing found</p>}
        </div>
      </div>
    </div>
  );
}
