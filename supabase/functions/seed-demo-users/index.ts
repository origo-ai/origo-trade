import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const users = [
    { email: "admin@origo.com", password: "admin123!", username: "admin", role: "admin" as const },
    { email: "customer@origo.com", password: "customer123!", username: "customer_demo", role: "customer" as const },
  ];

  const results = [];

  for (const u of users) {
    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
    });

    if (authError && !authError.message.includes("already been registered")) {
      results.push({ email: u.email, error: authError.message });
      continue;
    }

    let userId = authData?.user?.id;

    // If user already exists, find their id
    if (!userId) {
      const { data: listData } = await supabase.auth.admin.listUsers();
      const existing = listData?.users?.find((x: any) => x.email === u.email);
      userId = existing?.id;
    }

    if (!userId) {
      results.push({ email: u.email, error: "Could not resolve user id" });
      continue;
    }

    // Upsert profile
    const { error: profileError } = await supabase.from("users").upsert({
      id: userId,
      email: u.email,
      username: u.username,
      is_active: true,
    }, { onConflict: "id" });

    // Upsert role
    const { error: roleError } = await supabase.from("user_roles").upsert({
      user_id: userId,
      role: u.role,
    }, { onConflict: "user_id,role" });

    results.push({
      email: u.email,
      username: u.username,
      role: u.role,
      password: u.password,
      userId,
      profileError: profileError?.message ?? null,
      roleError: roleError?.message ?? null,
    });
  }

  return new Response(JSON.stringify({ results }, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
