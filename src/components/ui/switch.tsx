"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface SwitchProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "onChange"> {
  onCheckedChange?: (checked: boolean) => void;
  label?: string;
  labelPosition?: "left" | "right";
}

const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  (
    { className, onCheckedChange, label, labelPosition = "right", disabled, ...props },
    ref
  ) => {
    return (
      <label
        className={cn(
          "inline-flex items-center gap-2 text-sm font-medium text-gray-700",
          disabled && "opacity-50 cursor-not-allowed",
          className
        )}
      >
        {label && labelPosition === "left" ? label : null}
        <span className="relative inline-flex items-center">
          <input
            ref={ref}
            type="checkbox"
            className="peer sr-only"
            disabled={disabled}
            onChange={(event) => {
              onCheckedChange?.(event.target.checked);
              props.onChange?.(event);
            }}
            {...props}
          />
          <span
            aria-hidden="true"
            className={cn(
              "inline-flex h-6 w-11 items-center rounded-full border-2 border-transparent transition-colors",
              "bg-gray-300 peer-checked:bg-[#23185c]"
            )}
          >
            <span
              className={cn(
                "inline-block h-5 w-5 translate-x-0 rounded-full bg-white shadow-lg transition-transform",
                "peer-checked:translate-x-5"
              )}
            />
          </span>
        </span>
        {label && labelPosition === "right" ? label : null}
      </label>
    );
  }
);

Switch.displayName = "Switch";

export { Switch };

