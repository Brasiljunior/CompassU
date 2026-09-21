import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://xvvgalifibyqwebasalx.supabase.co";
const SUPABASE_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  "sb_publishable_lWtjaYYRk4hd1Bb-yKG3eA_CxF4CW9-";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const readJson = async (response) => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};
const serviceHeaders = () => ({
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json",
});
const validType = (value) =>
  ["high_school", "community_college", "university"].includes(value);
const validEmail = (value) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());

async function authorize(request) {
  if (!SERVICE_ROLE_KEY)
    return {
      error: NextResponse.json(
        { error: "Account editing is not configured." },
        { status: 503 },
      ),
    };
  const authorization = request.headers.get("authorization");
  if (!authorization)
    return {
      error: NextResponse.json(
        { error: "Missing authorization" },
        { status: 401 },
      ),
    };
  const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_PUBLIC_KEY, Authorization: authorization },
    cache: "no-store",
  });
  const me = await readJson(userResponse);
  if (!userResponse.ok || !me?.id)
    return {
      error: NextResponse.json(
        { error: "Invalid user session" },
        { status: 401 },
      ),
    };
  const adminResponse = await fetch(
    `${SUPABASE_URL}/rest/v1/admin_users?user_id=eq.${encodeURIComponent(me.id)}&select=user_id,role&limit=1`,
    { headers: serviceHeaders(), cache: "no-store" },
  );
  const admins = await readJson(adminResponse);
  if (!adminResponse.ok || !admins?.length)
    return {
      error: NextResponse.json(
        { error: "Master administrator access is required." },
        { status: 403 },
      ),
    };
  if (admins[0].role !== "master_admin")
    return {
      error: NextResponse.json(
        { error: "Only a master administrator can edit account records." },
        { status: 403 },
      ),
    };
  return { me };
}

async function getIdentity(userId) {
  const response = await fetch(
    `${SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(userId)}`,
    { headers: serviceHeaders(), cache: "no-store" },
  );
  const body = await readJson(response);
  if (!response.ok) throw new Error(body?.message || "Account not found.");
  return body;
}

async function findIdentityByEmail(rawEmail) {
  const email = String(rawEmail || "").trim().toLowerCase();
  if (!validEmail(email)) throw new Error("A valid account email is required.");
  let page = 1;
  while (page <= 100) {
    const response = await fetch(
      `${SUPABASE_URL}/auth/v1/admin/users?page=${page}&per_page=1000`,
      { headers: serviceHeaders(), cache: "no-store" },
    );
    const body = await readJson(response);
    if (!response.ok)
      throw new Error(body?.message || "Unable to locate the account.");
    const users = Array.isArray(body?.users) ? body.users : [];
    const match = users.find(
      (user) => String(user?.email || "").trim().toLowerCase() === email,
    );
    if (match?.id) return match;
    if (users.length < 1000) break;
    page += 1;
  }
  throw new Error(`No CompassU account was found for ${email}.`);
}

