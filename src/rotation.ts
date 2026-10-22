// Rotation tree: actions plus nestable blocks (group, while, if/elif/else).
// Every list of children is a "container" with an id: "root", a group/while node's id, or an if branch's id.

export interface ActionNode {
  id: string;
  kind: "action";
  /** Empty for "wait", which belongs to no character. */
  char: string;
  action: string;
  count: number;
  /** Duration of a "wait" step. */
  seconds?: number;
  /** skill/burst only: emit `if .char.<action>.ready { ... }` so the step is skipped while on cooldown. */
  skipOnCooldown?: boolean;
}

export interface GroupNode {
  id: string;
  kind: "group";
  children: RNode[];
}

export interface WhileNode {
  id: string;
  kind: "while";
  cond: string;
  children: RNode[];
}

export interface Branch {
  id: string;
  /** Unused for the else branch. */
  cond: string;
  children: RNode[];
}

export interface IfNode {
  id: string;
  kind: "if";
  /** First is `if`, the rest are `else if`. */
  branches: Branch[];
  elseBranch?: Branch;
}

export type RNode = ActionNode | GroupNode | WhileNode | IfNode;
export type BlockKind = "group" | "while" | "if";

export const ROOT = "root";

let nextId = Date.now();
export const uid = () => (nextId++).toString(36);

export function newBlock(kind: BlockKind): RNode {
  if (kind === "if") return { id: uid(), kind, branches: [{ id: uid(), cond: "", children: [] }] };
  if (kind === "while") return { id: uid(), kind, cond: "", children: [] };
  return { id: uid(), kind, children: [] };
}

/** Containers directly owned by a node, as [containerId, children]. */
export function containersOf(n: RNode): [string, RNode[]][] {
  switch (n.kind) {
    case "group":
    case "while":
      return [[n.id, n.children]];
    case "if":
      return [...n.branches, ...(n.elseBranch ? [n.elseBranch] : [])].map((b) => [b.id, b.children]);
    default:
      return [];
  }
}

/** Rebuilds the tree, letting `f` rewrite every container's children (bottom-up). */
export function mapContainers(root: RNode[], f: (children: RNode[], containerId: string) => RNode[]): RNode[] {
  const walk = (children: RNode[], cid: string): RNode[] => f(children.map(walkNode), cid);
  const walkBranch = (b: Branch): Branch => ({ ...b, children: walk(b.children, b.id) });
  const walkNode = (n: RNode): RNode => {
    switch (n.kind) {
      case "group":
      case "while":
        return { ...n, children: walk(n.children, n.id) };
      case "if":
        return { ...n, branches: n.branches.map(walkBranch), elseBranch: n.elseBranch && walkBranch(n.elseBranch) };
      default:
        return n;
    }
  };
  return walk(root, ROOT);
}

/** Finds a node with the id of its container and its index there. */
export function findNode(root: RNode[], id: string): { node: RNode; containerId: string; index: number } | null {
  const search = (children: RNode[], cid: string): ReturnType<typeof findNode> => {
    for (let i = 0; i < children.length; i++) {
      const n = children[i];
      if (n.id === id) return { node: n, containerId: cid, index: i };
      for (const [childCid, list] of containersOf(n)) {
        const hit = search(list, childCid);
        if (hit) return hit;
      }
    }
    return null;
  };
  return search(root, ROOT);
}

export function findContainer(root: RNode[], cid: string): RNode[] | null {
  if (cid === ROOT) return root;
  let found = null as RNode[] | null;
  mapContainers(root, (children, id) => {
    if (id === cid) found = children;
    return children;
  });
  return found;
}

/** Ids of every node and container inside `n` (including n itself). */
export function subtreeIds(n: RNode): Set<string> {
  const ids = new Set<string>([n.id]);
  const walk = (node: RNode) => {
    ids.add(node.id);
    for (const [cid, list] of containersOf(node)) {
      ids.add(cid);
      list.forEach(walk);
    }
  };
  walk(n);
  return ids;
}

export function insertNode(root: RNode[], cid: string, index: number, node: RNode): RNode[] {
  return mapContainers(root, (ch, id) => (id === cid ? [...ch.slice(0, index), node, ...ch.slice(index)] : ch));
}

export function removeNode(root: RNode[], id: string): RNode[] {
  return mapContainers(root, (ch) => ch.filter((n) => n.id !== id));
}

export function updateNode(root: RNode[], id: string, patch: Partial<RNode>): RNode[] {
  return mapContainers(root, (ch) => ch.map((n) => (n.id === id ? ({ ...n, ...patch } as RNode) : n)));
}

/** Deep copy with fresh ids. */
export function cloneNode(n: RNode): RNode {
  const cloneBranch = (b: Branch): Branch => ({ ...b, id: uid(), children: b.children.map(cloneNode) });
  switch (n.kind) {
    case "group":
    case "while":
      return { ...n, id: uid(), children: n.children.map(cloneNode) };
    case "if":
      return { ...n, id: uid(), branches: n.branches.map(cloneBranch), elseBranch: n.elseBranch && cloneBranch(n.elseBranch) };
    default:
      return { ...n, id: uid() };
  }
}

export function duplicateNode(root: RNode[], id: string): RNode[] {
  return mapContainers(root, (ch) => ch.flatMap((n) => (n.id === id ? [n, cloneNode(n)] : [n])));
}

/** Moves a node to `index` of container `cid`; refuses to move a block into itself. */
export function moveNode(root: RNode[], id: string, cid: string, index: number): RNode[] {
  const from = findNode(root, id);
  if (!from || subtreeIds(from.node).has(cid)) return root;
  // Removing first shifts later siblings in the same container one slot left.
  const target = from.containerId === cid && from.index < index ? index - 1 : index;
  return insertNode(removeNode(root, id), cid, target, from.node);
}

/** Removes every action that belongs to `char`. */
export function removeChar(root: RNode[], char: string): RNode[] {
  return mapContainers(root, (ch) => ch.filter((n) => !(n.kind === "action" && n.char === char)));
}

/** Updates an if node's branch (including else) by branch id. */
export function mapIf(root: RNode[], ifId: string, f: (n: IfNode) => IfNode): RNode[] {
  return mapContainers(root, (ch) => ch.map((n) => (n.id === ifId && n.kind === "if" ? f(n) : n)));
}

/** Accepts both the current tree and the old flat list of actions (no `kind`). */
export function migrateRotation(saved: unknown): RNode[] {
  if (!Array.isArray(saved)) return [];
  return saved.map((n) => (n && typeof n === "object" && !("kind" in n) ? { ...n, kind: "action" } : n)) as RNode[];
}
