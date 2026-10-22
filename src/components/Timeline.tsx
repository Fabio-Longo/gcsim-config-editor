import { useState, type Dispatch, type KeyboardEvent, type PointerEvent } from "react";
import {
  closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove, rectSortingStrategy, SortableContext, sortableKeyboardCoordinates, useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { charByKey, COUNTABLE, ELEMENT_COLORS, img } from "../data";
import { useI18n } from "../i18n";
import type { Action, CharConfig, RotationAction } from "../state";

interface Props {
  team: CharConfig[];
  rotation: RotationAction[];
  dispatch: Dispatch<Action>;
}

const clampSeconds = (v: number) => Math.max(0.1, Math.min(60, Math.round((Number.isFinite(v) ? v : 1) * 10) / 10));

export function Timeline({ team, rotation, dispatch }: Props) {
  const { t } = useI18n();
  const [adding, setAdding] = useState(false);
  const sensors = useSensors(
    // Small distance so clicks on card buttons don't start a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = rotation.findIndex((r) => r.id === active.id);
    const to = rotation.findIndex((r) => r.id === over.id);
    dispatch({ type: "setRotation", rotation: arrayMove(rotation, from, to) });
  };

  return (
    <div className="timeline">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={rotation.map((r) => r.id)} strategy={rectSortingStrategy}>
          {rotation.map((r, i) => (
            <ActionCard key={r.id} index={i} item={r} dispatch={dispatch} />
          ))}
        </SortableContext>
      </DndContext>
      <button
        className="add-action"
        onClick={() => setAdding(true)}
        disabled={!team.length}
        title={team.length ? t("addAction") : t("addCharFirst")}
      >
        +
      </button>
      {adding && <AddActionDialog team={team} dispatch={dispatch} onClose={() => setAdding(false)} />}
    </div>
  );
}

function ActionCard({ item, index, dispatch }: { item: RotationAction; index: number; dispatch: Dispatch<Action> }) {
  const { t, name } = useI18n();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const isWait = item.action === "wait";
  const info = charByKey.get(item.char);
  const stop = (e: PointerEvent | KeyboardEvent) => e.stopPropagation();
  return (
    <div
      ref={setNodeRef}
      className={`card${isDragging ? " dragging" : ""}${isWait ? " wait" : ""}`}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        ["--elem" as string]: isWait ? "var(--muted)" : ELEMENT_COLORS[info?.element ?? "none"],
      }}
      {...attributes}
      {...listeners}
    >
      <span className="card-index">{index + 1}</span>
      <button
        className="card-remove"
        title={t("remove")}
        onPointerDown={stop}
        onClick={() => dispatch({ type: "removeAction", id: item.id })}
      >
        ×
      </button>
      {isWait ? (
        <div className="wait-icon">⏳</div>
      ) : (
        <img src={img.char(item.char)} alt="" draggable={false} />
      )}
      <div className="card-name">{isWait ? " " : info ? name(info) : item.char}</div>
      <div className="card-action">{t(`action.${item.action}`)}</div>
      {isWait && (
        <div className="counter" onPointerDown={stop} onKeyDown={stop}>
          <input
            type="number"
            min={0.1}
            max={60}
            step={0.1}
            value={item.seconds ?? 1}
            onChange={(e) => dispatch({ type: "updateAction", id: item.id, patch: { seconds: clampSeconds(+e.target.value) } })}
          />
          <span>{t("seconds")}</span>
        </div>
      )}
      {COUNTABLE.has(item.action) && (
        <div className="counter" onPointerDown={stop}>
          <button
            onClick={() => dispatch({ type: "updateAction", id: item.id, patch: { count: Math.max(1, item.count - 1) } })}
          >
            −
          </button>
          <span>×{item.count}</span>
          <button onClick={() => dispatch({ type: "updateAction", id: item.id, patch: { count: Math.min(10, item.count + 1) } })}>
            +
          </button>
        </div>
      )}
    </div>
  );
}

function AddActionDialog({ team, dispatch, onClose }: { team: CharConfig[]; dispatch: Dispatch<Action>; onClose: () => void }) {
  const { t, name } = useI18n();
  const [char, setChar] = useState<string | null>(team.length === 1 ? team[0].key : null);
  const [count, setCount] = useState(1);
  const [seconds, setSeconds] = useState(1);
  const info = char ? charByKey.get(char) : undefined;

  const add = (action: string) => {
    dispatch({ type: "addAction", char: char!, action, count: COUNTABLE.has(action) ? count : 1 });
    onClose();
  };
  const addWait = () => {
    dispatch({ type: "addAction", char: "", action: "wait", count: 1, seconds: clampSeconds(seconds) });
    onClose();
  };

  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="modal small" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{info ? t("chooseAction", { name: name(info) }) : t("chooseCharacter")}</h3>
          <button className="icon-btn" onClick={onClose} aria-label={t("close")}>
            ×
          </button>
        </div>
        {!info ? (
          <div className="grid">
            {team.map((c) => {
              const ci = charByKey.get(c.key);
              return (
                <button key={c.key} className="tile" onClick={() => setChar(c.key)}>
                  <img src={img.char(c.key)} alt="" />
                  <span>{ci ? name(ci) : c.key}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <>
            <div className="action-list">
              {info.actions.map((a) => (
                <button key={a} onClick={() => add(a)} title={info.notes[a]}>
                  {t(`action.${a}`)}
                  {info.notes[a] && <sup className="note"> ⓘ</sup>}
                  {COUNTABLE.has(a) && count > 1 && <em> ×{count}</em>}
                </button>
              ))}
            </div>
            {Object.keys(info.notes).length > 0 && (
              <ul className="notes">
                {Object.entries(info.notes).map(([a, n]) => (
                  <li key={a}>
                    <b>{t(`action.${a}`)}:</b> {n}
                  </li>
                ))}
              </ul>
            )}
            <label className="field inline">
              <span>{t("repeatCount")}</span>
              <input
                type="number"
                min={1}
                max={10}
                value={count}
                onChange={(e) => setCount(Math.max(1, Math.min(10, +e.target.value || 1)))}
              />
            </label>
            {team.length > 1 && (
              <button className="link" onClick={() => setChar(null)}>
                {t("otherCharacter")}
              </button>
            )}
          </>
        )}
        <div className="wait-row">
          <span>{t("orWait")}</span>
          <input
            type="number"
            min={0.1}
            max={60}
            step={0.1}
            value={seconds}
            onChange={(e) => setSeconds(+e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addWait()}
          />
          <span>{t("seconds")}</span>
          <button onClick={addWait}>⏳ {t("action.wait")}</button>
        </div>
      </div>
    </div>
  );
}
