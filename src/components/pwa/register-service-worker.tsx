"use client";

import { useEffect } from "react";

export function RegisterServiceWorker() {
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (!("serviceWorker" in navigator)) {
      return;
    }

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        });

        if (process.env.NODE_ENV !== "production") {
          console.debug("[PWA] Service worker registered", registration);
        }
      } catch (error) {
        console.error("[PWA] Service worker registration failed", error);
      }
    };

    // Delay registration until page fully loaded to avoid slowing critical path
    if (document.readyState === "complete") {
      register();
    } else {
      const onLoad = () => {
        register();
      };
      window.addEventListener("load", onLoad, { once: true });
      return () => window.removeEventListener("load", onLoad);
    }
  }, []);

  return null;
}

