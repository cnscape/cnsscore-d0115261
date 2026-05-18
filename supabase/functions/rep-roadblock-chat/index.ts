import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const auth = req.headers.get('Authorization');
    if (!auth) return json({ error: 'Unauthorized' }, 401);

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: auth } } }
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const body = await req.json().catch(() => ({}));
    const message = String(body.message || '').slice(0, 2000).trim();
    const assignment_id = body.assignment_id || null;
    if (!message) return json({ error: 'message required' }, 400);

    // log user message
    await admin.from('rep_roadblocks').insert({
      rep_id: user.id, assignment_id, role: 'user', message,
    });

    // load last 10 messages for context
    const { data: history } = await admin.from('rep_roadblocks').select('role, message')
      .eq('rep_id', user.id).order('created_at', { ascending: false }).limit(10);
    const ordered = (history || []).reverse();

    const lovableKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableKey) return json({ error: 'LOVABLE_API_KEY missing' }, 500);

    const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${lovableKey}` },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: 'You are a sales coach helping a rep overcome real roadblocks. Be empathetic, tactical, and specific. Reply in under 140 words with 2-4 concrete actions they can take today. Plain text, no markdown headings.' },
          ...ordered.map((m: any) => ({ role: m.role, content: m.message })),
        ],
      }),
    });
    if (aiRes.status === 429) return json({ error: 'AI rate limit. Try again shortly.' }, 429);
    if (aiRes.status === 402) return json({ error: 'AI credits exhausted.' }, 402);
    if (!aiRes.ok) return json({ error: 'AI error: ' + await aiRes.text() }, 500);

    const ai = await aiRes.json();
    const reply = ai.choices?.[0]?.message?.content ?? 'No suggestion available.';

    await admin.from('rep_roadblocks').insert({
      rep_id: user.id, assignment_id, role: 'assistant', message: reply, suggestion: reply,
    });

    return json({ ok: true, reply });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}