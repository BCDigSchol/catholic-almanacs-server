import { Component, OnInit, AfterViewInit, Input, OnChanges, OnDestroy, Output, EventEmitter, SimpleChanges, ViewChild, ElementRef, NgZone } from '@angular/core';
import { SpaceNamePipe, spaceName } from '../../../pipes/space-name.pipe';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { DataSet, Network } from "vis-network/standalone";
import { MatIconModule } from '@angular/material/icon';

import { institutionLabel, isUnnamed } from '../../../utils/record-labels';

/** What the details card shows for the clicked node. */
export interface SelectedNode {
  id: string;
  kind: 'Institution' | 'Person' | 'Node';
  label: string;
  unnamed: boolean;
  group: string;
  links: string;
  link: string | null;
}

@Component({
  selector: 'app-network-graph',
  imports: [
    SpaceNamePipe,
    FormsModule,
    RouterLink,
    MatIconModule
  ],
  templateUrl: './network-graph.component.html',
  styleUrl: './network-graph.component.scss'
})
export class NetworkGraphComponent implements OnInit, AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('visNetwork') visNetwork!: ElementRef<HTMLDivElement>;
  @ViewChild('visBar') visBar!: ElementRef<HTMLSpanElement>;
  @ViewChild('visLoadingBar') visLoadingBar!: ElementRef<HTMLDivElement>;
  @ViewChild('visText') visText!: ElementRef<HTMLSpanElement>;

  @Input() label = '';
  /** Draw its own bordered card and title bar. Dashboards pass false and let app-viz-panel frame it. */
  @Input() framed = true;
  /** Show the group key above the graph. Dashboards pass false and render the key in the panel. */
  @Input() showLegend = true;
  /** CSS height of the drawing area; defaults to options.height, else a responsive height. */
  @Input() height = '';
  /** Shown when there is nothing to draw; '' when the host shows its own empty state. */
  @Input() emptyText = 'No connections matched these filters. Try widening the year range or clearing a filter.';
  @Input() data: { nodes: any[]; edges: any[] } = {
    nodes: [],
    edges: []
  };
  @Input() options: any = {};
  @Input() startYear: number | null | undefined = undefined;
  @Input() endYear: number | null | undefined = undefined;
  @Input() minYear = 1500;
  @Input() maxYear = new Date().getFullYear();
  @Input() timeWindowLoading = false;
  // Set when the server capped the response to the most central nodes
  @Input() truncated = false;
  @Input() totalNodes: number | null = null;
  @Output() timeWindowChange = new EventEmitter<{ startYear: number; endYear: number }>();

  network: any;
  isOpen = true;
  graphHeight: string | null = null;
  selected: SelectedNode | null = null;
  /** Touch screens: the graph ignores drags until tapped, so the page can still scroll past it. */
  coarsePointer = typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches;
  touchLocked = this.coarsePointer;
  private themeObserver?: MutationObserver;
  showTimeWindowControls = false;
  timeWindowStartYear: number | null = null;
  timeWindowEndYear: number | null = null;
  timeWindowPlaybackActive = false;
  private isViewInitialized = false;
  private isRestabilizing = false;
  private physicsCooldownTimeout: ReturnType<typeof setTimeout> | null = null;
  private timeWindowDebounceTimeout: ReturnType<typeof setTimeout> | null = null;
  private timeWindowPlaybackInterval: ReturnType<typeof setTimeout> | null = null;
  private dragPhysicsActive = false;
  private currentNodeCount = 0;
  private currentEdgeCount = 0;

  // Client-side exploration state (search, legend, edge-weight filter)
  searchText = '';
  searchMatches: any[] = [];
  searchFocused = false;
  minEdgeWeight = 1;
  maxEdgeWeight = 1;
  legendEntries: { group: string; color: string; hidden: boolean }[] = [];
  isEmpty = false;
  clustered = false;
  private nodesDataSet: DataSet<any> | null = null;
  private edgesDataSet: DataSet<any> | null = null;
  private hiddenGroups = new Set<string>();
  private highlightActive = false;
  private searchBlurTimeout: ReturnType<typeof setTimeout> | null = null;
  protectedData: {
    nodes: any,
    edges: any
  } = {
    nodes: [],
    edges: []
  };
  protectedOptions: any = {
    autoResize: true,
    height: '100%',
    width: '600px',
    locale: 'en',
    clickToUse: false,
    interaction: {
      hover: true,
      hideEdgesOnDrag: true,
      hideEdgesOnZoom: true,
      tooltipDelay: 100
    },
    layout: {
      improvedLayout: true
    },
    physics: {
      enabled: true,
      solver: 'barnesHut',
      stabilization: {
        enabled: true,
        iterations: 600, // was 150, increase for longer initial physics
        updateInterval: 25,
        fit: true
      },
      barnesHut: {
        gravitationalConstant: -3000,
        centralGravity: 0.15,
        springLength: 140,
        springConstant: 0.04,
        damping: 0.18,
        avoidOverlap: 0.2
      }
    },
    nodes: {
        shape: 'dot',
        font: {
            color: '#000000',
            strokeWidth: 4,
            strokeColor: '#ffffff'
        },
        borderWidth: 2,
        scaling: {
          min: 10,
          max: 60,
          label: {
            min: 8,
            max: 20
          }
        },
          shadow: false
    },
    edges: {
        width: 2,
          shadow: false,
          smooth: false,
        font: {
            color: '#000000',
            strokeWidth: 3,
            strokeColor: 'rgba(255, 255, 255, 0.85)'
        },
    },
    groups: {
      institutions: {
        color: {border: '#003B1F', background: '#76B295'},
        shape: 'hexagon',
        size: 40
      },
      people: {
          shape: 'dot',
          color: {border: '#551600', background: '#AA5639'}
      },
    }
  };

  constructor(
    private _router: Router,
    private _ngZone: NgZone
  ) { }

  ngOnInit(): void {
    this.protectedData = this.data ?? { nodes: [], edges: [] };
    this.protectedOptions = Object.assign({}, this.protectedOptions, this.options ?? {});
    this.updateHeight();
    this.applyThemeColors();
    this.syncTimeWindowInputs();
  }

  /* vis draws on a canvas, so its text and default group colours are read
     from the theme tokens and re-read when the theme class changes. */
  private applyThemeColors(): void {
    const css = getComputedStyle(document.body);
    const token = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
    const ink = token('--ink', '#16203a');
    const surface = token('--surface', '#ffffff');
    const font = { color: ink, strokeWidth: 4, strokeColor: surface };
    this.protectedOptions.nodes = { ...this.protectedOptions.nodes, font };
    this.protectedOptions.edges = { ...this.protectedOptions.edges, font: { color: ink, strokeWidth: 3, strokeColor: surface } };
    const groups = { ...(this.protectedOptions.groups ?? {}) };
    for (const [group, tokenName] of [['institutions', '--c-inst'], ['people', '--c-pers']]) {
      if (groups[group]?.themed !== false) {
        const c = token(tokenName, '#888888');
        groups[group] = { ...groups[group], color: { border: surface, background: c, highlight: { border: ink, background: c }, hover: { border: ink, background: c } } };
      }
    }
    this.protectedOptions.groups = groups;
  }

  private updateHeight(): void {
    this.graphHeight = this.height || this.options?.height || null;
    this.protectedOptions.height = '100%';
  }

  unlockTouch(): void {
    this.touchLocked = false;
  }

  lockTouch(): void {
    this.touchLocked = true;
  }

  clearSelection(): void {
    this.selected = null;
    this.network?.unselectAll();
  }

  /* Fills the details card for a clicked node: kind, group, how many of each
     kind it links to in the current view, and a link to its record page. */
  private selectNode(nodeId: any): void {
    const node = this.nodesDataSet?.get(nodeId) as any;
    if (!node) {
      this.selected = null;
      return;
    }
    const kindOf = (n: any) => n?.routeSegment === 'institutions' ? 'Institution' : n?.routeSegment === 'people' ? 'Person' : 'Node';
    const counts = new Map<string, number>();
    for (const id of this.network.getConnectedNodes(nodeId) as any[]) {
      const k = kindOf(this.nodesDataSet?.get(id));
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    const noun = (k: string, n: number) => k === 'Institution' ? (n === 1 ? 'institution' : 'institutions')
      : k === 'Person' ? (n === 1 ? 'person' : 'people') : (n === 1 ? 'node' : 'nodes');
    const parts = [...counts.entries()].map(([k, n]) => `${n.toLocaleString()} ${noun(k, n)}`);
    const groupName = node.diocese ?? (['institutions', 'people'].includes(node.group) ? '' : node.group);
    this.selected = {
      id: String(node.id),
      kind: kindOf(node),
      label: node.label ?? String(node.id),
      unnamed: !!node.unnamed,
      group: groupName && groupName !== 'Unknown' ? `Diocese of ${spaceName(groupName)}` : '',
      links: parts.length ? `Linked to ${parts.join(' and ')} in this view` : 'No links in this view',
      link: node.routeSegment ? `/${node.routeSegment}/${node.id}` : null,
    };
  }

  ngAfterViewInit(): void {
    this.isViewInitialized = true;
    const container = this.visNetwork.nativeElement;
    this.network = new Network(container, {
      nodes: new DataSet<any>([]),
      edges: new DataSet<any>([])
    }, { ...this.protectedOptions, width: '100%', height: '100%' });

    // Follow theme switches (a class on <body>) without rebuilding the graph.
    this.themeObserver = new MutationObserver(() => {
      this.applyThemeColors();
      this.network?.setOptions({ nodes: this.protectedOptions.nodes, edges: this.protectedOptions.edges, groups: this.protectedOptions.groups });
    });
    this.themeObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    // Single click selects (vis default); double click navigates to the
    // entity's detail page so stray clicks don't yank the user off the graph
    // Single click on a cluster bubble expands it back into its members
    this.network.on('click', (properties: any) => {
      const clickedNodeId = properties.nodes?.[0];
      if (clickedNodeId && this.network.isCluster(clickedNodeId)) {
        this.network.openCluster(clickedNodeId);
        // Let the freed members spread out instead of stacking at the bubble's spot
        this.restartPhysics();
        return;
      }
      this._ngZone.run(() => clickedNodeId ? this.selectNode(clickedNodeId) : this.selected = null);
    });
    this.network.on('doubleClick', (properties: any) => {
      const clickedNodeId = properties.nodes?.[0] ?? this.network.getNodeAt(properties.pointer?.DOM);
      if (!clickedNodeId || this.network.isCluster(clickedNodeId)) {
        return;
      }

      const clickedNode = this.network.body?.data?.nodes?.get(clickedNodeId);
      if (!clickedNode?.id) {
        return;
      }

      const routeSegment = clickedNode.routeSegment;
      if (!routeSegment) {
        return;
      }
      this._ngZone.run(() => {
        this._router.navigate([`/${routeSegment}/${clickedNode.id}`]);
      });
    });
    this.network.on('hoverNode', (params: any) => {
      this.highlightNeighborhood(params.node);
    });
    this.network.on('blurNode', () => {
      this.clearHighlight();
    });
    this.network.on('dragStart', (params: any) => {
      if (params.nodes?.length > 0) {
        // Enable physics when user drags a node for refinement
        this.network.setOptions({ physics: { enabled: true, stabilization: { enabled: true, iterations: 250, updateInterval: 20, fit: false } } });
        this.network.startSimulation();
        this.isRestabilizing = true;
      }
    });
    this.network.on('dragEnd', (params: any) => {
      if (params.nodes?.length > 0) {
        // Let physics run briefly, then freeze
        setTimeout(() => {
          this.network.setOptions({ physics: { enabled: false } });
        }, 1200);
        this.hideLoadingBar();
      }
    });
    this.network.on("stabilizationProgress", (params: any) => {
      const widthFactor = params.total > 0 ? params.iterations / params.total : 1;
      this.visBar.nativeElement.style.width = Math.round(widthFactor * 100) + '%';
      this.visText.nativeElement.textContent = 'Laying out ' + Math.round(widthFactor * 100) + '%';
    });
    this.network.on("stabilizationIterationsDone", () => {
      // Only hide loading bar when physics is fully stabilized
      this.hideLoadingBar();
      // Frame the settled layout so every node is visible from the start.
      this.fitAll();
    });

    // Deferred so the template state it sets (isEmpty, legend, slider bounds)
    // lands after the first change-detection pass (avoids NG0100)
    setTimeout(() => this.applyNetworkState());
  }

  /**
   * Toggles the visibility of the map panel. If opened, initializes the map.
   */
  togglePanel(): void {
    this.isOpen = !this.isOpen;

    if (this.isOpen) {
      setTimeout(() => {
        if (!this.network) {
          return;
        }

        this.network.setOptions({
          autoResize: true,
          width: '100%'
        });
        this.network.redraw();
        this.fitAll();
      }, 0);
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['data']?.currentValue) {
      this.protectedData = {
        nodes: changes['data'].currentValue.nodes ?? [],
        edges: changes['data'].currentValue.edges ?? []
      };
    }

    if (changes['options']?.currentValue) {
      this.protectedOptions = Object.assign({}, this.protectedOptions, changes['options'].currentValue);
      this.applyThemeColors();
    }
    if (changes['options'] || changes['height']) {
      this.updateHeight();
    }

    if (
      changes['startYear'] ||
      changes['endYear'] ||
      changes['minYear'] ||
      changes['maxYear']
    ) {
      this.syncTimeWindowInputs();
    }

    // Only rebuild the graph when its data or styling actually changed —
    // not when unrelated inputs (like the loading flag) flip mid-fetch
    if (this.isViewInitialized && this.network && (changes['data'] || changes['options'])) {
      this.applyNetworkState(false);
      if (changes['data']) {
        // New filter results: re-run the force layout so the graph settles visibly
        this.restartPhysics();
      }
    }
  }

  ngOnDestroy(): void {
    this.stopTimeWindowPlayback();
    if (this.timeWindowDebounceTimeout) {
      clearTimeout(this.timeWindowDebounceTimeout);
      this.timeWindowDebounceTimeout = null;
    }
    if (this.physicsCooldownTimeout) {
      clearTimeout(this.physicsCooldownTimeout);
      this.physicsCooldownTimeout = null;
    }
    if (this.searchBlurTimeout) {
      clearTimeout(this.searchBlurTimeout);
      this.searchBlurTimeout = null;
    }
    this.themeObserver?.disconnect();
    this.network?.destroy();
  }

  onTimeWindowInputChange(): void {
    this.stopTimeWindowPlayback();
    this.queueTimeWindowEmit();
  }

  toggleTimeWindowPlayback(): void {
    if (!this.showTimeWindowControls) {
      return;
    }

    if (this.timeWindowPlaybackActive) {
      this.stopTimeWindowPlayback();
      return;
    }

    const initialWindow = this.getNormalizedTimeWindow();
    if (!initialWindow) {
      return;
    }

    const windowWidth = initialWindow.endYear - initialWindow.startYear;
    this.timeWindowPlaybackActive = true;
    this.emitTimeWindowChange();
    this.timeWindowPlaybackInterval = setInterval(() => {
      if (this.timeWindowLoading) {
        return;
      }

      const currentWindow = this.getNormalizedTimeWindow();
      if (!currentWindow || currentWindow.endYear >= this.maxYear) {
        this.stopTimeWindowPlayback();
        return;
      }

      const nextEndYear = Math.min(this.maxYear, currentWindow.endYear + 1);
      const nextStartYear = Math.max(this.minYear, nextEndYear - windowWidth);
      this.timeWindowStartYear = nextStartYear;
      this.timeWindowEndYear = nextEndYear;
      this.emitTimeWindowChange();
    }, 900);
  }

  private syncTimeWindowInputs(): void {
    const normalizedStart = this.normalizeTimeWindowYear(this.startYear);
    const normalizedEnd = this.normalizeTimeWindowYear(this.endYear);
    this.showTimeWindowControls = normalizedStart !== null || normalizedEnd !== null;

    if (!this.showTimeWindowControls) {
      this.stopTimeWindowPlayback();
      this.timeWindowStartYear = null;
      this.timeWindowEndYear = null;
      return;
    }

    const resolvedStart = normalizedStart ?? normalizedEnd;
    const resolvedEnd = normalizedEnd ?? normalizedStart;

    if (resolvedStart === null || resolvedEnd === null) {
      this.showTimeWindowControls = false;
      return;
    }

    this.timeWindowStartYear = resolvedStart;
    this.timeWindowEndYear = Math.max(resolvedStart, resolvedEnd);
  }

  private normalizeTimeWindowYear(value: unknown): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    const parsed = Number(value);
    if (Number.isNaN(parsed)) {
      return null;
    }

    return Math.max(this.minYear, Math.min(this.maxYear, parsed));
  }

  private getNormalizedTimeWindow(): { startYear: number; endYear: number } | null {
    if (!this.showTimeWindowControls) {
      return null;
    }

    const startYear = this.normalizeTimeWindowYear(this.timeWindowStartYear);
    const endYear = this.normalizeTimeWindowYear(this.timeWindowEndYear);
    if (startYear === null && endYear === null) {
      return null;
    }

    const resolvedStart = startYear ?? endYear;
    const resolvedEnd = endYear ?? startYear;
    if (resolvedStart === null || resolvedEnd === null) {
      return null;
    }

    return {
      startYear: resolvedStart,
      endYear: Math.max(resolvedStart, resolvedEnd)
    };
  }

  private queueTimeWindowEmit(): void {
    if (this.timeWindowDebounceTimeout) {
      clearTimeout(this.timeWindowDebounceTimeout);
    }

    this.timeWindowDebounceTimeout = setTimeout(() => {
      this.timeWindowDebounceTimeout = null;
      this.emitTimeWindowChange();
    }, 350);
  }

  private emitTimeWindowChange(): void {
    const window = this.getNormalizedTimeWindow();
    if (!window) {
      return;
    }

    this.timeWindowStartYear = window.startYear;
    this.timeWindowEndYear = window.endYear;
    this.timeWindowChange.emit(window);
  }

  private stopTimeWindowPlayback(): void {
    this.timeWindowPlaybackActive = false;
    if (this.timeWindowPlaybackInterval) {
      clearInterval(this.timeWindowPlaybackInterval);
      this.timeWindowPlaybackInterval = null;
    }
  }

  /* "not recorded" institution names read as "Unnamed church" etc. */
  private labelNodes(nodes: any[]): any[] {
    return nodes.map(node => node.routeSegment === 'institutions' && isUnnamed(node.label)
      ? { ...node, label: institutionLabel(node.label, node.instType), unnamed: true }
      : node);
  }

  private resolveHtmlTitles(items: any[]): any[] {
    return items.map(item => {
      if (typeof item.title !== 'string' || !/<[a-z][\s\S]*>/i.test(item.title)) {
        return item;
      }
      const el = document.createElement('div');
      el.innerHTML = item.title;
      return { ...item, title: el };
    });
  }

  private applyNetworkState(showLoading = true): void {
    const nodes = this.resolveHtmlTitles(this.labelNodes(this.protectedData?.nodes ?? []));
    const edges = this.resolveHtmlTitles(this.protectedData?.edges ?? []);
    this.currentNodeCount = nodes.length;
    this.currentEdgeCount = edges.length;
    const effectiveOptions = this.getEffectiveOptions(nodes.length, edges.length);

    // Restore force-directed physics (barnesHut) for initial layout
    this.network.setOptions({
      ...effectiveOptions,
      physics: {
        enabled: true,
        solver: 'barnesHut',
        barnesHut: {
          gravitationalConstant: -3000,
          centralGravity: 0.15,
          springLength: 140,
          springConstant: 0.04,
          damping: 0.18,
          avoidOverlap: 0.2
        },
        stabilization: {
          enabled: true,
          iterations: 300,
          updateInterval: 25,
          fit: true
        }
      },
      layout: { improvedLayout: false }
    });
    this.nodesDataSet = new DataSet<any>(nodes);
    this.edgesDataSet = new DataSet<any>(edges);
    this.network.setData({
      nodes: this.nodesDataSet,
      edges: this.edgesDataSet
    });

    // Fresh data resets the client-side exploration state
    this.isEmpty = nodes.length === 0;
    this.selected = null;
    this.clustered = false;
    this.highlightActive = false;
    this.searchText = '';
    this.searchMatches = [];
    this.hiddenGroups.clear();
    this.maxEdgeWeight = edges.reduce((max: number, e: any) => Math.max(max, Number(e.weight) || 1), 1);
    this.minEdgeWeight = 1;
    this.legendEntries = this.buildLegend(nodes);

    if (showLoading && !this.isEmpty) {
      this.showLoadingBar();
    }
    if (this.isEmpty) {
      this.hideLoadingBar();
    }
  }

  /**
   * Frame the whole graph: fit every node into view, then back off slightly so
   * nothing sits on the edge. vis' own `fit` can land zoomed-IN on a compact
   * graph (or run before the container has its final size), so we re-fit on a
   * later frame and never start closer than ~1:1.
   */
  private fitAll(): void {
    if (!this.network) return;
    requestAnimationFrame(() => {
      if (!this.network) return;
      try {
        this.network.fit({ animation: false });
        const scale = this.network.getScale();
        const target = Math.min(scale, 1) * 0.9;   // cap the zoom, keep a margin
        if (Math.abs(target - scale) > 0.001) {
          this.network.moveTo({
            position: this.network.getViewPosition(),
            scale: target,
            animation: false
          });
        }
      } catch { /* network torn down between frames */ }
    });
  }

  private restartPhysics(): void {
    if (!this.network || (this.currentNodeCount === 0 && this.currentEdgeCount === 0)) {
      this.hideLoadingBar();
      return;
    }

    if (this.physicsCooldownTimeout) {
      clearTimeout(this.physicsCooldownTimeout);
      this.physicsCooldownTimeout = null;
    }

    this.isRestabilizing = true;
    this.dragPhysicsActive = true;
    const effectiveOptions = this.getEffectiveOptions(this.currentNodeCount, this.currentEdgeCount);
    this.network.setOptions({
      physics: Object.assign({}, effectiveOptions.physics, {
        enabled: true,
        stabilization: Object.assign({}, effectiveOptions.physics?.stabilization, {
          iterations: this.currentNodeCount > 75 ? 400 : 250,
          updateInterval: 10,
          fit: false
        }),
        barnesHut: Object.assign({}, effectiveOptions.physics?.barnesHut, {
          centralGravity: 0.02,
          springLength: this.currentNodeCount > 75 ? 180 : 220,
          springConstant: 0.02,
          damping: 0.35
        })
      }),
      layout: Object.assign({}, effectiveOptions.layout, {
        improvedLayout: false
      })
    });
    this.network.startSimulation();
    this.physicsCooldownTimeout = setTimeout(() => {
      this.dragPhysicsActive = false;
      this.network.stopSimulation();
      this.hideLoadingBar();
      // Re-frame the settled layout
      this.fitAll();
      this.physicsCooldownTimeout = null;
    }, 3500);
  }

  private getEffectiveOptions(nodeCount: number, edgeCount: number) {
    const isLargeGraph = nodeCount > 75 || edgeCount > 150;

    if (!isLargeGraph) {
      return Object.assign({}, this.protectedOptions, {
        autoResize: true,
        width: '100%'
      });
    }

    return Object.assign({}, this.protectedOptions, {
      autoResize: true,
      width: '100%',
      layout: Object.assign({}, this.protectedOptions.layout, {
        improvedLayout: false
      }),
      physics: Object.assign({}, this.protectedOptions.physics, {
        stabilization: {
          enabled: true,
          iterations: 80,
          updateInterval: 20,
          fit: true
        },
        barnesHut: Object.assign({}, this.protectedOptions.physics?.barnesHut, {
          springLength: 110,
          damping: 0.24
        })
      }),
      nodes: Object.assign({}, this.protectedOptions.nodes, {
        shadow: false,
        scaling: {
          label: {
            min: 8,
            max: 16
          }
        }
      }),
      edges: Object.assign({}, this.protectedOptions.edges, {
        shadow: false,
        smooth: false,
        width: 1
      })
    });
  }

  /* One legend entry per group present in the data, colored like its nodes.
     Group colors come from the options the parent built (or vis defaults). */
  private buildLegend(nodes: any[]): { group: string; color: string; hidden: boolean }[] {
    const groupOptions: any = (this.protectedOptions as any).groups ?? {};
    const seen = new Map<string, string>();
    for (const node of nodes) {
      const group = node.group ?? 'Unknown';
      if (!seen.has(group)) {
        seen.set(group, groupOptions[group]?.color?.background ?? '#97c2fc');
      }
    }
    return Array.from(seen.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([group, color]) => ({ group, color, hidden: false }));
  }

  /** Shows or hides one group's nodes (for a key rendered outside the graph). */
  setGroupHidden(group: string, hidden: boolean): void {
    const entry = this.legendEntries.find(e => e.group === group);
    if (entry && entry.hidden !== hidden) this.toggleLegendGroup(entry);
  }

  toggleLegendGroup(entry: { group: string; color: string; hidden: boolean }): void {
    entry.hidden = !entry.hidden;
    if (entry.hidden) {
      this.hiddenGroups.add(entry.group);
    } else {
      this.hiddenGroups.delete(entry.group);
    }
    this.applyClientFilters();
  }

  onMinWeightChange(): void {
    this.applyClientFilters();
  }

  /* Applies the legend toggles and the minimum-edge-weight threshold by
     flipping `hidden` flags on the DataSets — no refetch, no relayout. */
  private applyClientFilters(): void {
    if (!this.nodesDataSet || !this.edgesDataSet) {
      return;
    }

    const nodes = this.nodesDataSet.get();
    const edges = this.edgesDataSet.get();
    const groupVisible = (node: any) => !this.hiddenGroups.has(node.group ?? 'Unknown');

    const nodeVisibility = new Map<string, boolean>();
    for (const node of nodes) {
      nodeVisibility.set(node.id, groupVisible(node));
    }

    const visibleDegree = new Map<string, number>();
    const edgeUpdates = edges.map((edge: any) => {
      const visible = (Number(edge.weight) || 1) >= this.minEdgeWeight
        && nodeVisibility.get(edge.from) === true
        && nodeVisibility.get(edge.to) === true;
      if (visible) {
        visibleDegree.set(edge.from, (visibleDegree.get(edge.from) ?? 0) + 1);
        visibleDegree.set(edge.to, (visibleDegree.get(edge.to) ?? 0) + 1);
      }
      return { id: edge.id, hidden: !visible };
    });

    // When the weight filter prunes edges, also hide nodes it orphaned
    // (except ego-network targets, which should always stay visible)
    const nodeUpdates = nodes.map((node: any) => {
      let visible = nodeVisibility.get(node.id) === true;
      if (visible && this.minEdgeWeight > 1 && !node.isTarget) {
        visible = (visibleDegree.get(node.id) ?? 0) > 0;
      }
      return { id: node.id, hidden: !visible };
    });

    this.edgesDataSet.update(edgeUpdates);
    this.nodesDataSet.update(nodeUpdates);
  }

  /* Dims everything outside the hovered node's direct neighborhood. */
  private highlightNeighborhood(nodeId: any): void {
    if (!this.nodesDataSet || !this.edgesDataSet || !this.network) {
      return;
    }

    const neighborhood = new Set<any>(this.network.getConnectedNodes(nodeId));
    neighborhood.add(nodeId);

    this.nodesDataSet.update(
      this.nodesDataSet.get().map((node: any) => ({
        id: node.id,
        opacity: neighborhood.has(node.id) ? 1 : 0.15
      }))
    );
    this.edgesDataSet.update(
      this.edgesDataSet.get().map((edge: any) => ({
        id: edge.id,
        color: { opacity: edge.from === nodeId || edge.to === nodeId ? 1 : 0.08 }
      }))
    );
    this.highlightActive = true;
  }

  private clearHighlight(): void {
    if (!this.highlightActive || !this.nodesDataSet || !this.edgesDataSet) {
      return;
    }
    this.nodesDataSet.update(
      this.nodesDataSet.get().map((node: any) => ({ id: node.id, opacity: 1 }))
    );
    this.edgesDataSet.update(
      this.edgesDataSet.get().map((edge: any) => ({ id: edge.id, color: { opacity: 1 } }))
    );
    this.highlightActive = false;
  }

  /* Collapses each group into a single bubble sized by member count.
     Clicking a bubble re-expands that group; the button restores all. */
  toggleClustering(): void {
    if (!this.network) {
      return;
    }
    if (this.clustered) {
      for (const entry of this.legendEntries) {
        const clusterId = `cluster:${entry.group}`;
        if (this.network.isCluster(clusterId)) {
          this.network.openCluster(clusterId);
        }
      }
      this.clustered = false;
      this.network.fit({ animation: true });
      this.restartPhysics();
      return;
    }

    this.clearHighlight();
    for (const entry of this.legendEntries) {
      const group = entry.group;
      this.network.cluster({
        joinCondition: (nodeOptions: any) => (nodeOptions.group ?? 'Unknown') === group,
        processProperties: (clusterOptions: any, childNodes: any[]) => {
          clusterOptions.label = `${spaceName(group)} (${childNodes.length})`;
          clusterOptions.value = childNodes.length;
          return clusterOptions;
        },
        clusterNodeProperties: {
          id: `cluster:${group}`,
          shape: 'dot',
          color: { background: entry.color, border: this.protectedOptions.nodes.font.color },
          borderWidth: 3,
          font: { ...this.protectedOptions.nodes.font, size: 16 }
        }
      });
    }
    this.clustered = true;
    this.network.fit({ animation: true });
    // Re-run the force layout briefly so the bubbles arrange themselves
    this.restartPhysics();
  }

  onSearchChange(): void {
    const query = this.searchText.trim().toLowerCase();
    if (!query || !this.nodesDataSet) {
      this.searchMatches = [];
      return;
    }
    this.searchMatches = this.nodesDataSet.get()
      .filter((node: any) => String(node.label ?? '').toLowerCase().includes(query))
      .slice(0, 8);
  }

  onSearchBlur(): void {
    // Delay so a click on a result still lands before the list closes
    this.searchBlurTimeout = setTimeout(() => {
      this.searchFocused = false;
    }, 150);
  }

  onSearchFocus(): void {
    if (this.searchBlurTimeout) {
      clearTimeout(this.searchBlurTimeout);
      this.searchBlurTimeout = null;
    }
    this.searchFocused = true;
  }

  selectSearchResult(node: any): void {
    if (!this.network) {
      return;
    }
    this.searchText = node.label ?? '';
    this.searchMatches = [];
    this.network.selectNodes([node.id]);
    this.network.focus(node.id, {
      scale: 1.2,
      animation: { duration: 600, easingFunction: 'easeInOutQuad' }
    });
    this.highlightNeighborhood(node.id);
  }

  clearSearch(): void {
    this.searchText = '';
    this.searchMatches = [];
    this.clearHighlight();
    if (this.network) {
      this.network.unselectAll();
      this.network.fit({ animation: true });
    }
  }

  private showLoadingBar(): void {
    this.visLoadingBar.nativeElement.style.display = 'flex';
    this.visLoadingBar.nativeElement.style.opacity = '1';
    this.visBar.nativeElement.style.width = '0';
    this.visText.nativeElement.textContent = 'Laying out 0%';
  }

  private hideLoadingBar(): void {
    if (this.currentNodeCount > 0 || this.currentEdgeCount > 0) {
      this.network.setOptions({ physics: false });
    }

    this.isRestabilizing = false;

    this.visText.nativeElement.textContent = 'Laying out 100%';
    this.visBar.nativeElement.style.width = '100%';
    this.visLoadingBar.nativeElement.style.opacity = '0';
    setTimeout(() => {
      this.visLoadingBar.nativeElement.style.display = 'none';
    }, 500);
  }


}