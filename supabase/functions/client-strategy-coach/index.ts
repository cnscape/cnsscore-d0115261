import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { client_id } = await req.json();
    if (!client_id) throw new Error("client_id required");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const [{ data: client }, { data: deals }, { data: leads }] = await Promise.all([
      supabase.from("clients").select("*").eq("id", client_id).single(),
      supabase.from("deals").select("status,revenue,rep_commission,channel,created_at,closed_at,lost_reason").eq("client_id", client_id),
      supabase.from("pipeline_leads").select("stage,lead_score,platform,created_at").limit(500),
    ]);

    const wonDeals = (deals ?? []).filter((d: any) => d.status === "won");
    const totalRevenue = wonDeals.reduce((s: number, d: any) => s + Number(d.revenue || 0), 0);
    const openDeals = (deals ?? []).filter((d: any) => d.status === "open").length;
    const lostDeals = (deals ?? []).filter((d: any) => d.status === "lost");
    const lostReasons = lostDeals.map((d: any) => d.lost_reason).filter(Boolean);

    const summary = {
      client_name: client?.name,
      revenue_model: client?.revenue_model,
      total_deals: deals?.length ?? 0,
      won: wonDeals.length,
      open: openDeals,
      lost: lostDeals.length,
      total_revenue: totalRevenue,
      top_lost_reasons: [...new Set(lostReasons)].slice(0, 5),
      total_leads: leads?.length ?? 0,
    };

    const prompt = `You are a senior sales strategist. Given this client's performance, identify the top 3 BLOCKERS preventing growth and propose specific, tactical MITIGATIONS plus a 7-day revenue plan to close more deals.\n\nDATA:\n${JSON.stringify(summary, null, 2)}\n\nReturn concise markdown with sections: ## Blockers, ## Mitigations, ## 7-Day Revenue Plan.`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a tactical revenue coach. Be specific and actionable." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!res.ok) {
      const t = await res.text();
      return new Response(JSON.stringify({ error: `AI error ${res.status}: ${t}` }), {
        status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const data = await res.json();
    const strategy = data.choices?.[0]?.message?.content ?? "";

    return new Response(JSON.stringify({ summary, strategy }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message ?? String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});