import { NextResponse } from "next/server";

export const runtime = "nodejs";

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
});

export async function GET(request) {
  try {
    if (!SERVICE_ROLE_KEY)
      return NextResponse.json(
        { error: "Recommendation scoping is not configured." },
        { status: 503 },
      );
    const authorization = request.headers.get("authorization");
    if (!authorization)
      return NextResponse.json(
        { error: "Missing authorization" },
        { status: 401 },
      );

    const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SUPABASE_PUBLIC_KEY, Authorization: authorization },
      cache: "no-store",
    });
    const user = await readJson(userResponse);
    if (!userResponse.ok || !user?.email)
      return NextResponse.json(
        { error: "Invalid user session" },
        { status: 401 },
      );

    const email = String(user.email).trim().toLowerCase();
    const url = new URL(`${SUPABASE_URL}/rest/v1/account_institutions`);
    url.searchParams.set("email", `eq.${email}`);
    url.searchParams.set(
      "select",
      "institution,institution_type,catalog_institution_id,tenant_institutions(catalog_institution_id)",
    );
    url.searchParams.set("limit", "1");
    const associationResponse = await fetch(url, {
      headers: serviceHeaders(),
      cache: "no-store",
    });
    const associations = await readJson(associationResponse);
    if (!associationResponse.ok)
      throw new Error(
        associations?.message || "Unable to load the account institution.",
      );

    const association = associations?.[0];
    if (!association)
      return NextResponse.json({
        mode: "open",
        institution_type: null,
        institution: null,
        institution_id: null,
      });
    const institutionType = association.institution_type || "high_school";
    if (institutionType === "high_school")
      return NextResponse.json({
        mode: "open",
        institution_type: institutionType,
        institution: association.institution,
        institution_id: null,
      });

    let institutionId =
      association.catalog_institution_id ||
      association.tenant_institutions?.catalog_institution_id ||
      null;
    if (!institutionId && association.institution) {
      const catalogUrl = new URL(`${SUPABASE_URL}/rest/v1/institutions`);
      catalogUrl.searchParams.set("name", `eq.${association.institution}`);
      catalogUrl.searchParams.set("select", "id,name");
      catalogUrl.searchParams.set("limit", "2");
      const catalogResponse = await fetch(catalogUrl, {
        headers: serviceHeaders(),
        cache: "no-store",
      });
      const catalogRows = await readJson(catalogResponse);
      if (
        catalogResponse.ok &&
        Array.isArray(catalogRows) &&
        catalogRows.length === 1
      )
        institutionId = catalogRows[0].id;
    }

    return NextResponse.json({
      mode: "home_institution",
      institution_type: institutionType,
      institution: association.institution,
      institution_id: institutionId,
      configured: Boolean(institutionId),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error?.message || "Unable to determine recommendation scope." },
      { status: 500 },
    );
  }
}
