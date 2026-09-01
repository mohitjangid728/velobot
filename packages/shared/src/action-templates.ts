import type { ActionParameter, BotAction } from "./types/database";

/**
 * Prefillable scaffolds for the Bot Actions template picker — static data,
 * not DB-backed (same pattern as plans.ts's ADDONS). Picking one just
 * copies these values into the action config form; nothing is "linked" or
 * magic, the user edits and saves like any other action.
 */
export interface ActionTemplate {
  key: string;
  label: string;
  description: string;
  method: BotAction["method"];
  path: string;
  trigger_description: string;
  parameters: ActionParameter[];
}

export const ACTION_TEMPLATES: ActionTemplate[] = [
  {
    key: "lead_capture",
    label: "Lead Capture",
    description: "Push a new lead to your CRM when a visitor shares contact info.",
    method: "POST",
    path: "/leads",
    trigger_description:
      "Trigger when the visitor shares their name, email, or company and seems interested in being contacted, e.g. asking for a demo, pricing, or a callback.",
    parameters: [
      { name: "name", type: "string", required: true, description: "The visitor's full name." },
      { name: "email", type: "string", required: true, description: "The visitor's email address." },
      { name: "company_name", type: "string", required: false, description: "The visitor's company, if mentioned." },
    ],
  },
  {
    key: "ticket_lookup",
    label: "Ticket / Order Status Lookup",
    description: "Look up an existing support ticket or order by its ID.",
    method: "GET",
    path: "/tickets/{ticket_id}",
    trigger_description:
      "Trigger when the user asks about the status of a support ticket or order and provides (or can provide) its ID number.",
    parameters: [{ name: "ticket_id", type: "string", required: true, description: "The ticket or order ID the user mentioned." }],
  },
  {
    key: "book_appointment",
    label: "Appointment / Demo Booking",
    description: "Schedule a demo or appointment for the visitor.",
    method: "POST",
    path: "/appointments",
    trigger_description:
      "Trigger when the user asks to book a demo, call, or appointment and provides their contact info and a preferred time.",
    parameters: [
      { name: "name", type: "string", required: true, description: "The visitor's full name." },
      { name: "email", type: "string", required: true, description: "The visitor's email address." },
      { name: "preferred_time", type: "string", required: false, description: "The visitor's preferred date/time, in their own words." },
    ],
  },
];
