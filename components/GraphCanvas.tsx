"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Music2, X, Maximize2 } from "lucide-react";
import type { ShapedNode, ShapedEdge } from "@/lib/shape";

interface GraphCanvasProps {
  nodes: ShapedNode[];
  edges: ShapedEdge[];
  isLoading?: boolean;
}

const NODE_COLORS: Record<string, string> = {
  Track:  "#22C55E",
  Artist: "#A78BFA",
  Album:  "#FB923C",
  Genre:  "#F472B6",
};

// Brighter/lighter border tints for each label
const NODE_BORDER_COLORS: Record<string, string> = {
  Track:  "#4ADE80",
  Artist: "#C4B5FD",
  Album:  "#FCA56B",
  Genre:  "#F9A8D4",
};

function getNodeColor(label: string): string {
  return NODE_COLORS[label] ?? "#94A3B8";
}

function getNodeBorderColor(label: string): string {
  return NODE_BORDER_COLORS[label] ?? "#CBD5E1";
}

// 14–36 px — gentler range than the old 24–56
function getNodeSize(node: ShapedNode): number {
  const pop = node.properties?.popularity;
  if (typeof pop === "number") {
    return 14 + (pop / 100) * 22;
  }
  return 22;
}

function getNodeCaption(n: ShapedNode): string {
  const raw = n.properties?.track_name ?? n.properties?.name ?? n.id;
  const str = String(raw);
  return str.length > 22 ? str.slice(0, 20) + "…" : str;
}

function formatPropValue(v: unknown): string {
  if (v === null || v === undefined) return "null";
  if (typeof v === "number") {
    return Number.isInteger(v) ? String(v) : v.toFixed(4).replace(/\.?0+$/, "");
  }
  return String(v);
}

type NvlHandle = {
  fit?: (nodeIds?: string[], options?: Record<string, unknown>) => void;
  resetZoom?: () => void;
  setZoom?: (zoom: number, options?: Record<string, unknown>) => void;
  getZoom?: () => number;
};

type NvlComponent = React.ForwardRefExoticComponent<{
  nodes: unknown[];
  rels: unknown[];
  layout?: string;
  nvlOptions?: Record<string, unknown>;
  nvlCallbacks?: Record<string, unknown>;
  mouseEventCallbacks?: Record<string, unknown>;
  style?: React.CSSProperties;
  onInitializationError?: (e: Error) => void;
} & React.RefAttributes<NvlHandle>>;

