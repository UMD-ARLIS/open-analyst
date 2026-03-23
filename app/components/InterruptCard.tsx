import { useState, useCallback, useMemo } from "react";
import { CheckCircle, XCircle, ExternalLink, ChevronDown, ChevronRight } from "lucide-react";

interface SourceItem {
  index: number;
  key?: string;
  title: string;
  authors?: string[];
  venue?: string;
  year?: string;
  abstract?: string;
  doi?: string | null;
  url?: string | null;
  citation_count?: number;
  branch_preview?: string[];
  branch_count?: number;
  recommended?: boolean;
  duplicate_count?: number;
}

interface InterruptValue {
  type: string;
  query?: string;
  total_found?: number;
  total_candidates?: number;
  total_batches?: number;
  recommended_count?: number;
  selection_hint?: string;
  soft_limit?: number;
  sources?: SourceItem[];
  groups?: Array<{ label?: string; query?: string; candidate_count?: number }>;
  message?: string;
  warnings?: string[];
  provider_status?: Record<string, unknown>;
  url?: string;
  title?: string;
  // For tool-level interrupts (execute_command, publish)
  name?: string;
  args?: Record<string, unknown>;
  [key: string]: unknown;
}

interface InterruptCardProps {
  interrupt: { id?: string; value: InterruptValue };
  onResume: (value: Record<string, unknown>) => void;
  isProcessing?: boolean;
}

