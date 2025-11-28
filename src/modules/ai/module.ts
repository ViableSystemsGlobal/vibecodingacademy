import { BrainCircuit } from "lucide-react";

import { defineModule } from "../define-module";

export default defineModule({
  slug: "ai-analyst",
  displayName: "Strategic Business Partner",
  description: "Your AI strategic advisor for business planning, decision-making, and long-term growth.",
  version: "2.0.0",
  priority: 110,
  navigation: [
    {
      name: "Strategic Business Partner",
      href: "/ai-analyst",
      icon: BrainCircuit,
      module: "ai_analyst",
      order: 110,
    },
  ],
});
