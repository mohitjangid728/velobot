import type { LucideIcon } from "lucide-react";
import { BookOpen, Building2, CalendarClock, MessagesSquare, TrendingUp } from "lucide-react";

export interface BotTemplate {
  id: string;
  label: string;
  icon: LucideIcon;
  blurb: string;
  defaults: {
    description: string;
    welcomeMessage: string;
    systemPromptExtra: string;
    themeColor: string;
    fallbackEmail: boolean;
  };
  /** Shown as a hint once this template is picked — Actions are org-scoped and can't be auto-attached, so this just points the admin at the right one. */
  actionTip?: string;
}

export const BOT_TEMPLATES: BotTemplate[] = [
  {
    id: "support",
    label: "Customer Support",
    icon: MessagesSquare,
    blurb: "Answers from your docs and hands off to a human when it can't help.",
    defaults: {
      description: "Answers product and support questions from our knowledge base.",
      welcomeMessage: "Hi! How can I help you today?",
      systemPromptExtra:
        "Be concise and friendly. If you don't know the answer from the knowledge base, say so plainly and offer to connect the visitor with a human agent instead of guessing.",
      themeColor: "#4F46E5",
      fallbackEmail: true,
    },
  },
  {
    id: "lead-gen",
    label: "Lead Generation",
    icon: TrendingUp,
    blurb: "Notices buying interest and asks the right questions before handing off a lead.",
    defaults: {
      description: "Engages visitors, qualifies interest, and captures contact details for the sales team.",
      welcomeMessage: "Hey there! Looking for anything in particular today?",
      systemPromptExtra:
        "Watch for signs of buying interest — pricing questions, demo requests, comparisons to competitors. When interest is clear, ask for the visitor's name and email before offering to have someone follow up. Never ask for contact details unless the visitor has shown real interest.",
      themeColor: "#059669",
      fallbackEmail: true,
    },
    actionTip: "Pairs well with a “Create Lead” action (Settings → Actions) so qualified leads are captured automatically.",
  },
  {
    id: "faq",
    label: "FAQ / Docs Bot",
    icon: BookOpen,
    blurb: "Pure Q&A from your docs — no sales pressure, no lead capture.",
    defaults: {
      description: "Answers frequently asked questions using our documentation.",
      welcomeMessage: "Hi! Ask me anything about our docs.",
      systemPromptExtra:
        "Only answer using the knowledge base. If the answer isn't there, say so plainly — don't offer to escalate or collect contact details unless explicitly asked.",
      themeColor: "#0EA5E9",
      fallbackEmail: false,
    },
  },
  {
    id: "sales-demo",
    label: "Sales / Demo Booking",
    icon: CalendarClock,
    blurb: "Proactively offers a demo once a visitor shows interest.",
    defaults: {
      description: "Helps visitors evaluate the product and offers to schedule a demo.",
      welcomeMessage: "Hi! Curious about what we can do for your team?",
      systemPromptExtra:
        "Once a visitor shows interest in pricing or features, proactively offer to schedule a demo. Ask for their name, email, and preferred time before confirming.",
      themeColor: "#F59E0B",
      fallbackEmail: true,
    },
    actionTip: "Pairs well with a “Book Demo” action (Settings → Actions) so meeting requests reach your calendar tool.",
  },
  {
    id: "helpdesk",
    label: "Internal Helpdesk",
    icon: Building2,
    blurb: "For an internal knowledge base — IT/HR style, more formal tone.",
    defaults: {
      description: "Answers internal policy and IT questions for employees.",
      welcomeMessage: "Hi! What can I help you with today?",
      systemPromptExtra:
        "Use a formal, professional tone. If a request needs human review — e.g. an exception to policy — escalate to the support queue rather than guessing.",
      themeColor: "#7C3AED",
      fallbackEmail: false,
    },
  },
];
