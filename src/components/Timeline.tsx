import {
  createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type Dispatch, type HTMLAttributes, type KeyboardEvent, type PointerEvent,
  type ReactNode,
} from "react";
import {
  DndContext, DragOverlay, MeasuringStrategy, PointerSensor, pointerWithin, useDraggable, useDroppable, useSensor,
  useSensors, type CollisionDetection, type DragEndEvent, type DragMoveEvent, type UniqueIdentifier,
} from "@dnd-kit/core";
import { CAN_SKIP, charByKey, COUNTABLE, ELEMENT_COLORS, img } from "../data";
import { useI18n } from "../i18n";
import {
  containsIf, findContainer, findNode, newBlock, parseSeconds, ROOT, secondsToFrames, subtreeIds, uid, type ActionNode, type BlockKind, type Branch, type IfNode,
  type RNode,
} from "../rotation";
import type { Action, CharConfig } from "../state";

interface Props {
  team: CharConfig[];
  rotation: RNode[];
  dispatch: Dispatch<Action>;
}

/** Where a dragged node would land: index inside container `cid`. */
interface DropTarget {
  cid: string;
  index: number;
}

interface Ctx {
  dispatch: Dispatch<Action>;
  drop: DropTarget | null;
  openAdd: (cid: string) => void;
}
const RotationCtx = createContext<Ctx>(null!);

// Droppable ids: a node uses its own id, a container (lane) uses "c:" + its id.
const laneId = (cid: string) => `c:${cid}`;

const stop = (e: PointerEvent | KeyboardEvent) => e.stopPropagation();

/**
 * Resolves overlaps between block headers and if bottom strips, which only happen when one
 * block sits at the very edge of another. Priority decides who stays and who moves right:
 *  1. Headers, in DOM order (parents first). A block whose header would overlap moves right
 *     as a whole, so its header starts just past the one in the way.
 *  2. Bottom strips, parents first. Rows holding nested ifs already reserve room below for
 *     their strips (see .has-strips), so this is only a fallback for leftover overlaps.
 * Positions come from offsetLeft/offsetTop, which ignore the enter animation's scale.
 */
function layoutHeaders(root: HTMLElement) {
  const heads = [...root.querySelectorAll<HTMLElement>(".block-head")];
  // A nested if's strip comes before its parent's in DOM order; reversed, parents go first.
  const strips = [...root.querySelectorAll<HTMLElement>(".branch-peek")].reverse();
  root.querySelectorAll<HTMLElement>("[data-shifted]").forEach((n) => {
    n.style.removeProperty("margin-left");
    delete n.dataset.shifted;
  });
  strips.forEach((r) => (r.firstElementChild as HTMLElement | null)?.style.removeProperty("margin-left"));
  const posOf = (el: HTMLElement) => {
    let x = 0, y = 0;
    for (let e: HTMLElement | null = el; e && e !== root; e = e.offsetParent as HTMLElement | null) {
      x += e.offsetLeft;
      y += e.offsetTop;
    }
    return { x, y };
  };
  type Box = { left: number; top: number; right: number; bottom: number };
  const boxOf = (el: HTMLElement): Box => {
    const { x, y } = posOf(el);
    return { left: x, top: y, right: x + el.offsetWidth, bottom: y + el.offsetHeight };
  };
  const hit = (a: Box, b: Box) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  /** A strip's background spans its whole block; only the part up to its last button counts. */
  const stripBoxOf = (strip: HTMLElement): Box => {
    const box = boxOf(strip);
    const last = strip.lastElementChild as HTMLElement | null;
    return last ? { ...box, right: posOf(last).x + last.offsetWidth + 6 } : box;
  };

  const placed: Box[] = [];
  /** Moves `content` right (via `shift`, given the needed distance) until it clears everything placed. */
  const place = (content: HTMLElement, shift: (by: number) => void, measure = boxOf) => {
    let box = measure(content);
    for (let moved = true; moved; ) {
      moved = false;
      for (const p of placed) {
        if (hit(box, p)) {
          shift(p.right + 6 - box.left);
          box = measure(content);
          moved = true;
        }
      }
    }
    placed.push(box);
  };

  for (const row of heads) {
    const content = row.firstElementChild as HTMLElement | null;
    const node = row.closest<HTMLElement>(".node");
    if (!content || !node) continue;
    place(content, (by) => {
      node.style.marginLeft = `${(parseFloat(node.style.marginLeft) || 0) + by}px`;
      node.dataset.shifted = "";
    });
  }
  for (const row of strips) {
    const content = row.firstElementChild as HTMLElement | null;
    if (content) place(content, (by) => (content.style.marginLeft = `${(parseFloat(content.style.marginLeft) || 0) + by}px`), stripBoxOf);
  }
}

