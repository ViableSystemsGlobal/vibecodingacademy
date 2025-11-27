import { KanbanSquare } from "lucide-react";

import { defineModule } from "../define-module";

export default defineModule({
  slug: "projects",
  displayName: "Projects",
  description: "Project workspaces with task boards, incident tracking, and resource requests.",
  version: "1.0.0",
  priority: 35,
  featureFlags: ["projects"],
  navigation: [
    {
      name: "Projects",
      href: "/projects",
      icon: KanbanSquare,
      module: "projects",
      order: 35,
    },
  ],
});