function SourceCollectionCard({
  interrupt,
  onResume,
  isProcessing,
}: {
  interrupt: InterruptValue;
  onResume: (value: Record<string, unknown>) => void;
  isProcessing?: boolean;
}) {
  const sources = useMemo(() => interrupt.sources || [], [interrupt.sources]);
  const groups = useMemo(
    () =>
      Array.isArray(interrupt.groups)
        ? interrupt.groups.filter(
            (item): item is { label?: string; query?: string; candidate_count?: number } =>
              !!item && typeof item === "object",
          )
        : [],
    [interrupt.groups],
  );
  const warnings = useMemo(
    () => (Array.isArray(interrupt.warnings) ? interrupt.warnings.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : []),
    [interrupt.warnings],
  );
  const isConsolidated = interrupt.type === "consolidated_source_approval";
  const selectionKeys = useMemo(
    () => sources.map((source) => String(source.key || source.index)),
    [sources],
  );
  const recommendedKeys = useMemo(
    () => new Set(
      sources
        .filter((source) => source.recommended)
        .map((source) => String(source.key || source.index)),
    ),
    [sources],
  );
  const initialSelectionKeys = useMemo(() => {
    if (isConsolidated && recommendedKeys.size > 0) {
      return Array.from(recommendedKeys);
    }
    return selectionKeys;
  }, [isConsolidated, recommendedKeys, selectionKeys]);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initialSelectionKeys));
  const [expandedAbstracts, setExpandedAbstracts] = useState<Set<number>>(new Set());

  const toggleAll = useCallback(() => {
    if (selected.size === selectionKeys.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(selectionKeys));
    }
  }, [selected.size, selectionKeys]);

  const toggleOne = useCallback((selectionKey: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(selectionKey)) {
        next.delete(selectionKey);
      } else {
        next.add(selectionKey);
      }
      return next;
    });
  }, []);

  const toggleAbstract = useCallback((index: number) => {
    setExpandedAbstracts((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  const selectRecommended = useCallback(() => {
    if (recommendedKeys.size > 0) {
      setSelected(new Set(recommendedKeys));
    }
  }, [recommendedKeys]);

  const clearAll = useCallback(() => {
    setSelected(new Set());
  }, []);

  const isRecommendedSelection = useMemo(() => {
    if (recommendedKeys.size === 0 || selected.size !== recommendedKeys.size) {
      return false;
    }
    for (const key of recommendedKeys) {
      if (!selected.has(key)) {
        return false;
      }
    }
    return true;
  }, [recommendedKeys, selected]);

  const handleApprove = useCallback(() => {
    if (!isConsolidated) {
      onResume({
        approved: true,
        approved_indices: sources
          .filter((source) => selected.has(String(source.key || source.index)))
          .map((source) => source.index),
      });
      return;
    }

    if (selected.size === selectionKeys.length) {
      onResume({ approved: true, selection_mode: "all" });
      return;
    }
    if (isRecommendedSelection) {
      onResume({ approved: true, selection_mode: "recommended" });
      return;
    }

    const selectedKeys = selectionKeys.filter((key) => selected.has(key));
    const excludedKeys = selectionKeys.filter((key) => !selected.has(key));
    if (excludedKeys.length > 0 && excludedKeys.length < selectedKeys.length) {
      onResume({
        approved: true,
        selection_mode: "all_except",
        excluded_keys: excludedKeys,
      });
      return;
    }

    onResume({
      approved: true,
      selection_mode: "custom",
      approved_keys: selectedKeys,
    });
  }, [isConsolidated, isRecommendedSelection, onResume, selected, selectionKeys, sources]);

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-900/10 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-amber-300">
          {isConsolidated
            ? `Review ${interrupt.total_found || sources.length} deduplicated sources`
            : `Found ${interrupt.total_found || sources.length} sources for “${interrupt.query}”`}
        </h3>
        <button
          type="button"
          onClick={toggleAll}
          className="text-xs text-amber-400 hover:text-amber-300 underline"
          disabled={isProcessing}
        >
          {selected.size === selectionKeys.length ? "Deselect all" : "Select all"}
        </button>
      </div>

      {interrupt.message ? (
        <p className="text-xs text-amber-100/85 leading-relaxed">{interrupt.message}</p>
      ) : null}

      {isConsolidated ? (
        <div className="flex flex-wrap gap-2 text-[11px] text-amber-100/85">
          {typeof interrupt.recommended_count === "number" && interrupt.recommended_count > 0 ? (
            <span className="rounded-full border border-emerald-500/30 bg-emerald-950/40 px-2.5 py-1">
              Recommended: {interrupt.recommended_count}
            </span>
          ) : null}
          {typeof interrupt.soft_limit === "number" &&
          typeof interrupt.total_found === "number" &&
          interrupt.total_found >= interrupt.soft_limit ? (
            <span className="rounded-full border border-amber-500/30 bg-amber-950/40 px-2.5 py-1">
              Large import: chunked after approval
            </span>
          ) : null}
        </div>
      ) : null}

      {isConsolidated && groups.length > 0 ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-950/30 px-3 py-2 space-y-2">
          <div className="text-xs font-medium text-amber-300">Retrieval branches</div>
          <div className="flex flex-wrap gap-2">
            {groups.map((group, index) => (
              <div
                key={`${group.label || group.query || "group"}-${index}`}
                className="rounded-full border border-amber-500/20 bg-amber-950/50 px-2.5 py-1 text-[11px] text-amber-100"
              >
                <span className="font-medium">{group.label || group.query || `Branch ${index + 1}`}</span>
                {typeof group.candidate_count === "number" ? ` · ${group.candidate_count}` : ""}
              </div>
            ))}
          </div>
          {typeof interrupt.total_candidates === "number" && interrupt.total_candidates > sources.length ? (
            <p className="text-[11px] text-amber-100/80">
              {interrupt.total_candidates} raw results collapsed into {sources.length} unique sources.
            </p>
          ) : null}
        </div>
      ) : null}

      {isConsolidated ? (
        <div className="flex flex-wrap gap-2">
          {recommendedKeys.size > 0 ? (
            <button
              type="button"
              onClick={selectRecommended}
              disabled={isProcessing}
              className="rounded-full border border-emerald-500/30 bg-emerald-950/40 px-3 py-1 text-[11px] text-emerald-200 hover:bg-emerald-950/60 disabled:opacity-50"
            >
              Select recommended
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setSelected(new Set(selectionKeys))}
            disabled={isProcessing}
            className="rounded-full border border-amber-500/30 bg-amber-950/40 px-3 py-1 text-[11px] text-amber-100 hover:bg-amber-950/60 disabled:opacity-50"
          >
            Select all
          </button>
          <button
            type="button"
            onClick={clearAll}
            disabled={isProcessing}
            className="rounded-full border border-neutral-600 bg-neutral-900/50 px-3 py-1 text-[11px] text-neutral-200 hover:bg-neutral-900/70 disabled:opacity-50"
          >
            Clear all
          </button>
        </div>
      ) : null}

      {warnings.length > 0 ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-950/40 px-3 py-2 text-xs text-amber-100 space-y-1">
          <div className="font-medium text-amber-300">Retrieval warnings</div>
          {warnings.map((warning, index) => (
            <p key={`${warning}-${index}`}>{warning}</p>
          ))}
        </div>
      ) : null}

      <div className="max-h-80 overflow-y-auto space-y-2">
        {sources.map((source) => (
          <div
            key={source.key || source.index}
            className={`rounded-lg border p-3 transition-colors cursor-pointer ${
              selected.has(String(source.key || source.index))
                ? "border-amber-500/40 bg-amber-900/20"
                : "border-neutral-700 bg-neutral-900/50 opacity-60"
            }`}
            onClick={() => toggleOne(String(source.key || source.index))}
          >
            <div className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={selected.has(String(source.key || source.index))}
                onChange={() => toggleOne(String(source.key || source.index))}
                className="mt-1 accent-amber-500"
                onClick={(e) => e.stopPropagation()}
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white leading-snug">
                  {source.title}
                </div>
                <div className="text-xs text-neutral-400 mt-0.5">
                  {source.authors?.slice(0, 3).join(", ")}
                  {(source.authors?.length || 0) > 3 ? " et al." : ""}
                  {source.venue ? ` · ${source.venue}` : ""}
                  {source.year ? ` · ${source.year}` : ""}
                  {source.citation_count ? ` · ${source.citation_count} citations` : ""}
                </div>
                {source.recommended ? (
                  <div className="mt-1">
                    <span className="rounded-full border border-emerald-500/30 bg-emerald-950/30 px-2 py-0.5 text-[10px] text-emerald-200">
                      Recommended
                    </span>
                  </div>
                ) : null}
                {source.branch_preview && source.branch_preview.length > 0 ? (
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {source.branch_preview.map((branch) => (
                      <span
                        key={`${source.key || source.index}-${branch}`}
                        className="rounded-full border border-sky-500/30 bg-sky-950/30 px-2 py-0.5 text-[10px] text-sky-200"
                      >
                        {branch}
                      </span>
                    ))}
                    {typeof source.branch_count === "number" &&
                    source.branch_count > source.branch_preview.length ? (
                      <span className="rounded-full border border-sky-500/20 bg-sky-950/20 px-2 py-0.5 text-[10px] text-sky-100">
                        +{source.branch_count - source.branch_preview.length} more branches
                      </span>
                    ) : null}
                    {(source.duplicate_count || 1) > 1 ? (
                      <span className="rounded-full border border-emerald-500/30 bg-emerald-950/30 px-2 py-0.5 text-[10px] text-emerald-200">
                        Found by {source.duplicate_count} branches
                      </span>
                    ) : null}
                  </div>
                ) : null}
                {source.abstract && (
                  <div className="mt-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleAbstract(source.index);
                      }}
                      className="text-xs text-neutral-500 hover:text-neutral-300 flex items-center gap-0.5"
                    >
                      {expandedAbstracts.has(source.index) ? (
                        <ChevronDown className="w-3 h-3" />
                      ) : (
                        <ChevronRight className="w-3 h-3" />
                      )}
                      Abstract
                    </button>
                    {expandedAbstracts.has(source.index) && (
                      <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                        {source.abstract}
                      </p>
                    )}
                  </div>
                )}
                {(source.doi || source.url) && (
                  <div className="flex gap-2 mt-1">
                    {source.doi && (
                      <a
                        href={`https://doi.org/${source.doi}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-0.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        DOI <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    )}
                    {source.url && (
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-0.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Link <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={handleApprove}
          disabled={isProcessing || selected.size === 0}
          className="flex items-center gap-1.5 px-4 py-1.5 bg-green-600 hover:bg-green-500 disabled:bg-green-800 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
        >
          <CheckCircle className="w-3.5 h-3.5" />
          Approve selected ({selected.size})
        </button>
        <button
          type="button"
          onClick={() => onResume({ approved: false })}
          disabled={isProcessing}
          className="flex items-center gap-1.5 px-4 py-1.5 bg-red-600/80 hover:bg-red-500 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
        >
          <XCircle className="w-3.5 h-3.5" />
          Reject all
        </button>
      </div>
    </div>
  );
}

function WebSourceCard({
  interrupt,
  onResume,
  isProcessing,
}: {
  interrupt: InterruptValue;
  onResume: (value: Record<string, unknown>) => void;
  isProcessing?: boolean;
}) {
  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-900/10 p-4 space-y-3">
      <h3 className="text-sm font-semibold text-amber-300">Add web source to project?</h3>
      <div className="rounded-lg border border-neutral-700 bg-neutral-900/50 p-3">
        <div className="text-sm text-white">{interrupt.title || interrupt.url}</div>
        {interrupt.url && (
          <a
            href={interrupt.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-0.5 mt-1"
          >
            {interrupt.url} <ExternalLink className="w-2.5 h-2.5" />
          </a>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onResume({ approved: true })}
          disabled={isProcessing}
          className="flex items-center gap-1.5 px-4 py-1.5 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
        >
          <CheckCircle className="w-3.5 h-3.5" />
          Approve
        </button>
        <button
          type="button"
          onClick={() => onResume({ approved: false })}
          disabled={isProcessing}
          className="flex items-center gap-1.5 px-4 py-1.5 bg-red-600/80 hover:bg-red-500 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
        >
          <XCircle className="w-3.5 h-3.5" />
          Reject
        </button>
      </div>
    </div>
  );
}

function ToolApprovalCard({
  interrupt,
  onResume,
  isProcessing,
}: {
  interrupt: InterruptValue;
  onResume: (value: Record<string, unknown>) => void;
  isProcessing?: boolean;
}) {
  const toolName = interrupt.name || "action";
  const toolArgs = interrupt.args || {};

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-900/10 p-4 space-y-3">
      <h3 className="text-sm font-semibold text-amber-300">
        Approve {toolName}?
      </h3>
      <pre className="text-xs bg-neutral-900 border border-neutral-700 rounded-lg p-3 overflow-x-auto text-neutral-300">
        {JSON.stringify(toolArgs, null, 2)}
      </pre>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onResume({ type: "approve" })}
          disabled={isProcessing}
          className="flex items-center gap-1.5 px-4 py-1.5 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
        >
          <CheckCircle className="w-3.5 h-3.5" />
          Approve
        </button>
        <button
          type="button"
          onClick={() => onResume({ type: "reject", message: "User rejected" })}
          disabled={isProcessing}
          className="flex items-center gap-1.5 px-4 py-1.5 bg-red-600/80 hover:bg-red-500 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
        >
          <XCircle className="w-3.5 h-3.5" />
          Reject
        </button>
      </div>
    </div>
  );
}

export function InterruptCard({ interrupt, onResume, isProcessing }: InterruptCardProps) {
  const value = interrupt.value;

  if (value.type === "source_collection_approval" || value.type === "consolidated_source_approval") {
    return (
      <SourceCollectionCard
        key={interrupt.id || `${value.type}:${value.query || value.message || value.title || "approval"}`}
        interrupt={value}
        onResume={onResume}
        isProcessing={isProcessing}
      />
    );
  }

  if (value.type === "web_source_approval") {
    return (
      <WebSourceCard
        interrupt={value}
        onResume={onResume}
        isProcessing={isProcessing}
      />
    );
  }

  // Default: generic tool approval (execute_command, publish_*)
  return (
    <ToolApprovalCard
      interrupt={value}
      onResume={onResume}
      isProcessing={isProcessing}
    />
  );
}
