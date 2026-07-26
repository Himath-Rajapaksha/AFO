import { useCallback, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  ReactFlow,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
  type Edge,
  type Node,
  type NodeTypes,
  Handle,
  Position,
  BackgroundVariant,
} from "reactflow";
import "reactflow/dist/style.css";
import type { Rule, RuleCondition, RuleAction } from "../../lib/tauri-bridge";
import Button from "../ui/Button";

// ── Node Types ──────────────────────────────────────────

interface TriggerNodeData {
  label: string;
}

function TriggerNode({ data }: { data: TriggerNodeData }) {
  const { t } = useTranslation();
  return (
    <div className="rounded-xl border border-afo-purple/40 bg-afo-purple/10 px-4 py-3 text-sm font-medium text-[var(--text-primary)] shadow-lg">
      <div className="text-[10px] uppercase tracking-wider text-afo-purple mb-1">{t("rules.trigger")}</div>
      {data.label}
      <Handle type="source" position={Position.Bottom} className="!bg-afo-purple" />
    </div>
  );
}

interface ConditionNodeData {
  field: string;
  operator: string;
  value: string;
  onUpdate: (field: string, operator: string, value: string) => void;
}

function ConditionNode({ data }: { data: ConditionNodeData }) {
  const { t } = useTranslation();
  return (
    <div className="rounded-xl border border-afo-sky/40 bg-afo-sky/10 px-4 py-3 text-sm text-[var(--text-primary)] shadow-lg min-w-[200px]">
      <Handle type="target" position={Position.Top} className="!bg-afo-sky" />
      <div className="text-[10px] uppercase tracking-wider text-afo-sky mb-2">{t("rules.condition")}</div>
      <div className="space-y-1.5">
        <select
          value={data.field}
          onChange={(e) => data.onUpdate(e.target.value, data.operator, data.value)}
          className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-card)] px-2 py-1 text-xs text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <option value="Extension">{t("rules.fieldExtension")}</option>
          <option value="Name">{t("rules.fieldName")}</option>
          <option value="Size">{t("rules.fieldSize")}</option>
          <option value="DateCreated">{t("rules.dateCreated")}</option>
          <option value="DateModified">{t("rules.dateModified")}</option>
        </select>
        <select
          value={data.operator}
          onChange={(e) => data.onUpdate(data.field, e.target.value, data.value)}
          className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-card)] px-2 py-1 text-xs text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <option value="Equals">{t("rules.operatorEquals")}</option>
          <option value="Contains">{t("rules.operatorContains")}</option>
          <option value="StartsWith">{t("rules.startsWith")}</option>
          <option value="EndsWith">{t("rules.endsWith")}</option>
          <option value="GreaterThan">{t("rules.greaterThan")}</option>
          <option value="LessThan">{t("rules.lessThan")}</option>
          <option value="Regex">{t("rules.operatorRegex")}</option>
        </select>
        <input
          type="text"
          value={data.value}
          onChange={(e) => data.onUpdate(data.field, data.operator, e.target.value)}
          placeholder="value"
          className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-card)] px-2 py-1 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-afo-sky" />
    </div>
  );
}

interface ActionNodeData {
  actionType: string;
  value: string;
  onUpdate: (type: string, value: string) => void;
}

function ActionNode({ data }: { data: ActionNodeData }) {
  const { t } = useTranslation();
  return (
    <div className="rounded-xl border border-afo-emerald/40 bg-afo-emerald/10 px-4 py-3 text-sm text-[var(--text-primary)] shadow-lg min-w-[200px]">
      <Handle type="target" position={Position.Top} className="!bg-afo-emerald" />
      <div className="text-[10px] uppercase tracking-wider text-afo-emerald mb-2">{t("rules.action")}</div>
      <div className="space-y-1.5">
        <select
          value={data.actionType}
          onChange={(e) => data.onUpdate(e.target.value, data.value)}
          className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-card)] px-2 py-1 text-xs text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <option value="Move">{t("rules.actionMove")}</option>
          <option value="Copy">{t("rules.actionCopy")}</option>
          <option value="Rename">{t("rules.actionRename")}</option>
        </select>
        <input
          type="text"
          value={data.value}
          onChange={(e) => data.onUpdate(data.actionType, e.target.value)}
          placeholder={data.actionType === "Rename" ? "{name}_sorted.{ext}" : "/destination/path"}
          className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--bg-card)] px-2 py-1 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
      </div>
    </div>
  );
}

const nodeTypes: NodeTypes = {
  trigger: TriggerNode,
  condition: ConditionNode,
  action: ActionNode,
};

// ── Build initial nodes/edges from rule ─────────────────

