import { useState, type Dispatch } from "react";
import {
  closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove, rectSortingStrategy, SortableContext, sortableKeyboardCoordinates, useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ACTION_LABELS, charByKey, COUNTABLE, ELEMENT_COLORS, img } from "../data";
import type { Action, CharConfig, RotationAction } from "../state";

interface Props {
  team: CharConfig[];
  rotation: RotationAction[];
  dispatch: Dispatch<Action>;
}

export function Timeline({ team, rotation, dispatch }: Props) {
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
        title={team.length ? "Add action" : "Add a character to the team first"}
      >
        +
      </button>
      {adding && <AddActionDialog team={team} dispatch={dispatch} onClose={() => setAdding(false)} />}
    </div>
  );
}

function ActionCard({ item, index, dispatch }: { item: RotationAction; index: number; dispatch: Dispatch<Action> }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const info = charByKey.get(item.char);
  return (
    <div
      ref={setNodeRef}
      className={`card${isDragging ? " dragging" : ""}`}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        ["--elem" as string]: ELEMENT_COLORS[info?.element ?? "none"],
      }}
      {...attributes}
      {...listeners}
    >
      <span className="card-index">{index + 1}</span>
      <button
        className="card-remove"
        title="Remove"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => dispatch({ type: "removeAction", id: item.id })}
      >
        ×
      </button>
      <img src={img.char(item.char)} alt="" draggable={false} />
      <div className="card-name">{info?.name ?? item.char}</div>
      <div className="card-action">{ACTION_LABELS[item.action] ?? item.action}</div>
      {COUNTABLE.has(item.action) && (
        <div className="counter" onPointerDown={(e) => e.stopPropagation()}>
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
  const [char, setChar] = useState<string | null>(team.length === 1 ? team[0].key : null);
  const [count, setCount] = useState(1);
  const info = char ? charByKey.get(char) : undefined;

  const add = (action: string) => {
    dispatch({ type: "addAction", char: char!, action, count: COUNTABLE.has(action) ? count : 1 });
    onClose();
  };

  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="modal small" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{info ? `${info.name}: choose action` : "Choose character"}</h3>
          <button className="icon-btn" onClick={onClose}>
            ×
          </button>
        </div>
        {!info ? (
          <div className="grid">
            {team.map((c) => (
              <button key={c.key} className="tile" onClick={() => setChar(c.key)}>
                <img src={img.char(c.key)} alt="" />
                <span>{charByKey.get(c.key)?.name}</span>
              </button>
            ))}
          </div>
        ) : (
          <>
            <div className="action-list">
              {info.actions.map((a) => (
                <button key={a} onClick={() => add(a)} title={info.notes[a]}>
                  {ACTION_LABELS[a] ?? a}
                  {info.notes[a] && <sup className="note"> ⓘ</sup>}
                  {COUNTABLE.has(a) && count > 1 && <em> ×{count}</em>}
                </button>
              ))}
            </div>
            {Object.keys(info.notes).length > 0 && (
              <ul className="notes">
                {Object.entries(info.notes).map(([a, n]) => (
                  <li key={a}>
                    <b>{ACTION_LABELS[a] ?? a}:</b> {n}
                  </li>
                ))}
              </ul>
            )}
            <label className="field inline">
              <span>Repeat count (attack / charged / aim)</span>
              <input type="number" min={1} max={10} value={count} onChange={(e) => setCount(Math.max(1, Math.min(10, +e.target.value || 1)))} />
            </label>
            {team.length > 1 && (
              <button className="link" onClick={() => setChar(null)}>
                ← other character
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