export default function GraphCanvas({ nodes, edges, isLoading }: GraphCanvasProps) {
  const [NVL, setNVL] = useState<NvlComponent | null>(null);
  const [nvlError, setNvlError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<ShapedNode | null>(null);
  const nvlRef = useRef<NvlHandle>(null);

  useEffect(() => {
    import("@neo4j-nvl/react")
      .then((mod) => {
        const Wrapper = mod.InteractiveNvlWrapper ?? mod.BasicNvlWrapper;
        if (Wrapper) {
          setNVL(() => Wrapper as unknown as NvlComponent);
        } else {
          setNvlError("NVL component not found in module.");
        }
      })
      .catch((err: Error) => setNvlError(err.message));
  }, []);

  const nodeMap = useMemo(() => {
    const m = new Map<string, ShapedNode>();
    for (const n of nodes) m.set(n.id, n);
    return m;
  }, [nodes]);

  // Re-derive nvlNodes when selection changes so the ring updates in-place
  const { nvlNodes, nvlRels } = useMemo(() => {
    const nvlNodes = nodes.map((n) => {
      const isSelected = selectedNode?.id === n.id;
      return {
        id: n.id,
        color: getNodeColor(n.label),
        size: getNodeSize(n),
        caption: getNodeCaption(n),
        captionSize: 3.5,
        captionAlign: "bottom" as const,
        captionColor: "#94A3B8",
        borderColor: isSelected ? "#FFFFFF" : getNodeBorderColor(n.label),
        borderWidth: isSelected ? 3 : 1.5,
        selected: isSelected,
      };
    });

    const nvlRels = edges.map((e) => ({
      id: e.id,
      from: e.source,
      to: e.target,
      caption: e.type,
      captionSize: 2.5,
      captionColor: "#475569",
      color: "#334155",
      width: 2,
    }));

    return { nvlNodes, nvlRels };
  }, [nodes, edges, selectedNode]);

  // Fit after layout, with a small delay so physics has time to settle
  useEffect(() => {
    if (!NVL || nvlNodes.length === 0) return;
    const timer = setTimeout(() => {
      try {
        nvlRef.current?.fit?.(nvlNodes.map((n) => n.id), { animated: true });
      } catch { /* noop */ }
    }, 450);
    return () => clearTimeout(timer);
  }, [NVL, nvlNodes.length]); // only on mount / node-count change, not on selection

  const handleNodeClick = useCallback(
    (nvlNode: { id: string }) => {
      const shaped = nodeMap.get(nvlNode.id);
      setSelectedNode((prev) => (prev?.id === nvlNode.id ? null : (shaped ?? null)));
    },
    [nodeMap]
  );

  const handleCanvasClick = useCallback(() => setSelectedNode(null), []);

  const handleFit = useCallback(() => {
    try {
      nvlRef.current?.fit?.(nvlNodes.map((n) => n.id), { animated: true });
    } catch { /* noop */ }
  }, [nvlNodes]);

  const isEmpty = nodes.length === 0 && edges.length === 0;

  if (isLoading) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-[#0B1120] rounded-xl">
        <div className="grid grid-cols-4 gap-3 p-8 w-full max-w-md">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="h-12 bg-[#1E293B] rounded-lg animate-pulse"
              style={{ animationDelay: `${i * 50}ms` }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0B1120] rounded-xl gap-4">
        <Music2 size={48} className="text-[#475569]" aria-hidden="true" />
        <p className="text-[#94A3B8] text-sm">No graph to visualize</p>
      </div>
    );
  }

  if (nvlError) {
    return <FallbackTable nodes={nodes} edges={edges} error={nvlError} />;
  }

  if (!NVL) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-[#0B1120] rounded-xl">
        <div className="w-6 h-6 border-2 border-[#22C55E] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const props = selectedNode ? Object.entries(selectedNode.properties) : [];

  return (
    <div className="absolute inset-0 rounded-xl overflow-hidden bg-[#0B1120]">
      {/* Accessibility: screen-reader adjacency list */}
      <details className="sr-only">
        <summary>Graph adjacency list</summary>
        <ul>
          {nodes.map((n) => (
            <li key={n.id}>{n.label}: {getNodeCaption(n)}</li>
          ))}
        </ul>
      </details>

      {/* NVL canvas */}
      <div className="absolute inset-0 z-[1]">
        <NVL
          ref={nvlRef}
          nodes={nvlNodes}
          rels={nvlRels}
          layout={nvlRels.length > 0 ? "forceDirected" : "grid"}
          nvlOptions={{
            allowDynamicMinZoom: true,
            initialZoom: 0.7,
            minZoom: 0.05,
            maxZoom: 8,
            disableTelemetry: true,
            useWebGL: true,
          }}
          mouseEventCallbacks={{
            onPan: true,
            onZoom: true,
            onDrag: true,
            onDragStart: true,
            onDragEnd: true,
            onHover: true,
            onNodeClick: handleNodeClick,
            onCanvasClick: handleCanvasClick,
          }}
          nvlCallbacks={{
            onLayoutDone: () => {
              try {
                nvlRef.current?.fit?.(nvlNodes.map((n) => n.id), { animated: false });
              } catch { /* noop */ }
            },
          }}
          style={{ width: "100%", height: "100%" }}
          onInitializationError={(e: Error) => setNvlError(e.message)}
        />
      </div>

      {/* Subtle dot-grid texture layered over canvas — never blocks pointer events */}
      <div
        aria-hidden="true"
        className="absolute inset-0 z-[2] pointer-events-none rounded-xl"
        style={{
          backgroundImage: "radial-gradient(rgba(148,163,184,0.055) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />

      {/* Radial glow at centre */}
      <div
        aria-hidden="true"
        className="absolute inset-0 z-[2] pointer-events-none rounded-xl"
        style={{
          background:
            "radial-gradient(ellipse 65% 55% at 50% 50%, rgba(34,197,94,0.045) 0%, transparent 70%)",
        }}
      />

      {/* Node inspector — slides in from the left */}
      <div
        className="absolute top-3 left-3 z-[20] w-56 rounded-xl shadow-2xl overflow-hidden"
        style={{
          transition: "opacity 180ms ease, transform 180ms ease",
          opacity: selectedNode ? 1 : 0,
          transform: selectedNode ? "translateX(0)" : "translateX(-6px)",
          pointerEvents: selectedNode ? "auto" : "none",
        }}
      >
        <div className="bg-[#0F172A]/95 border border-[#334155] rounded-xl backdrop-blur-md overflow-hidden">
          {/* Header */}
          <div
            className="flex items-center justify-between px-3 py-2 border-b border-[#1E293B]"
            style={{
              borderLeftColor: selectedNode ? getNodeColor(selectedNode.label) : "transparent",
              borderLeftWidth: 3,
            }}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="shrink-0 w-2.5 h-2.5 rounded-full"
                style={{
                  backgroundColor: selectedNode ? getNodeColor(selectedNode.label) : "transparent",
                  boxShadow: selectedNode
                    ? `0 0 6px ${getNodeColor(selectedNode.label)}80`
                    : "none",
                }}
              />
              <span className="text-xs font-bold text-[#F8FAFC] truncate">
                {selectedNode?.label}
              </span>
            </div>
            <button
              onClick={() => setSelectedNode(null)}
              className="shrink-0 text-[#64748b] hover:text-[#F8FAFC] transition-colors ml-2"
              aria-label="Close inspector"
            >
              <X size={13} />
            </button>
          </div>

          {/* Properties */}
          <div className="max-h-52 overflow-y-auto">
            {props.length === 0 ? (
              <p className="px-3 py-2 text-xs text-[#64748b]">No properties</p>
            ) : (
              <table className="w-full text-xs">
                <tbody>
                  {props.map(([key, val]) => (
                    <tr key={key} className="border-b border-[#1E293B]/50 last:border-0">
                      <td className="px-3 py-1.5 text-[#64748b] font-medium whitespace-nowrap align-top">
                        {key}
                      </td>
                      <td className="px-3 py-1.5 text-[#CBD5E1] font-mono break-all">
                        {formatPropValue(val)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="absolute bottom-3 left-3 z-[20] bg-[#0F172A]/90 backdrop-blur-sm rounded-lg px-3 py-2 flex flex-wrap gap-x-3 gap-y-1 border border-[#1E293B]">
        {Object.entries(NODE_COLORS).map(([label, color]) => (
          <span key={label} className="flex items-center gap-1.5 text-xs text-[#94A3B8]">
            <span
              className="w-2 h-2 rounded-full"
              aria-hidden="true"
              style={{
                backgroundColor: color,
                boxShadow: `0 0 4px ${color}80`,
              }}
            />
            {label}
          </span>
        ))}
      </div>

      {/* Fit-to-view control */}
      <button
        type="button"
        onClick={handleFit}
        className="absolute top-3 right-3 z-[20] flex items-center gap-1.5 bg-[#0F172A]/90 hover:bg-[#1E293B] border border-[#1E293B] hover:border-[#334155] text-[#94A3B8] hover:text-[#F8FAFC] text-xs px-2.5 py-1.5 rounded-lg backdrop-blur-sm transition-all duration-150"
        aria-label="Fit graph to view"
      >
        <Maximize2 size={12} aria-hidden="true" />
        Fit
      </button>
    </div>
  );
}

function FallbackTable({
  nodes,
  edges,
  error,
}: {
  nodes: ShapedNode[];
  edges: ShapedEdge[];
  error: string;
}) {
  return (
    <div className="absolute inset-0 overflow-auto bg-[#0B1120] rounded-xl p-4">
      <p className="text-amber-400 text-xs mb-3 font-mono">
        Graph renderer unavailable: {error}
      </p>
      <p className="text-[#94A3B8] text-sm mb-3">
        {nodes.length} nodes · {edges.length} edges
      </p>
      <ul className="text-xs text-[#CBD5E1] space-y-1">
        {nodes.slice(0, 50).map((n) => (
          <li key={n.id} className="flex gap-2 items-center">
            <span
              className="px-1.5 py-0.5 rounded text-white text-[10px]"
              style={{ backgroundColor: getNodeColor(n.label) }}
            >
              {n.label}
            </span>
            <span>{getNodeCaption(n)}</span>
          </li>
        ))}
        {nodes.length > 50 && (
          <li className="text-[#475569]">…and {nodes.length - 50} more</li>
        )}
      </ul>
    </div>
  );
}
