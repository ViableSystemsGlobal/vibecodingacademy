"use client";

import * as React from "react";

const Separator = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { decorative?: boolean }
>(({ className, decorative = false, ...props }, ref) => {
  return (
    <div
      ref={ref}
      role={decorative ? "presentation" : "separator"}
      aria-orientation="horizontal"
      className={`my-3 h-px w-full bg-gray-200 ${className ?? ""}`}
      {...props}
    />
  );
});

Separator.displayName = "Separator";

export { Separator };

