export interface FlowNode {
  id: string;
  name: string;
  description: string;
  nodeType: "menu" | "ticket";
  parentId: string | null;
  ticketTypeId: string | null;
  queueId: string | null;
  icon?: string;
  color?: string;
}
