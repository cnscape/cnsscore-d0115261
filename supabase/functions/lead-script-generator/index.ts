import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { lead_id, ceo_name, closer_name } = await req.json();
    if (!lead_id) {
      return new Response(JSON.stringify({ error: 'lead_id is required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const leadRes = await fetch(`${SUPABASE_URL}/rest/v1/pipeline_leads?id=eq.${lead_id}&select=*`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
    });
    const leads = await leadRes.json();
    const lead = Array.isArray(leads) ? leads[0] : null;
    if (!lead) {
      return new Response(JSON.stringify({ error: 'Lead not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const firstName = (lead.lead_name || 'there').split(' ')[0];
    const angle = lead.angle || lead.notes || 'your current setup';
    const notes = lead.notes || 'No additional context.';
    const loom = lead.loom_link || '[Loom link pending]';
    const ceo = ceo_name || 'our CEO';
    const closer = closer_name || 'our Senior Growth Strategist';

    const systemPrompt = `You are the CNS Sales Assistant, hardcoded to execute the CNS Sales Pipeline SOP (CNS-SOP-005). Generate hyper-personalized outreach messages for the Scout (Tier 2) to send. Do NOT write generic marketing fluff. Use the exact framework structures while making the details deeply native to the lead's profile. Tone: casual, observant, authoritative yet low-pressure.`;

    const userPrompt = `INPUT DATA:
- Lead Name: ${lead.lead_name}
- First Name: ${firstName}
- Lead Socials/Platform: ${lead.lead_socials || lead.platform || 'N/A'}
- Angle / Botched System Spotted: ${angle}
- Strategic Notes / Pain Point: ${notes}
- CEO Name: ${ceo}
- CEO's Custom Loom Link: ${loom}
- Closer's Name: ${closer}

TASK: Generate the 3 stages. Return ONLY via the tool call.

STAGE 1 — THE PATTERN INTERRUPT & PERMISSION DROP (IG/LinkedIn DM):
Reference the specific angle. Frame as CEO spotting an operational gap. Low pressure.
Structure: "Hey ${firstName} — caught your recent setup/content regarding [SPECIFIC ANGLE]. My CEO was looking at your setup yesterday and spotted a specific operational gap that's probably costing you a decent amount of time every week. He filmed a quick 2-minute video just for you showing exactly what it is and how to fix it. No pitch. Pure value. Want me to drop the link over?"

STAGE 2 — THE VIBE WINDOW & DIALOGUE OPENER (after they say yes + watch Loom):
Structure: "Right? ${ceo} is genuinely obsessed with building these systems 😂 But honestly — looking at it from the outside, managing [SPECIFIC ANGLE] looks like a full second job on top of everything you're already doing. How much time are you actually losing to the admin stuff every week?"

STAGE 3 — THE CALL BOOKING SCRIPT (Performance-Based Model):
Position ${closer} as a Senior Growth Strategist offering a screen-share blueprint session.
Structure: "Honestly — you should be focused entirely on your content and your people, not playing tech support. What we do is step in as growth operators — we engineer and manage the entire backend for you. And our model is performance-based: we handle the setup, and then we take a percentage of the new revenue we create together. So there's no flat retainer risk on your side. ${closer}, our senior growth strategist, has a few slots open this week. He'll pull up a screen share, look at your specific numbers, and map out a clean blueprint for your setup. No pressure — just strategy. How does [Day] at [Time] SAST look for you?"

Make every message deeply native to this specific lead's angle and notes. Keep CNS framework structure intact.`;

    const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'return_cns_scripts',
            description: 'Return the 3 CNS framework scripts.',
            parameters: {
              type: 'object',
              properties: {
                stage1_pattern_interrupt: { type: 'string', description: 'Stage 1 DM script' },
                stage2_vibe_window: { type: 'string', description: 'Stage 2 dialogue opener' },
                stage3_call_booking: { type: 'string', description: 'Stage 3 booking pitch' },
              },
              required: ['stage1_pattern_interrupt', 'stage2_vibe_window', 'stage3_call_booking'],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: 'function', function: { name: 'return_cns_scripts' } },
      }),
    });

    if (!aiRes.ok) {
      const t = await aiRes.text();
      if (aiRes.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit hit. Try again shortly.' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (aiRes.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits exhausted. Top up workspace.' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      console.error('AI error', aiRes.status, t);
      return new Response(JSON.stringify({ error: 'AI gateway error' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await aiRes.json();
    const args = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    const parsed = args ? JSON.parse(args) : null;

    if (!parsed) {
      return new Response(JSON.stringify({ error: 'AI returned no scripts' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      stage1: parsed.stage1_pattern_interrupt,
      stage2: parsed.stage2_vibe_window,
      stage3: parsed.stage3_call_booking,
      lead: { name: lead.lead_name, angle, platform: lead.platform, socials: lead.lead_socials },
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error('lead-script-generator error', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});