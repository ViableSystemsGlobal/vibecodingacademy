import { Calendar, CheckSquare } from "lucide-react";

import { defineModule } from "../define-module";

export default defineModule({
  slug: "tasks",
  displayName: "Task Management",
  description: "Personal and team task tracking workflows.",
  version: "1.0.0",
  priority: 90,
  navigation: [
    {
      name: "Tasks",
      href: "/tasks",
      icon: CheckSquare,
      module: "tasks",
      order: 90,
      children: [
        { name: "All Tasks", href: "/tasks", icon: CheckSquare, module: "tasks", order: 10 },
        { name: "My Tasks", href: "/tasks/my", icon: Calendar, module: "my-tasks", order: 20 },
      ],
    },
  ],
});
