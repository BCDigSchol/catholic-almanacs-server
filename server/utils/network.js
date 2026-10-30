// Shared helpers for the network graph endpoints.

const DEFAULT_NODE_LIMIT = 500;
const MAX_NODE_LIMIT = 2000;

/* Parses an optional integer query param.
   Returns { value: number|null } or { error: string }. */
function parseIntParam(raw, name) {
    if (raw === undefined || raw === null || raw === '') return { value: null };
    const value = Number(raw);
    if (!Number.isInteger(value)) {
        return { error: `Query parameter '${name}' must be an integer, got '${raw}'.` };
    }
    return { value };
}

/* Validates startYear/endYear/limit from a query object.
   Returns { startYear, endYear, limit } or { error }. */
function parseNetworkParams(query) {
    const start = parseIntParam(query.startYear, 'startYear');
    if (start.error) return { error: start.error };
    const end = parseIntParam(query.endYear, 'endYear');
    if (end.error) return { error: end.error };
    if (start.value != null && end.value != null && start.value > end.value) {
        return { error: `startYear (${start.value}) must not be greater than endYear (${end.value}).` };
    }
    const limit = parseIntParam(query.limit, 'limit');
    if (limit.error) return { error: limit.error };
    if (limit.value != null && limit.value < 1) {
        return { error: `Query parameter 'limit' must be a positive integer.` };
    }
    return {
        startYear: start.value,
        endYear: end.value,
        limit: Math.min(limit.value || DEFAULT_NODE_LIMIT, MAX_NODE_LIMIT)
    };
}

/* Weighted PageRank over an undirected edge list ({from, to, weight}).
   Returns a map of nodeID -> score normalized to [0, 1]. */
function computePageRank(nodeIDs, edgeList, { damping = 0.85, iterations = 50 } = {}) {
    const N = nodeIDs.length;
    if (N === 0) return {};

    const neighbors = {};
    const weightedDegree = {};
    for (const id of nodeIDs) { neighbors[id] = []; weightedDegree[id] = 0; }
    for (const e of edgeList) {
        const w = e.weight;
        neighbors[e.from].push({ id: e.to, weight: w });
        neighbors[e.to].push({ id: e.from, weight: w });
        weightedDegree[e.from] += w;
        weightedDegree[e.to] += w;
    }

    let pr = {};
    for (const id of nodeIDs) pr[id] = 1 / N;

    for (let i = 0; i < iterations; i++) {
        const newPr = {};
        for (const id of nodeIDs) {
            let rank = (1 - damping) / N;
            for (const { id: neighborID, weight } of neighbors[id]) {
                if (weightedDegree[neighborID] > 0) {
                    rank += damping * pr[neighborID] * (weight / weightedDegree[neighborID]);
                }
            }
            newPr[id] = rank;
        }
        pr = newPr;
    }

    const prValues = Object.values(pr);
    const prMin = Math.min(...prValues);
    const prRange = (Math.max(...prValues) - prMin) || 1;
    for (const id of nodeIDs) {
        pr[id] = (pr[id] - prMin) / prRange;
    }
    return pr;
}

/* Keeps only the top `limit` nodes by pageRank (ties broken by id for
   determinism) and drops edges touching removed nodes. Nodes whose every
   edge was cut are dropped too, so the truncated graph contains no orphans. */
function truncateToTopNodes(nodes, edges, limit) {
    if (nodes.length <= limit) {
        return { nodes, edges, truncated: false, totalNodes: nodes.length };
    }
    const kept = [...nodes]
        .sort((a, b) => (b.pageRank - a.pageRank) || String(a.id).localeCompare(String(b.id)))
        .slice(0, limit);
    const keptIDs = new Set(kept.map(n => n.id));
    const keptEdges = edges.filter(e => keptIDs.has(e.from) && keptIDs.has(e.to));

    const connectedIDs = new Set();
    for (const e of keptEdges) {
        connectedIDs.add(e.from);
        connectedIDs.add(e.to);
    }
    const connectedNodes = kept.filter(n => connectedIDs.has(n.id));

    return {
        // Safety valve: if no edges survived at all, fall back to the top nodes
        nodes: connectedNodes.length ? connectedNodes : kept,
        edges: keptEdges,
        truncated: true,
        totalNodes: nodes.length
    };
}

const FOCUS_NODE_LIMIT = 400;
const GROUP_COUNT = 12;

/* The response of a network endpoint, shaped by the query:
     ?focus=<node id>&hops=1|2|all  the neighbourhood of one node, from the
       whole network (not the PageRank cut): every node within `hops` links
       (all = its whole connected group), capped at FOCUS_NODE_LIMIT nearest
       then most central; the focus node is marked `isTarget`, every node
       carries its `distance`
     otherwise  the top `limit` nodes by PageRank (truncateToTopNodes)
   Either way `groups` lists the whole network's largest connected groups
   (size, the most central member as id/label, their dioceses), and `focus`
   says whether the focus node was found under the filters. */