async function getAccount(userId) {
  const identity = await getIdentity(userId);
  const email = String(identity?.email || "")
    .trim()
    .toLowerCase();
  const [profileResponse, institutionResponse] = await Promise.all([
    fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=first_name,last_name,state,graduation_year&limit=1`,
      { headers: serviceHeaders(), cache: "no-store" },
    ),
    fetch(
      `${SUPABASE_URL}/rest/v1/account_institutions?email=eq.${encodeURIComponent(email)}&select=institution,institution_type,catalog_institution_id&limit=1`,
      { headers: serviceHeaders(), cache: "no-store" },
    ),
  ]);
  const profiles = await readJson(profileResponse),
    institutions = await readJson(institutionResponse);
  if (!profileResponse.ok || !institutionResponse.ok)
    throw new Error("Unable to load the account record.");
  return {
    id: userId,
    email,
    first_name:
      profiles?.[0]?.first_name || identity?.user_metadata?.first_name || "",
    last_name:
      profiles?.[0]?.last_name || identity?.user_metadata?.last_name || "",
    state: profiles?.[0]?.state || "",
    graduation_year: profiles?.[0]?.graduation_year || "",
    institution: institutions?.[0]?.institution || "",
    institution_type: institutions?.[0]?.institution_type || "high_school",
    is_suspended: Boolean(
      identity?.banned_until && new Date(identity.banned_until) > new Date(),
    ),
    created_at: identity?.created_at || null,
    last_sign_in_at: identity?.last_sign_in_at || null,
    user_metadata: identity?.user_metadata || {},
  };
}

export async function POST(request) {
  try {
    const auth = await authorize(request);
    if (auth.error) return auth.error;
    const body = await request.json().catch(() => ({}));
    let userId = String(body.user_id || "");
    if (!userId && body.email) {
      const identity = await findIdentityByEmail(body.email);
      userId = identity.id;
    }
    if (!userId)
      return NextResponse.json(
        { error: "An account id or email is required." },
        { status: 400 },
      );
    if (body.action === "load")
      return NextResponse.json({ account: await getAccount(userId) });
    if (body.action !== "update")
      return NextResponse.json(
        { error: "Unknown account-edit action." },
        { status: 400 },
      );

    const current = await getAccount(userId);
    const email = String(body.email || "")
      .trim()
      .toLowerCase();
    if (!validEmail(email))
      return NextResponse.json(
        { error: "Enter a valid email address." },
        { status: 400 },
      );
    const institution = String(body.institution || "").trim();
    const institutionType = validType(body.institution_type)
      ? body.institution_type
      : "high_school";
    const graduationYear =
      body.graduation_year === "" || body.graduation_year == null
        ? null
        : Number(body.graduation_year);
    if (
      graduationYear !== null &&
      (!Number.isInteger(graduationYear) ||
        graduationYear < 1900 ||
        graduationYear > 2200)
    )
      return NextResponse.json(
        { error: "Graduation year must be between 1900 and 2200." },
        { status: 400 },
      );

    const authPayload = {
      email,
      email_confirm: true,
      ban_duration: body.is_suspended ? "876000h" : "none",
      user_metadata: {
        ...(current.user_metadata || {}),
        first_name: String(body.first_name || "").trim(),
        last_name: String(body.last_name || "").trim(),
      },
    };
    const authResponse = await fetch(
      `${SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(userId)}`,
      {
        method: "PUT",
        headers: serviceHeaders(),
        body: JSON.stringify(authPayload),
      },
    );
    const authBody = await readJson(authResponse);
    if (!authResponse.ok)
      throw new Error(
        authBody?.message || "Unable to update the authentication account.",
      );

    const profileResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?on_conflict=id`,
      {
        method: "POST",
        headers: {
          ...serviceHeaders(),
          Prefer: "resolution=merge-duplicates,return=minimal",
        },
        body: JSON.stringify({
          id: userId,
          first_name: String(body.first_name || "").trim(),
          last_name: String(body.last_name || "").trim(),
          state: String(body.state || "").trim() || null,
          graduation_year: graduationYear,
          updated_at: new Date().toISOString(),
        }),
      },
    );
    if (!profileResponse.ok)
      throw new Error(
        (await readJson(profileResponse))?.message ||
          "Unable to update the account profile.",
      );

    if (institution) {
      let catalogInstitutionId = null;
      if (institutionType !== "high_school") {
        const catalogResponse = await fetch(
          `${SUPABASE_URL}/rest/v1/institutions?name=eq.${encodeURIComponent(institution)}&select=id&limit=2`,
          { headers: serviceHeaders(), cache: "no-store" },
        );
        const catalog = await readJson(catalogResponse);
        if (
          catalogResponse.ok &&
          Array.isArray(catalog) &&
          catalog.length === 1
        )
          catalogInstitutionId = catalog[0].id;
      }
      const institutionResponse = await fetch(
        `${SUPABASE_URL}/rest/v1/account_institutions?on_conflict=email`,
        {
          method: "POST",
          headers: {
            ...serviceHeaders(),
            Prefer: "resolution=merge-duplicates,return=minimal",
          },
          body: JSON.stringify({
            email,
            institution,
            institution_type: institutionType,
            catalog_institution_id: catalogInstitutionId,
            updated_at: new Date().toISOString(),
          }),
        },
      );
      if (!institutionResponse.ok)
        throw new Error(
          (await readJson(institutionResponse))?.message ||
            "Unable to update the institution assignment.",
        );
      if (current.email && current.email !== email)
        await fetch(
          `${SUPABASE_URL}/rest/v1/account_institutions?email=eq.${encodeURIComponent(current.email)}`,
          { method: "DELETE", headers: serviceHeaders() },
        );
    } else if (current.email) {
      await fetch(
        `${SUPABASE_URL}/rest/v1/account_institutions?email=eq.${encodeURIComponent(current.email)}`,
        { method: "DELETE", headers: serviceHeaders() },
      );
    }

    await fetch(`${SUPABASE_URL}/rest/v1/admin_audit_log`, {
      method: "POST",
      headers: { ...serviceHeaders(), Prefer: "return=minimal" },
      body: JSON.stringify({
        admin_user_id: auth.me.id,
        action: "update_account_information",
        target_user_id: userId,
        details: {
          email_changed: current.email !== email,
          institution_type: institutionType,
          institution_assigned: Boolean(institution),
          access: body.is_suspended ? "suspended" : "active",
        },
      }),
    });
    return NextResponse.json({
      ok: true,
      account: await getAccount(userId),
      message: "Account information updated.",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || "Unable to update the account." },
      { status: 500 },
    );
  }
}
