import { BrainCircuit } from "lucide-react";

import { defineModule } from "../define-module";

export default defineModule({
  slug: "ai-analyst",
  displayName: "AI Business Analyst",
  description: "Automated insights and predictive analytics.",
  version: "1.0.0",
  priority: 110,
  navigation: [
    {
      name: "AI Business Analyst",
      href: "/ai-analyst",
      icon: BrainCircuit,
      module: "ai_analyst",
      order: 110,
    },
  ],
});
