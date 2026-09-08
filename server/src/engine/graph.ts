/**
 * Dependency graph over itinerary nodes.
 *
 * Small, explicit, and dependency-free — the trip is a DAG of at most a few
 * dozen bookings, so adjacency maps beat pulling in graphlib.
 */
import type { Trip, TripEdge, TripNode } from '../types.js';
import { ms } from './time.js';

export class TripGraph {
  readonly nodes: Map<string, TripNode>;
  readonly edges: TripEdge[];
  private readonly out: Map<string, TripEdge[]>;
  private readonly inc: Map<string, TripEdge[]>;

  constructor(nodes: TripNode[], edges: TripEdge[]) {
    this.nodes = new Map(nodes.map((n) => [n.id, n]));
    this.edges = edges.filter((e) => this.nodes.has(e.from) && this.nodes.has(e.to));
    this.out = new Map();
    this.inc = new Map();
    for (const e of this.edges) {
      if (!this.out.has(e.from)) this.out.set(e.from, []);
      if (!this.inc.has(e.to)) this.inc.set(e.to, []);
      this.out.get(e.from)!.push(e);
      this.inc.get(e.to)!.push(e);
    }
  }

  static of(trip: Trip): TripGraph {
    return new TripGraph(trip.nodes, trip.edges);
  }

  node(id: string): TripNode {
    const n = this.nodes.get(id);
    if (!n) throw new Error(`Unknown node: ${id}`);
    return n;
  }

  outgoing(id: string): TripEdge[] {
    return this.out.get(id) ?? [];
  }

  incoming(id: string): TripEdge[] {
    return this.inc.get(id) ?? [];
  }

  /** Every node reachable downstream of `id`, with its hop distance. */
  downstream(id: string): Map<string, number> {
    const seen = new Map<string, number>();
    const queue: [string, number][] = [[id, 0]];
    while (queue.length) {
      const [current, hops] = queue.shift()!;
      for (const edge of this.outgoing(current)) {
        const prior = seen.get(edge.to);
        if (prior !== undefined && prior <= hops + 1) continue;
        seen.set(edge.to, hops + 1);
        queue.push([edge.to, hops + 1]);
      }
    }
    seen.delete(id);
    return seen;
  }

  /** Shortest dependency path from `from` to `to`, inclusive of both. */
  path(from: string, to: string): string[] {
    const prev = new Map<string, string>();
    const queue = [from];
    const visited = new Set([from]);
    while (queue.length) {
      const current = queue.shift()!;
      if (current === to) break;
      for (const edge of this.outgoing(current)) {
        if (visited.has(edge.to)) continue;
        visited.add(edge.to);
        prev.set(edge.to, current);
        queue.push(edge.to);
      }
    }
    if (!visited.has(to)) return [from, to];
    const chain = [to];
    let cursor = to;
    while (cursor !== from) {
      const p = prev.get(cursor);
      if (!p) break;
      chain.unshift(p);
      cursor = p;
    }
    return chain;
  }

  /** Topological order, falling back to chronological order for ties. */
  topological(): TripNode[] {
    const indegree = new Map<string, number>();
    for (const n of this.nodes.keys()) indegree.set(n, 0);
    for (const e of this.edges) indegree.set(e.to, (indegree.get(e.to) ?? 0) + 1);

    const ready = [...indegree.entries()]
      .filter(([, d]) => d === 0)
      .map(([id]) => id)
      .sort((a, b) => ms(this.node(a).start) - ms(this.node(b).start));

    const ordered: TripNode[] = [];
    while (ready.length) {
      ready.sort((a, b) => ms(this.node(a).start) - ms(this.node(b).start));
      const id = ready.shift()!;
      ordered.push(this.node(id));
      for (const edge of this.outgoing(id)) {
        const next = (indegree.get(edge.to) ?? 1) - 1;
        indegree.set(edge.to, next);
        if (next === 0) ready.push(edge.to);
      }
    }

    // Cycle safety net: append anything the sort could not reach.
    if (ordered.length !== this.nodes.size) {
      for (const n of this.nodes.values()) {
        if (!ordered.some((o) => o.id === n.id)) ordered.push(n);
      }
    }
    return ordered;
  }

  /**
   * How many downstream items depend on each node — used by the risk engine to
   * spot single points of failure.
   */
  blastRadius(): Map<string, number> {
    const radius = new Map<string, number>();
    for (const id of this.nodes.keys()) radius.set(id, this.downstream(id).size);
    return radius;
  }
}

/**
 * The instant a node hands control to whatever depends on it.
 *
 * For most bookings that is when they end. A hotel hands off twice: check-in is
 * what unblocks the evening's plans (ENABLES), while check-out is what releases
 * you to the airport (REQUIRES). Passing the edge picks the right one.
 */
export function readyTime(node: TripNode, edge?: TripEdge): string {
  if (node.kind !== 'HOTEL') return node.end;
  return edge && edge.type !== 'ENABLES' ? node.end : node.start;
}