function shapeNetwork(nodes, edges, query, limit) {
    const byId = new Map(nodes.map(n => [n.id, n]));
    const adj = new Map(nodes.map(n => [n.id, []]));
    for (const e of edges) {
        adj.get(e.from)?.push(e.to);
        adj.get(e.to)?.push(e.from);
    }

    // connected groups
    const groupOf = new Map();
    const members = [];
    for (const n of nodes) {
        if (groupOf.has(n.id)) continue;
        const list = [n.id];
        groupOf.set(n.id, members.length);
        for (let i = 0; i < list.length; i++) {
            for (const m of adj.get(list[i]) || []) {
                if (!groupOf.has(m)) { groupOf.set(m, members.length); list.push(m); }
            }
        }
        members.push(list);
    }
    const groups = members
        .filter(list => list.length > 1)
        .sort((a, b) => b.length - a.length)
        .slice(0, GROUP_COUNT)
        .map(list => {
            const top = list.map(id => byId.get(id)).sort((a, b) => (b.pageRank || 0) - (a.pageRank || 0))[0];
            const dioceses = new Map();
            for (const id of list) {
                const n = byId.get(id);
                const d = n.diocese || (['people', 'institutions'].includes(n.group) ? null : n.group);
                if (d && d !== 'Unknown') dioceses.set(d, (dioceses.get(d) || 0) + 1);
            }
            return {
                id: top.id, label: top.label, size: list.length,
                dioceses: [...dioceses.entries()].sort((a, b) => b[1] - a[1]).map(([d]) => d),
            };
        });

    const focus = query.focus ? String(query.focus) : '';
    if (!focus) return { ...truncateToTopNodes(nodes, edges, limit), groups };
    if (!byId.has(focus)) {
        return { ...truncateToTopNodes(nodes, edges, limit), groups, focus: { id: focus, found: false } };
    }
    const hops = query.hops === 'all' ? Infinity : Number(query.hops) === 2 ? 2 : 1;
    const distance = new Map([[focus, 0]]);
    const queue = [focus];
    for (let i = 0; i < queue.length; i++) {
        const d = distance.get(queue[i]);
        if (d >= hops) continue;
        for (const m of adj.get(queue[i]) || []) {
            if (!distance.has(m)) { distance.set(m, d + 1); queue.push(m); }
        }
    }
    const reached = [...distance.keys()];
    const kept = reached.length <= FOCUS_NODE_LIMIT ? reached : reached
        .sort((a, b) => distance.get(a) - distance.get(b) || (byId.get(b).pageRank || 0) - (byId.get(a).pageRank || 0))
        .slice(0, FOCUS_NODE_LIMIT);
    const keep = new Set(kept);
    return {
        nodes: kept.map(id => ({ ...byId.get(id), distance: distance.get(id), ...(id === focus ? { isTarget: true } : {}) })),
        edges: edges.filter(e => keep.has(e.from) && keep.has(e.to)),
        truncated: kept.length < reached.length,
        totalNodes: reached.length,
        groups,
        focus: { id: focus, found: true, label: byId.get(focus).label, hops: query.hops === 'all' ? 'all' : hops },
    };
}

/* Small in-memory TTL cache for expensive network responses. The almanac
   data is effectively read-only, so a short TTL is only a safety valve. */
class TtlCache {
    constructor({ maxEntries = 100, ttlMs = 10 * 60 * 1000 } = {}) {
        this.maxEntries = maxEntries;
        this.ttlMs = ttlMs;
        this.map = new Map();
    }

    get(key) {
        const entry = this.map.get(key);
        if (!entry) return undefined;
        if (Date.now() > entry.expires) {
            this.map.delete(key);
            return undefined;
        }
        // refresh recency for LRU eviction
        this.map.delete(key);
        this.map.set(key, entry);
        return entry.value;
    }

    set(key, value) {
        if (this.map.size >= this.maxEntries) {
            this.map.delete(this.map.keys().next().value);
        }
        this.map.set(key, { value, expires: Date.now() + this.ttlMs });
    }
}

const networkCache = new TtlCache();

/* Stable cache key from a route name and the query params that affect it. */
function cacheKey(route, query) {
    const parts = Object.keys(query).sort().map(k => `${k}=${query[k]}`);
    return `${route}?${parts.join('&')}`;
}

module.exports = {
    parseNetworkParams,
    parseIntParam,
    computePageRank,
    truncateToTopNodes,
    shapeNetwork,
    networkCache,
    cacheKey,
    DEFAULT_NODE_LIMIT,
    MAX_NODE_LIMIT
};