function buildInitialNodesEdges(rule: Rule) {
  const initialNodes: Node[] = [];
  const initialEdges: Edge[] = [];
  let nodeId = 1;

  // Trigger node
  const triggerId = `trigger-${nodeId++}`;
  initialNodes.push({
    id: triggerId,
    type: "trigger",
    position: { x: 250, y: 0 },
    data: { label: rule.name || "New Rule" },
  });

  let lastId = triggerId;
  let yOffset = 100;

  // Condition nodes
  const conditions = rule.conditions.length > 0 ? rule.conditions : [{ field: "Extension", operator: "Contains", value: "" }];
  conditions.forEach((cond) => {
    const condId = `condition-${nodeId++}`;
    initialNodes.push({
      id: condId,
      type: "condition",
      position: { x: 250, y: yOffset },
      data: { field: cond.field, operator: cond.operator, value: cond.value, onUpdate: () => {} },
    });
    initialEdges.push({
      id: `e-${lastId}-${condId}`,
      source: lastId,
      target: condId,
      animated: true,
      style: { stroke: "var(--info)" },
    });
    lastId = condId;
    yOffset += 150;
  });

  // Action nodes
  const actions = rule.actions.length > 0 ? rule.actions : [{ Move: { destination: "" } }];
  actions.forEach((action) => {
    const actionId = `action-${nodeId++}`;
    const actionType = action.Move ? "Move" : action.Copy ? "Copy" : "Rename";
    const value = action.Move?.destination || action.Copy?.destination || action.Rename?.pattern || "";
    initialNodes.push({
      id: actionId,
      type: "action",
      position: { x: 250, y: yOffset },
      data: { actionType, value, onUpdate: () => {} },
    });
    initialEdges.push({
      id: `e-${lastId}-${actionId}`,
      source: lastId,
      target: actionId,
      animated: true,
      style: { stroke: "var(--success)" },
    });
    lastId = actionId;
    yOffset += 150;
  });

  return { initialNodes, initialEdges, nextNodeId: nodeId };
}

// ── Flow Editor ─────────────────────────────────────────

interface RuleFlowEditorProps {
  rule: Rule;
  onSave: (conditions: RuleCondition[], actions: RuleAction[]) => void;
  onCancel: () => void;
}

export default function RuleFlowEditor({ rule, onSave, onCancel }: RuleFlowEditorProps) {
  const { t } = useTranslation();
  const built = useMemo(() => buildInitialNodesEdges(rule), [rule.id]);
  const [nodes, setNodes, onNodesChange] = useNodesState(built.initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(built.initialEdges);
  const nodeIdRef = useRef(built.nextNodeId);

  // Wire up onUpdate callbacks to real setters
  const wiredNodes = useMemo(() => {
    return nodes.map((n) => {
      if (n.type === "condition") {
        return {
          ...n,
          data: {
            ...n.data,
            onUpdate: (field: string, operator: string, value: string) => {
              setNodes((nds) => nds.map((nd) => nd.id === n.id ? { ...nd, data: { ...nd.data, field, operator, value } } : nd));
            },
          },
        };
      }
      if (n.type === "action") {
        return {
          ...n,
          data: {
            ...n.data,
            onUpdate: (type: string, val: string) => {
              setNodes((nds) => nds.map((nd) => nd.id === n.id ? { ...nd, data: { ...nd.data, actionType: type, value: val } } : nd));
            },
          },
        };
      }
      return n;
    });
  }, [nodes, setNodes]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ ...params, animated: true }, eds)),
    [setEdges]
  );

  const handleAddCondition = () => {
    const id = `condition-${nodeIdRef.current++}`;
    const lastNode = nodes[nodes.length - 1];
    const newY = lastNode ? lastNode.position.y + 150 : 100;

    setNodes((nds) => [
      ...nds,
      {
        id,
        type: "condition",
        position: { x: 250, y: newY },
        data: { field: "Extension", operator: "Contains", value: "", onUpdate: () => {} },
      },
    ]);
  };

  const handleAddAction = () => {
    const id = `action-${nodeIdRef.current++}`;
    const lastNode = nodes[nodes.length - 1];
    const newY = lastNode ? lastNode.position.y + 150 : 100;

    setNodes((nds) => [
      ...nds,
      {
        id,
        type: "action",
        position: { x: 250, y: newY },
        data: { actionType: "Move", value: "", onUpdate: () => {} },
      },
    ]);
  };

  function extractRule() {
    const conditions: RuleCondition[] = [];
    const actions: RuleAction[] = [];

    for (const node of nodes) {
      if (node.type === "condition") {
        const d = node.data as ConditionNodeData;
        if (d.value) {
          conditions.push({
            field: d.field as RuleCondition["field"],
            operator: d.operator as RuleCondition["operator"],
            value: d.value,
          });
        }
      } else if (node.type === "action") {
        const d = node.data as ActionNodeData;
        if (d.value) {
          if (d.actionType === "Move") {
            actions.push({ Move: { destination: d.value } });
          } else if (d.actionType === "Copy") {
            actions.push({ Copy: { destination: d.value } });
          } else {
            actions.push({ Rename: { pattern: d.value } });
          }
        }
      }
    }

    return { conditions, actions };
  }

  function handleSave() {
    const { conditions, actions } = extractRule();
    onSave(conditions, actions);
  }

  return (
    <div className="flex flex-col h-[500px] rounded-xl border border-[var(--border-default)] bg-[var(--bg-card)]">
      {/* Toolbar */}
      <div className="flex items-center gap-2 border-b border-[var(--border-default)] px-4 py-2">
        <Button variant="secondary" onClick={handleAddCondition} className="text-xs px-3 py-1.5">
          {t("rules.addConditionBtn")}
        </Button>
        <Button variant="secondary" onClick={handleAddAction} className="text-xs px-3 py-1.5">
          {t("rules.addActionBtn")}
        </Button>
        <div className="flex-1" />
        <Button variant="secondary" onClick={onCancel} className="text-xs px-3 py-1.5">
          {t("common.cancel")}
        </Button>
        <Button onClick={handleSave} className="text-xs px-3 py-1.5">
          {t("common.saveRule")}
        </Button>
      </div>

      {/* Flow canvas */}
      <div className="flex-1">
        <ReactFlow
          nodes={wiredNodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          proOptions={{ hideAttribution: true }}
        >
          <Controls className="!rounded-lg" style={{ backgroundColor: "var(--bg-elevated)", borderColor: "var(--border-default)" }} />
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1}
            color="var(--border-default)"
          />
        </ReactFlow>
      </div>
    </div>
  );
}
