import { Component, OnInit, AfterViewInit, Input, OnChanges, OnDestroy, Output, EventEmitter, SimpleChanges, ViewChild, ElementRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DataSet, Network } from "vis-network/standalone";

import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';

import { Settings } from '../../../app.settings';

@Component({
  selector: 'app-network-graph',
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatToolbarModule,
    MatIconModule,
    MatInputModule
  ],
  templateUrl: './network-graph.component.html',
  styleUrl: './network-graph.component.scss'
})
export class NetworkGraphComponent implements OnInit, AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('visNetworkContainer') visNetworkContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('visNetwork') visNetwork!: ElementRef<HTMLDivElement>;
  @ViewChild('visBar') visBar!: ElementRef<HTMLDivElement>;
  @ViewChild('visLoadingBar') visLoadingBar!: ElementRef<HTMLImageElement>;
  @ViewChild('visText') visText!: ElementRef<HTMLImageElement>;

  @Input() label = '';
  @Input() data = {
    nodes: [],
    edges: []
  };
  @Input() options = {};
  @Input() startYear: number | null | undefined = undefined;
  @Input() endYear: number | null | undefined = undefined;
  @Input() minYear = 1500;
  @Input() maxYear = new Date().getFullYear();
  @Input() timeWindowLoading = false;
  @Output() timeWindowChange = new EventEmitter<{ startYear: number; endYear: number }>();

  network: any;
  isOpen = true;
  loading = true;
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
  protectedData: {
    nodes: any,
    edges: any
  } = {
    nodes: [],
    edges: []
  };
  protectedOptions = {
    autoResize: true,
    height: '600px',
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
    this.syncTimeWindowInputs();
    this.loading = false;
  }

  ngAfterViewInit(): void {
    this.isViewInitialized = true;
    const container = this.visNetwork.nativeElement;
    this.network = new Network(container, {
      nodes: new DataSet<any>([]),
      edges: new DataSet<any>([])
    }, this.protectedOptions);
    this.network.setOptions({
      autoResize: true,
      height: '100%',
      width: '100%',
    });
    this.network.on('click', (properties: any) => {
      const clickedNodeId = properties.nodes?.[0] ?? this.network.getNodeAt(properties.pointer?.DOM);
      if (!clickedNodeId) {
        return;
      }

      const clickedNode = this.network.body?.data?.nodes?.get(clickedNodeId);
      if (!clickedNode?.id) {
        return;
      }


      const routeSegment = clickedNode.routeSegment ?? clickedNode.group ?? 'jesuits';
      this._ngZone.run(() => {
        this._router.navigate([`/${routeSegment}/${clickedNode.id}`]);
      });
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
      const maxWidth = 496;
      const minWidth = 20;
      const widthFactor = params.total > 0 ? params.iterations / params.total : 1;
      const width = Math.max(minWidth, maxWidth * widthFactor);
      this.visBar.nativeElement.style.width = width + 'px';
      this.visText.nativeElement.innerHTML = Math.round(widthFactor*100) + '%';
    });
    this.network.on("stabilizationIterationsDone", () => {
      // Only hide loading bar when physics is fully stabilized
      this.hideLoadingBar();
    });

    this.applyNetworkState();
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
        this.network.fit({ animation: false });
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
    }

    if (
      changes['startYear'] ||
      changes['endYear'] ||
      changes['minYear'] ||
      changes['maxYear']
    ) {
      this.syncTimeWindowInputs();
    }

    if (this.isViewInitialized && this.network) {
      this.applyNetworkState(false);
    }
  }

  ngOnDestroy(): void {
    this.stopTimeWindowPlayback();
    if (this.timeWindowDebounceTimeout) {
      clearTimeout(this.timeWindowDebounceTimeout);
      this.timeWindowDebounceTimeout = null;
    }
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
    const nodes = this.resolveHtmlTitles(this.protectedData?.nodes ?? []);
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
    this.network.setData({
      nodes: new DataSet<any>(nodes),
      edges: new DataSet<any>(edges)
    });


    if (showLoading) {
      this.showLoadingBar();
    }
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

  private showLoadingBar(): void {
    this.visLoadingBar.nativeElement.style.display = 'block';
    this.visLoadingBar.nativeElement.style.opacity = '1';
    this.visBar.nativeElement.style.width = '20px';
    this.visText.nativeElement.innerHTML = '0%';
  }

  private hideLoadingBar(): void {
    if (this.currentNodeCount > 0 || this.currentEdgeCount > 0) {
      this.network.setOptions({ physics: false });
    }

    this.isRestabilizing = false;

    this.visText.nativeElement.innerHTML = '100%';
    this.visBar.nativeElement.style.width = '496px';
    this.visLoadingBar.nativeElement.style.opacity = '0';
    setTimeout(() => {
      this.visLoadingBar.nativeElement.style.display = 'none';
    }, 500);
  }


}