"use client";

import { useEffect } from "react";

const CACHE_KEY = "compassu_admin_institutions";
const readSession = () => {
  try {
    return JSON.parse(localStorage.getItem("compassu_session") || "null");
  } catch {
    return null;
  }
};
const readCache = () => {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || "{}") || {};
  } catch {
    return {};
  }
};
const validEmail = (v) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || "").trim());

export default function Admin50kInstitutionFileSync() {
  useEffect(() => {
    let busy = false;

    const refreshDashboard = () => {
      const button = [...document.querySelectorAll("button")].find((b) =>
        b.textContent?.includes("Refresh Dashboard"),
      );
      if (button && !button.disabled) setTimeout(() => button.click(), 250);
    };

    const showNotice = (text, isError = false) => {
      const root =
        document.querySelector(".batch500Root") ||
        document.querySelector(".adminBatch") ||
        document.querySelector(".adminMain");
      if (!root) return;
      const notice = document.createElement("div");
      notice.className = isError ? "error adminNotice" : "success adminNotice";
      notice.textContent = text;
      root.prepend(notice);
      setTimeout(() => notice.remove(), 9000);
    };

    const syncAssignments = async (assignments, { silent = false } = {}) => {
      const session = readSession();
      if (!session?.access_token || busy) return null;
      const deduped = [
        ...new Map(
          (assignments || [])
            .map((item) => {
              const email = String(item?.email || "")
                .trim()
                .toLowerCase();
              const institution = String(item?.institution || "").trim();
              const institution_type = [
                "high_school",
                "community_college",
                "university",
              ].includes(item?.institution_type)
                ? item.institution_type
                : "high_school";
              return [email, { email, institution, institution_type }];
            })
            .filter(([email, row]) => validEmail(email) && row.institution),
        ).values(),
      ];
      if (!deduped.length) return { synced: 0 };
      busy = true;
      try {
        let synced = 0;
        for (let i = 0; i < deduped.length; i += 500) {
          const chunk = deduped.slice(i, i + 500);
          const r = await fetch("/api/admin/institution-sync50k", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ assignments: chunk }),
          });
          const b = await r.json().catch(() => ({}));
          if (!r.ok)
            throw new Error(
              b?.error || "Unable to sync institution associations.",
            );
          synced += Number(b?.synced || 0);
        }
        window.dispatchEvent(new CustomEvent("compassu:institutions-updated"));
        if (!silent)
          showNotice(
            `Institution associations synchronized for ${synced} account${synced === 1 ? "" : "s"}.`,
          );
        refreshDashboard();
        return { synced };
      } catch (error) {
        console.error("CompassU institution sync failed", error);
        if (!silent)
          showNotice(
            error?.message || "Unable to sync institution associations.",
            true,
          );
        return null;
      } finally {
        busy = false;
      }
    };

    const recoverCachedAssociations = async () => {
      const cache = readCache();
      const assignments = Object.entries(cache)
        .map(([email, institution]) => ({ email, institution }))
        .filter(
          (x) => validEmail(x.email) && String(x.institution || "").trim(),
        );
      if (assignments.length)
        await syncAssignments(assignments, { silent: true });
    };

    const onParsedAssignments = (event) => {
      const assignments = Array.isArray(event?.detail?.assignments)
        ? event.detail.assignments
        : [];
      if (assignments.length) syncAssignments(assignments);
    };

    window.addEventListener(
      "compassu:institution-file-assignments",
      onParsedAssignments,
    );
    const timer = setTimeout(recoverCachedAssociations, 1200);
    return () => {
      clearTimeout(timer);
      window.removeEventListener(
        "compassu:institution-file-assignments",
        onParsedAssignments,
      );
    };
  }, []);
  return null;
}