/** Plays the leave animation on `el`, then runs `done` (the actual removal). */
function animateOut(el: Element | null, done: () => void) {
  if (!el) return done();
  el.classList.add("leaving");
  setTimeout(done, 150);
}

export function Timeline({ team, rotation, dispatch }: Props) {
  const { lang } = useI18n();
  const [addTo, setAddTo] = useState<string | null>(null);
  const tracksRef = useRef<HTMLDivElement>(null);
  // Header widths depend on conditions and on the UI language.
  useLayoutEffect(() => {
    if (tracksRef.current) layoutHeaders(tracksRef.current);
  }, [rotation, lang]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [drop, setDrop] = useState<DropTarget | null>(null);
  // Droppables inside the dragged node: a block can't be dropped into itself.
  const forbidden = useRef(new Set<string>());

  const sensors = useSensors(
    // Small distance so clicks on card buttons and inputs don't start a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  // The innermost droppable under the pointer wins, so nested lanes beat the blocks around them.
  const collision: CollisionDetection = (args) => {
    const area = (id: UniqueIdentifier) => {
      const r = args.droppableRects.get(id);
      return r ? r.width * r.height : Infinity;
    };
    return pointerWithin(args)
      .filter((c) => !forbidden.current.has(String(c.id).replace(/^c:/, "")))
      .sort((a, b) => area(a.id) - area(b.id))
      .slice(0, 1);
  };

  const computeDrop = (e: DragMoveEvent | DragEndEvent): DropTarget | null => {
    if (!e.over) return null;
    const x = (e.activatorEvent as globalThis.PointerEvent).clientX + e.delta.x;
    const id = String(e.over.id);
    if (id.startsWith("c:")) {
      // Over a lane's free space: insert after every child whose center is left of the pointer.
      const cid = id.slice(2);
      const list = findContainer(rotation, cid) ?? [];
      let index = 0;
      list.forEach((n, i) => {
        const r = document.querySelector(`[data-node="${n.id}"]`)?.getBoundingClientRect();
        if (r && x > r.left + r.width / 2) index = i + 1;
      });
      return { cid, index };
    }
    const hit = findNode(rotation, id);
    if (!hit) return null;
    const r = e.over.rect;
    return { cid: hit.containerId, index: hit.index + (x > r.left + r.width / 2 ? 1 : 0) };
  };

  const endDrag = () => {
    setActiveId(null);
    setDrop(null);
  };

  const active = activeId ? findNode(rotation, activeId)?.node : undefined;

  return (
    <RotationCtx.Provider value={{ dispatch, drop, openAdd: setAddTo }}>
      <DndContext
        sensors={sensors}
        collisionDetection={collision}
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        onDragStart={(e) => {
          const hit = findNode(rotation, String(e.active.id));
          forbidden.current = hit ? subtreeIds(hit.node) : new Set();
          setActiveId(String(e.active.id));
        }}
        onDragMove={(e) => {
          const next = computeDrop(e);
          if (next?.cid !== drop?.cid || next?.index !== drop?.index) setDrop(next);
        }}
        onDragEnd={(e) => {
          // Recompute at release: a quick flick may end before any drag-move event updated `drop`.
          const target = computeDrop(e) ?? drop;
          if (target) dispatch({ type: "moveNode", id: String(e.active.id), containerId: target.cid, index: target.index });
          endDrag();
        }}
        onDragCancel={endDrag}
      >
        <div className="rotation-panel">
          {/* "tracks" draws the rails: one line per track, across the full scroll width. */}
          <div className="tracks" ref={tracksRef}>
            <Lane cid={ROOT} nodes={rotation} />
          </div>
        </div>
        <DragOverlay dropAnimation={null}>{active ? <DragGhost node={active} /> : null}</DragOverlay>
      </DndContext>
      {addTo && <AddDialog containerId={addTo} team={team} dispatch={dispatch} onClose={() => setAddTo(null)} />}
    </RotationCtx.Provider>
  );
}

/** A horizontal row of nodes; also a drop zone. */
function Lane({ cid, nodes }: { cid: string; nodes: RNode[] }) {
  const { t } = useI18n();
  const { drop, openAdd } = useContext(RotationCtx);
  const { setNodeRef } = useDroppable({ id: laneId(cid) });
  const target = drop?.cid === cid ? drop.index : -1;
  return (
    <div ref={setNodeRef} className={`lane${target >= 0 ? " drop-target" : ""}`}>
      {nodes.map((n, i) => (
        <NodeView key={n.id} node={n} dropBefore={target === i} dropAfter={target === nodes.length && i === nodes.length - 1} />
      ))}
      <button className="add-action" onClick={() => openAdd(cid)} title={t("addAction")}>
        +
      </button>
    </div>
  );
}

/** Drag listeners + a11y attributes, spread onto whatever element should start the drag. */
type Handle = HTMLAttributes<HTMLElement>;

function NodeView({ node, dropBefore, dropAfter }: { node: RNode; dropBefore: boolean; dropAfter: boolean }) {
  const drag = useDraggable({ id: node.id });
  const dropZone = useDroppable({ id: node.id });
  const handle = { ...drag.listeners, ...drag.attributes } as unknown as Handle;
  const cls = ["node", drag.isDragging && "dragging-src", dropBefore && "drop-before", dropAfter && "drop-after"]
    .filter(Boolean)
    .join(" ");
  return (
    <div
      ref={(el) => {
        drag.setNodeRef(el);
        dropZone.setNodeRef(el);
      }}
      data-node={node.id}
      className={cls}
    >
      {node.kind === "action" ? <ActionCard item={node} handle={handle} /> : <BlockView node={node} handle={handle} />}
    </div>
  );
}

function NodeButtons({ id }: { id: string }) {
  const { t } = useI18n();
  const { dispatch } = useContext(RotationCtx);
  return (
    <>
      <button className="mini" title={t("duplicate")} onPointerDown={stop} onClick={() => dispatch({ type: "duplicateNode", id })}>
        ⧉
      </button>
      <button
        className="mini danger"
        title={t("remove")}
        onPointerDown={stop}
        onClick={() => animateOut(document.querySelector(`[data-node="${id}"]`), () => dispatch({ type: "removeNode", id }))}
      >
        ×
      </button>
    </>
  );
}

function ActionCard({ item, handle }: { item: ActionNode; handle?: Handle }) {
  const { t, name } = useI18n();
  const { dispatch } = useContext(RotationCtx);
  const update = (patch: Partial<ActionNode>) => dispatch({ type: "updateNode", id: item.id, patch });
  const isWait = item.action === "wait";
  const info = charByKey.get(item.char);
  return (
    <div
      className={`card${isWait ? " wait" : ""}`}
      style={{ ["--elem" as string]: isWait ? "var(--muted)" : ELEMENT_COLORS[info?.element ?? "none"] }}
      {...handle}
    >
      <div className="card-tools">
        <NodeButtons id={item.id} />
      </div>
      {isWait ? <div className="wait-icon">⏳</div> : <img src={img.char(item.char)} alt="" draggable={false} />}
      <div className="card-name">{isWait ? "\u00a0" : info ? name(info) : item.char}</div>
      <div className="card-action">{t(`action.${item.action}`)}</div>
      {isWait && (
        <div className="counter" onPointerDown={stop} onKeyDown={stop}>
          <SecondsInput value={item.seconds ?? 1} onChange={(seconds) => update({ seconds })} />
          <span>{t("seconds")}</span>
        </div>
      )}
      {CAN_SKIP.has(item.action) && (
        <label className="skip" onPointerDown={stop} onKeyDown={stop}>
          <input
            type="checkbox"
            checked={!!item.skipOnCooldown}
            onChange={(e) => update({ skipOnCooldown: e.target.checked })}
          />
          <span>{t("skipOnCooldown")}</span>
        </label>
      )}
      {COUNTABLE.has(item.action) && (
        <div className="counter" onPointerDown={stop}>
          <button onClick={() => update({ count: Math.max(1, item.count - 1) })}>−</button>
          <span>×{item.count}</span>
          <button onClick={() => update({ count: Math.min(10, item.count + 1) })}>+</button>
        </div>
      )}
    </div>
  );
}

/**
 * Seconds as a decimal ("1.25" or "1,25"). Keeps the raw text while typing so "1." or "0,"
 * aren't rejected mid-edit; only valid positive numbers reach the state.
 */
function SecondsInput({ value, onChange, onEnter }: { value: number; onChange: (v: number) => void; onEnter?: () => void }) {
  const [text, setText] = useState(String(value));
  // Follow outside changes (e.g. undo or duplicate) without fighting the user's typing.
  useEffect(() => {
    if (parseSeconds(text) !== value) setText(String(value));
  }, [value]);
  const frames = secondsToFrames(value);
  return (
    <input
      className="seconds"
      inputMode="decimal"
      value={text}
      title={`${frames} frames`}
      onChange={(e) => {
        setText(e.target.value);
        const v = parseSeconds(e.target.value);
        if (v !== null) onChange(v);
      }}
      onBlur={() => setText(String(value))}
      onKeyDown={(e) => e.key === "Enter" && onEnter?.()}
    />
  );
}

/** Condition field that grows with its text, so the whole condition is always visible. */
function CondInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useI18n();
  const placeholder = t("condPlaceholder");
  // Full example in the tooltip; the field itself starts small.
  return (
    <input
      className="cond"
      value={value}
      placeholder={placeholder}
      title={value || t("condExample")}
      // Monospace font: one "ch" per character.
      style={{ width: `${(value || placeholder).length + 1}ch` }}
      spellCheck={false}
      onPointerDown={stop}
      onKeyDown={stop}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

/** Keyword with editor-style colors: `if` green, `else` red, `else if` both. */
function Keyword({ word }: { word: "if" | "else if" | "else" | "while" }) {
  if (word === "else if")
    return (
      <span className="kw">
        <span className="kw-else">else</span> <span className="kw-if">if</span>
      </span>
    );
  return <span className={`kw kw-${word}`}>{word}</span>;
}

/** Nesting depth of the lane being rendered; blocks step their background inward per level. */
const DepthCtx = createContext(0);

/**
 * One row of a block. The header (keyword, condition, buttons) takes no height: it sits in the
 * block's top padding, so cards inside stay level with cards outside.
 */
function BlockRow({
  head, cid, nodes, branchId, tone,
}: { head: ReactNode; cid: string; nodes: RNode[]; branchId?: string; tone: "group" | "while" | "if" | "else" }) {
  const depth = useContext(DepthCtx);
  return (
    // Nested ifs hang their "+ else" strips below this row: reserve room for them.
    <div className={`branch tone-${tone}${containsIf(nodes) ? " has-strips" : ""}`} data-branch={branchId}>
      <div className="block-head">
        <div className="head-row">{head}</div>
      </div>
      <DepthCtx.Provider value={depth + 1}>
        <Lane cid={cid} nodes={nodes} />
      </DepthCtx.Provider>
    </div>
  );
}

/** Block wrapper: its background inset from the track edge grows with nesting depth. */
function BlockBox({ children, kind }: { children: ReactNode; kind: BlockKind }) {
  const depth = useContext(DepthCtx);
  return (
    <div
      className={`block block-${kind}`}
      style={{
        ["--inset" as string]: `${2 + 4 * Math.min(depth, 3)}px`,
        // Nested if strips may sit on top of their parent's strip; keep them clickable.
        ["--depth" as string]: depth,
        // Deeper blocks get a stronger tint and border, so nesting reads at a glance.
        ["--tint" as string]: `${10 + 6 * Math.min(depth, 4)}%`,
        ["--edge" as string]: `${40 + 12 * Math.min(depth, 4)}%`,
      }}
    >
      {children}
    </div>
  );
}

function BlockView({ node, handle }: { node: Exclude<RNode, ActionNode>; handle: Handle }) {
  const { t } = useI18n();
  const { dispatch } = useContext(RotationCtx);
  if (node.kind === "group")
    return (
      <BlockBox kind="group">
        <BlockRow
          tone="group"
          cid={node.id}
          nodes={node.children}
          head={
            <>
              <span className="grip" {...handle}>
                ⠿ {t("block.group")}
              </span>
              <NodeButtons id={node.id} />
            </>
          }
        />
      </BlockBox>
    );
  if (node.kind === "while")
    return (
      <BlockBox kind="while">
        <BlockRow
          tone="while"
          cid={node.id}
          nodes={node.children}
          head={
            <>
              <span className="grip" {...handle}>
                ⠿ <Keyword word="while" />
              </span>
              <CondInput value={node.cond} onChange={(cond) => dispatch({ type: "updateNode", id: node.id, patch: { cond } })} />
              <NodeButtons id={node.id} />
            </>
          }
        />
      </BlockBox>
    );
  return <IfView node={node} handle={handle} />;
}

function IfView({ node, handle }: { node: IfNode; handle: Handle }) {
  const { t } = useI18n();
  const { dispatch } = useContext(RotationCtx);
  const removeBranch = (b: Branch) => (
    <button
      className="mini danger"
      title={t("remove")}
      onPointerDown={stop}
      onClick={() =>
        animateOut(document.querySelector(`[data-branch="${b.id}"]`), () =>
          dispatch({ type: "removeBranch", ifId: node.id, branchId: b.id }),
        )
      }
    >
      ×
    </button>
  );
  return (
    <BlockBox kind="if">
      {node.branches.map((b, i) => (
        <BlockRow
          key={b.id}
          tone={i === 0 ? "if" : "else"}
          branchId={b.id}
          cid={b.id}
          nodes={b.children}
          head={
            <>
              {i === 0 ? (
                <span className="grip" {...handle}>
                  ⠿ <Keyword word="if" />
                </span>
              ) : (
                <Keyword word="else if" />
              )}
              <CondInput value={b.cond} onChange={(cond) => dispatch({ type: "setBranchCond", ifId: node.id, branchId: b.id, cond })} />
              {i === 0 ? <NodeButtons id={node.id} /> : removeBranch(b)}
            </>
          }
        />
      ))}
      {node.elseBranch && (
        <BlockRow
          tone="else"
          branchId={node.elseBranch.id}
          cid={node.elseBranch.id}
          nodes={node.elseBranch.children}
          head={
            <>
              <Keyword word="else" />
              {removeBranch(node.elseBranch)}
            </>
          }
        />
      )}
      {/* Takes no height: the strip peeks into the next rail, under the last branch. */}
      <div className="branch-peek">
        <div className="peek-row">
          <button className="head-btn" onPointerDown={stop} onClick={() => dispatch({ type: "addBranch", ifId: node.id, branch: "elif" })}>
            + <Keyword word="else if" />
          </button>
          {!node.elseBranch && (
            <button className="head-btn" onPointerDown={stop} onClick={() => dispatch({ type: "addBranch", ifId: node.id, branch: "else" })}>
              + <Keyword word="else" />
            </button>
          )}
        </div>
      </div>
    </BlockBox>
  );
}

/** What follows the pointer while dragging. */
function DragGhost({ node }: { node: RNode }) {
  const { t } = useI18n();
  if (node.kind === "action") return <ActionCard item={node} />;
  const label = node.kind === "group" ? t("block.group") : node.kind === "while" ? `while ${node.cond}` : `if ${node.branches[0].cond}`;
  return <div className="drag-ghost">⠿ {label}</div>;
}

function AddDialog({
  containerId, team, dispatch, onClose,
}: { containerId: string; team: CharConfig[]; dispatch: Dispatch<Action>; onClose: () => void }) {
  const { t, name } = useI18n();
  const [char, setChar] = useState<string | null>(team.length === 1 ? team[0].key : null);
  const [count, setCount] = useState(1);
  const [seconds, setSeconds] = useState(1);
  const info = char ? charByKey.get(char) : undefined;

  const addNode = (node: RNode) => {
    dispatch({ type: "addNode", containerId, node });
    onClose();
  };
  const add = (action: string) =>
    addNode({ id: uid(), kind: "action", char: char!, action, count: COUNTABLE.has(action) ? count : 1 });
  const addWait = () => addNode({ id: uid(), kind: "action", char: "", action: "wait", count: 1, seconds });
  const addBlock = (kind: BlockKind) => addNode(newBlock(kind));

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
          team.length ? (
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
            <p className="muted">{t("addCharFirst")}</p>
          )
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
          <SecondsInput value={seconds} onChange={setSeconds} onEnter={addWait} />
          <span>{t("seconds")}</span>
          <button onClick={addWait}>⏳ {t("action.wait")}</button>
        </div>
        <div className="wait-row">
          <span>{t("orBlock")}</span>
          <button onClick={() => addBlock("group")}>{t("block.group")}</button>
          <button onClick={() => addBlock("if")}>if / else</button>
          <button onClick={() => addBlock("while")}>while</button>
        </div>
      </div>
    </div>
  );
}
