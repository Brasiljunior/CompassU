"use client";

import { useEffect } from "react";

export default function InviteOnlyAccessGuard() {
  useEffect(() => {
    const originalFetch = window.fetch.bind(window);
    window.fetch = (input, init) => {
      const raw = typeof input === "string" ? input : input?.url;
      if (raw && raw.includes("/auth/v1/signup")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              error: "invite_only",
              msg: "CompassU accounts are created by invitation only.",
            }),
            { status: 403, headers: { "Content-Type": "application/json" } },
          ),
        );
      }
      return originalFetch(input, init);
    };

    const update = () => {
      const buttons = [...document.querySelectorAll("button")];
      for (const button of buttons) {
        const text = button.textContent?.trim();
        if (text === "Create account") {
          button.style.display = "none";
        }
        if (text === "Start My Journey" || text === "Find My Direction") {
          button.textContent = "Log In to CompassU";
          button.addEventListener("click", () => {
            setTimeout(() => {
              const login = [...document.querySelectorAll("button")].find(
                (b) => b.textContent?.trim() === "Log in",
              );
              login?.click();
            }, 0);
          });
        }
        if (text === "Begin My Journey") {
          button.style.display = "none";
        }
      }

      const panels = [...document.querySelectorAll(".panel")];
      for (const panel of panels) {
        if (panel.querySelector("#compassu-invite-only-notice")) continue;
        const heading = panel.querySelector("h2");
        if (!heading || !/Start your CompassU journey|Welcome back, explorer/i.test(heading.textContent || "")) continue;
        const notice = document.createElement("div");
        notice.id = "compassu-invite-only-notice";
        notice.className = "notice";
        notice.style.marginTop = "14px";
        notice.textContent =
          "CompassU accounts are created by invitation only. If you received an invitation, use the secure link in that email to finish setting up your account. Existing users can log in below.";
        panel.insertBefore(notice, heading.nextSibling);
      }
    };

    update();
    const observer = new MutationObserver(update);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      window.fetch = originalFetch;
    };
  }, []);

  return null;
}
