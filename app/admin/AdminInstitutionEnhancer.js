"use client";

import { useEffect } from "react";

const CACHE_KEY = "compassu_admin_institutions";
const TYPE_CACHE_KEY = "compassu_admin_institution_types";
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://xvvgalifibyqwebasalx.supabase.co";
const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  "sb_publishable_lWtjaYYRk4hd1Bb-yKG3eA_CxF4CW9-";
const cleanHeader = (v) =>
  String(v || "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
const normalize = (v) => String(v || "").trim();

function readCache() {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || "{}") || {};
  } catch {
    return {};
  }
}
function writeCache(cache) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {}
}
function readTypeCache() {
  try {
    return JSON.parse(localStorage.getItem(TYPE_CACHE_KEY) || "{}") || {};
  } catch {
    return {};
  }
}
function writeTypeCache(cache) {
  try {
    localStorage.setItem(TYPE_CACHE_KEY, JSON.stringify(cache));
  } catch {}
}
function readSession() {
  try {
    return JSON.parse(localStorage.getItem("compassu_session") || "null");
  } catch {
    return null;
  }
}
function htmlEscape(v) {
  return String(v)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export default function AdminInstitutionEnhancer() {
  useEffect(() => {
    const originalFetch = window.fetch.bind(window);
    let overviewUsers = [];
    let institutionCache = readCache();
    let institutionTypeCache = readTypeCache();
    let individualInstitution = "";
    let individualInstitutionType = "high_school";
    let batchInstitutionByEmail = {};
    let batchInstitutionTypeByEmail = {};
    let filterValue = "";
    let scheduled = false;
    let loadedToken = "";

    async function loadPersistentInstitutions() {
      const session = readSession();
      if (!session?.access_token) return institutionCache;
      try {
        const response = await originalFetch(
          `${SUPABASE_URL}/rest/v1/account_institutions?select=email,institution,institution_type`,
          {
            headers: {
              apikey: SUPABASE_KEY,
              Authorization: `Bearer ${session.access_token}`,
            },
          },
        );
        if (!response.ok) return institutionCache;
        const rows = await response.json();
        const next = { ...institutionCache },
          nextTypes = { ...institutionTypeCache };
        rows.forEach((row) => {
          if (row?.email) {
            const email = String(row.email).trim().toLowerCase();
            next[email] = normalize(row.institution);
            nextTypes[email] = row.institution_type || "high_school";
          }
        });
        institutionCache = next;
        institutionTypeCache = nextTypes;
        writeCache(next);
        writeTypeCache(nextTypes);
        return next;
      } catch {
        return institutionCache;
      }
    }

    async function syncPersistentInstitutions() {
      const session = readSession();
      const token = session?.access_token || "";
      if (!token || token === loadedToken) return;
      loadedToken = token;
      await loadPersistentInstitutions();
      overviewUsers = overviewUsers.map((user) => ({
        ...user,
        institution: normalize(
          user.institution ||
            institutionCache[String(user.email || "").toLowerCase()],
        ),
      }));
      scheduleEnhance();
    }

    async function saveInstitution(
      email,
      institution,
      institutionType = "high_school",
    ) {
      email = String(email || "")
        .trim()
        .toLowerCase();
      institution = normalize(institution);
      institutionType = [
        "high_school",
        "community_college",
        "university",
      ].includes(institutionType)
        ? institutionType
        : "high_school";
      if (!email) return false;
      institutionCache = { ...institutionCache, [email]: institution };
      institutionTypeCache = {
        ...institutionTypeCache,
        [email]: institutionType,
      };
      writeCache(institutionCache);
      writeTypeCache(institutionTypeCache);
      const session = readSession();
      if (!session?.access_token) return false;
      try {
        const response = await originalFetch("/api/admin/institution-sync50k", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            assignments: [
              { email, institution, institution_type: institutionType },
            ],
          }),
        });
        return response.ok;
      } catch (error) {
        console.error(
          "CompassU institution assignment could not be persisted",
          error,
        );
        return false;
      }
    }

    window.fetch = async (input, init) => {
      let nextInit = init,
        action = "",
        requestEmail = "",
        requestInstitution = "",
        requestInstitutionType = "high_school";
      try {
        const rawUrl = typeof input === "string" ? input : input?.url;
        if (rawUrl?.includes("/functions/v1/admin-console") && init?.body) {
          const payload = JSON.parse(init.body);
          action = payload?.action || "";
          requestEmail = String(payload?.email || "")
            .trim()
            .toLowerCase();
          if (action === "invite_user") {
            requestInstitution = normalize(
              payload.institution ||
                batchInstitutionByEmail[requestEmail] ||
                individualInstitution ||
                institutionCache[requestEmail],
            );
            requestInstitutionType =
              payload.institution_type ||
              batchInstitutionTypeByEmail[requestEmail] ||
              individualInstitutionType ||
              "high_school";
            if (requestInstitution) {
              payload.institution = requestInstitution;
              payload.institution_type = requestInstitutionType;
              nextInit = { ...init, body: JSON.stringify(payload) };
            }
          }
        }
      } catch {}
      const response = await originalFetch(input, nextInit);
      try {
        if (
          action === "invite_user" &&
          response.ok &&
          requestEmail &&
          requestInstitution
        )
          await saveInstitution(
            requestEmail,
            requestInstitution,
            requestInstitutionType,
          );
        if (action === "overview" && response.ok) {
          const body = await response.clone().json();
          await loadPersistentInstitutions();
          overviewUsers = (body?.users || []).map((user) => ({
            ...user,
            institution: normalize(
              user?.institution ||
                user?.profile?.institution ||
                user?.user_metadata?.institution ||
                institutionCache[String(user?.email || "").toLowerCase()],
            ),
          }));
          scheduleEnhance();
        }
      } catch {}
      return response;
    };

    async function captureBatchFile(file) {
      if (!file) return;
      try {
        const XLSX = await import("xlsx");
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
        const map = {},
          typeMap = {},
          next = { ...institutionCache };
        rows.forEach((row) => {
          const mapped = {};
          Object.entries(row).forEach(([k, v]) => (mapped[cleanHeader(k)] = v));
          const email = String(mapped.email || mapped.emailaddress || "")
            .trim()
            .toLowerCase();
          const institution = normalize(
            mapped.institution ||
              mapped.school ||
              mapped.college ||
              mapped.organization,
          );
          const rawType = normalize(
            mapped.institutiontype || mapped.schooltype || mapped.type,
          )
            .toLowerCase()
            .replaceAll(" ", "_");
          const institutionType =
            rawType === "community_college" || rawType === "communitycollege"
              ? "community_college"
              : rawType === "university" || rawType === "college"
                ? "university"
                : "high_school";
          if (email && institution) {
            map[email] = institution;
            typeMap[email] = institutionType;
            next[email] = institution;
          }
        });
        batchInstitutionByEmail = map;
        batchInstitutionTypeByEmail = typeMap;
        institutionCache = next;
        writeCache(next);
        scheduleEnhance();
      } catch (error) {
        console.error("CompassU institution column could not be read", error);
      }
    }

    function enhanceInvitePanel() {
      const panel = [...document.querySelectorAll(".adminPanel")].find((el) =>
        el.querySelector("h2")?.textContent?.includes("Add / Assist Account"),
      );
      if (!panel || document.getElementById("compassu-institution-input"))
        return false;
      const emailInput = [...panel.querySelectorAll("input")].find(
        (el) => el.type === "email",
      );
      if (!emailInput) return false;
      const label = document.createElement("label");
      label.id = "compassu-institution-label";
      label.textContent = "Institution";
      const institutionInput = document.createElement("input");
      institutionInput.id = "compassu-institution-input";
      institutionInput.placeholder = "High school, college, or university";
      institutionInput.setAttribute("autocomplete", "organization");
      institutionInput.addEventListener("input", () => {
        individualInstitution = institutionInput.value;
      });
      emailInput.insertAdjacentElement("afterend", institutionInput);
      institutionInput.insertAdjacentElement("beforebegin", label);
      const typeLabel = document.createElement("label");
      typeLabel.textContent = "Institution type";
      const typeSelect = document.createElement("select");
      typeSelect.id = "compassu-institution-type";
      typeSelect.innerHTML =
        '<option value="high_school">High school</option><option value="community_college">Community college</option><option value="university">College or university</option>';
      typeSelect.addEventListener("change", () => {
        individualInstitutionType = typeSelect.value;
      });
      institutionInput.insertAdjacentElement("afterend", typeLabel);
      typeLabel.insertAdjacentElement("afterend", typeSelect);
      const batchText = [...panel.querySelectorAll("p")].find((p) =>
        p.textContent?.includes("First Name, Last Name, and Email"),
      );
      if (batchText)
        batchText.textContent =
          "Upload an Excel or CSV file with First Name, Last Name, Email, Institution, and Institution Type columns. Nothing is sent until you review and confirm.";
      return true;
    }

    function getEmailForRow(row) {
      const known =
        row.dataset.compassuAccountEmail ||
        row
          .querySelector('[data-compassu-canonical-cell="email"]')
          ?.textContent?.trim()
          .toLowerCase() ||
        row
          .querySelector("td:nth-child(2) span")
          ?.textContent?.trim()
          .toLowerCase() ||
        "";
      if (known && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(known)) return known;
      return (
        String(row.textContent || "")
          .match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]
          ?.toLowerCase() || ""
      );
    }
    function getInstitutionForRow(row) {
      const email = getEmailForRow(row);
      const user = overviewUsers.find(
        (u) => String(u.email || "").toLowerCase() === email,
      );
      return normalize(user?.institution || institutionCache[email]) || "—";
    }
    function getInstitutionTypeForRow(row) {
      const type = institutionTypeCache[getEmailForRow(row)] || "high_school";
      return type === "community_college"
        ? "Community college"
        : type === "university"
          ? "College / university"
          : "High school";
    }
    function allInstitutions() {
      return [
        ...new Set(
          [
            ...overviewUsers.map((u) => normalize(u.institution)),
            ...Object.values(institutionCache).map(normalize),
          ].filter(Boolean),
        ),
      ].sort((a, b) => a.localeCompare(b));
    }

    function applyFilter() {
      document.querySelectorAll(".adminTable tbody tr").forEach((row) => {
        const institution = normalize(
          row.querySelector("[data-compassu-institution-cell]")?.textContent,
        );
        row.style.display =
          !filterValue || institution === filterValue ? "" : "none";
      });
    }
    function closeEditModal() {
      document.getElementById("compassu-account-edit-modal")?.remove();
    }

    async function openEditModal(row) {
      closeEditModal();
      const email = getEmailForRow(row);
      if (!email) {
        window.alert("CompassU could not identify this account. Refresh the dashboard and try again.");
        return;
      }
      const user =
        overviewUsers.find(
          (u) => String(u.email || "").toLowerCase() === email,
        ) || {};
      const session = readSession();
      if (!session?.access_token) {
        window.alert("Your administrator session has expired. Sign in again to edit this account.");
        return;
      }
      const loadingBackdrop = document.createElement("div");
      loadingBackdrop.id = "compassu-account-edit-modal";
      loadingBackdrop.className = "adminModalBackdrop";
      loadingBackdrop.innerHTML = `<div class="adminModal"><div class="adminPanelHead"><div><div class="adminKicker">EDIT ACCOUNT INFORMATION</div><h2>Loading account…</h2><p>${htmlEscape(email)}</p></div><button class="btn ghost" type="button" data-edit-close>Close</button></div></div>`;
      document.body.appendChild(loadingBackdrop);
      loadingBackdrop
        .querySelector("[data-edit-close]")
        .addEventListener("click", closeEditModal);
      let account;
      try {
        const response = await originalFetch(
          `${SUPABASE_URL}/functions/v1/admin-console`,
          {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: SUPABASE_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "load_account_edit",
            user_id: user.id || user.user_id || "",
            email,
          }),
          },
        );
        const body = await response.json();
        if (!response.ok)
          throw new Error(body?.error || "Unable to load the account.");
        account = body.account;
      } catch (error) {
        console.error("CompassU account editor could not load", error);
        loadingBackdrop.querySelector("h2").textContent = "Unable to open account";
        loadingBackdrop.querySelector("p").textContent =
          error?.message || "Please refresh the dashboard and try again.";
        return;
      }
      closeEditModal();
      const displayName =
        [account.first_name, account.last_name].filter(Boolean).join(" ") ||
        account.email ||
        "Account";
      const backdrop = document.createElement("div");
      backdrop.id = "compassu-account-edit-modal";
      backdrop.className = "adminModalBackdrop";
      const modal = document.createElement("div");
      modal.className = "adminModal";
      modal.innerHTML = `<div class="adminPanelHead"><div><div class="adminKicker">EDIT ACCOUNT INFORMATION</div><h2>${htmlEscape(displayName)}</h2><p>Editable account and institution fields</p></div><button class="btn ghost" type="button" data-edit-close>Close</button></div><div class="detailSection compassuEditGrid"><label for="compassu-edit-first-name">First name</label><input id="compassu-edit-first-name" value="${htmlEscape(account.first_name || "")}"><label for="compassu-edit-last-name">Last name</label><input id="compassu-edit-last-name" value="${htmlEscape(account.last_name || "")}"><label for="compassu-edit-email">Email</label><input id="compassu-edit-email" type="email" value="${htmlEscape(account.email || "")}"><label for="compassu-edit-state">State</label><input id="compassu-edit-state" value="${htmlEscape(account.state || "")}" maxlength="100"><label for="compassu-edit-graduation-year">Graduation year</label><input id="compassu-edit-graduation-year" type="number" min="1900" max="2200" value="${htmlEscape(account.graduation_year || "")}"><label for="compassu-edit-institution">Home institution</label><input id="compassu-edit-institution" placeholder="High school, college, or university" value="${htmlEscape(account.institution || "")}"><label for="compassu-edit-institution-type">Institution type</label><select id="compassu-edit-institution-type"><option value="high_school" ${account.institution_type === "high_school" ? "selected" : ""}>High school</option><option value="community_college" ${account.institution_type === "community_college" ? "selected" : ""}>Community college</option><option value="university" ${account.institution_type === "university" ? "selected" : ""}>College or university</option></select><label for="compassu-edit-access">Access</label><select id="compassu-edit-access"><option value="active" ${!account.is_suspended ? "selected" : ""}>Active</option><option value="suspended" ${account.is_suspended ? "selected" : ""}>Suspended</option></select><p class="muted">Created date, last sign-in date, and survey status are system records and remain read-only. College and university recommendations are limited to the selected home institution.</p></div><div class="detailActions"><button class="btn primary" type="button" data-edit-save>Save Changes</button><button class="btn ghost" type="button" data-edit-cancel>Cancel</button></div><div data-edit-status></div>`;
      backdrop.appendChild(modal);
      document.body.appendChild(backdrop);
      backdrop.addEventListener("click", (e) => {
        if (e.target === backdrop) closeEditModal();
      });
      modal
        .querySelector("[data-edit-close]")
        .addEventListener("click", closeEditModal);
      modal
        .querySelector("[data-edit-cancel]")
        .addEventListener("click", closeEditModal);
      modal
        .querySelector("[data-edit-save]")
        .addEventListener("click", async () => {
          const saveButton = modal.querySelector("[data-edit-save]"),
            status = modal.querySelector("[data-edit-status]");
          saveButton.disabled = true;
          saveButton.textContent = "Saving…";
          status.textContent = "";
          try {
            const payload = {
              action: "update_account_edit",
              user_id: account.id,
              first_name: modal.querySelector("#compassu-edit-first-name")
                .value,
              last_name: modal.querySelector("#compassu-edit-last-name").value,
              email: modal.querySelector("#compassu-edit-email").value,
              state: modal.querySelector("#compassu-edit-state").value,
              graduation_year: modal.querySelector(
                "#compassu-edit-graduation-year",
              ).value,
              institution: modal.querySelector("#compassu-edit-institution")
                .value,
              institution_type: modal.querySelector(
                "#compassu-edit-institution-type",
              ).value,
              is_suspended:
                modal.querySelector("#compassu-edit-access").value ===
                "suspended",
            };
            const response = await originalFetch(
              `${SUPABASE_URL}/functions/v1/admin-console`,
              {
              method: "POST",
              headers: {
                Authorization: `Bearer ${session.access_token}`,
                apikey: SUPABASE_KEY,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(payload),
              },
            );
            const body = await response.json();
            if (!response.ok)
              throw new Error(
                body?.error || "Unable to save the account update.",
              );
            const updated = body.account;
            institutionCache = {
              ...institutionCache,
              [String(updated.email).toLowerCase()]: updated.institution || "",
            };
            institutionTypeCache = {
              ...institutionTypeCache,
              [String(updated.email).toLowerCase()]:
                updated.institution_type || "high_school",
            };
            writeCache(institutionCache);
            writeTypeCache(institutionTypeCache);
            window.dispatchEvent(
              new CustomEvent("compassu:institutions-updated"),
            );
            const refresh = [...document.querySelectorAll("button")].find(
              (button) => button.textContent?.includes("Refresh Dashboard"),
            );
            if (refresh && !refresh.disabled) refresh.click();
            closeEditModal();
          } catch (error) {
            saveButton.disabled = false;
            saveButton.textContent = "Save Changes";
            status.className = "error adminNotice";
            status.textContent =
              error.message ||
              "Unable to save the account update. Please try again.";
          }
        });
    }

    function enhanceTable() {
      const table = document.querySelector(".adminTable");
      if (!table) return false;
      let changed = false;
      const headerRow = table.querySelector("thead tr"),
        firstHeader = headerRow?.querySelector("th");
      const canonicalInstitutionHead = headerRow?.querySelector(
        '[data-compassu-canonical-head="institution"]',
      );
      if (canonicalInstitutionHead)
        canonicalInstitutionHead.dataset.compassuInstitutionHead = "1";
      else if (
        firstHeader &&
        !headerRow.querySelector("[data-compassu-institution-head]")
      ) {
        const th = document.createElement("th");
        th.textContent = "Institution";
        th.dataset.compassuInstitutionHead = "1";
        firstHeader.insertAdjacentElement("afterend", th);
        changed = true;
      }
      if (
        headerRow &&
        !headerRow.querySelector("[data-compassu-institution-type-head]")
      ) {
        const institutionHead = headerRow.querySelector(
          "[data-compassu-institution-head]",
        );
        if (institutionHead) {
          const th = document.createElement("th");
          th.textContent = "Institution Type";
          th.dataset.compassuInstitutionTypeHead = "1";
          institutionHead.insertAdjacentElement("afterend", th);
          changed = true;
        }
      }
      table.querySelectorAll("tbody tr").forEach((row) => {
        const firstCell = row.querySelector("td");
        let td =
          row.querySelector("[data-compassu-institution-cell]") ||
          row.querySelector('[data-compassu-canonical-cell="institution"]');
        if (td) td.dataset.compassuInstitutionCell = "1";
        else if (firstCell) {
          td = document.createElement("td");
          td.dataset.compassuInstitutionCell = "1";
          firstCell.insertAdjacentElement("afterend", td);
          changed = true;
        }
        if (td) {
          const nextValue = getInstitutionForRow(row);
          if (td.textContent !== nextValue) {
            td.textContent = nextValue;
            changed = true;
          }
        }
        let typeCell = row.querySelector(
          "[data-compassu-institution-type-cell]",
        );
        if (!typeCell && td) {
          typeCell = document.createElement("td");
          typeCell.dataset.compassuInstitutionTypeCell = "1";
          td.insertAdjacentElement("afterend", typeCell);
          changed = true;
        }
        if (typeCell) {
          const nextType = getInstitutionTypeForRow(row);
          if (typeCell.textContent !== nextType) {
            typeCell.textContent = nextType;
            changed = true;
          }
        }
        const actions = row.querySelector(".adminRowActions");
        if (actions && !actions.querySelector("[data-compassu-edit-account]")) {
          const edit = document.createElement("button");
          edit.type = "button";
          edit.textContent = "Edit";
          edit.dataset.compassuEditAccount = "1";
          edit.addEventListener("click", () => openEditModal(row));
          actions.insertAdjacentElement("afterbegin", edit);
          changed = true;
        }
      });
      applyFilter();
      return changed;
    }

    function enhanceFilter() {
      const actions = document.querySelector(
        ".adminAccounts .adminPanelActions",
      );
      if (!actions) return false;
      let changed = false;
      let select = document.getElementById("compassu-institution-filter");
      if (!select) {
        select = document.createElement("select");
        select.id = "compassu-institution-filter";
        select.className = "adminSearch";
        select.setAttribute("aria-label", "Filter accounts by institution");
        select.style.minWidth = "210px";
        select.addEventListener("change", () => {
          filterValue = select.value;
          applyFilter();
        });
        actions.insertAdjacentElement("afterbegin", select);
        changed = true;
      }
      const institutions = allInstitutions(),
        optionMarkup =
          '<option value="">All institutions</option>' +
          institutions
            .map(
              (v) =>
                `<option value="${htmlEscape(v)}">${htmlEscape(v)}</option>`,
            )
            .join("");
      if (select.innerHTML !== optionMarkup) {
        const previous = filterValue;
        select.innerHTML = optionMarkup;
        if (institutions.includes(previous)) select.value = previous;
        else {
          filterValue = "";
          select.value = "";
        }
        changed = true;
      }
      return changed;
    }

    function enhanceDashboard() {
      enhanceInvitePanel();
      enhanceFilter();
      enhanceTable();
    }
    function scheduleEnhance() {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        enhanceDashboard();
      });
    }

    const fileListener = (e) => {
      const input = e.target;
      if (input?.matches?.('input[type="file"][accept*=".csv"]'))
        captureBatchFile(input.files?.[0]);
    };
    document.addEventListener("change", fileListener, true);
    const observer = new MutationObserver(() => scheduleEnhance());
    observer.observe(document.body, { childList: true, subtree: true });
    scheduleEnhance();
    syncPersistentInstitutions();
    const sessionTimer = setInterval(syncPersistentInstitutions, 500);

    return () => {
      window.fetch = originalFetch;
      observer.disconnect();
      clearInterval(sessionTimer);
      document.removeEventListener("change", fileListener, true);
      closeEditModal();
    };
  }, []);
  return null;
}
