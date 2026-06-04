import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Gauge } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
} from 'recharts';
import type { StageVelocityAverage, StageVelocityRow } from '@/lib/supabase-types';

const STAGE_ORDER = [
  'discovery_scheduled',
  'discovery_booked',
  'discovery_completed',
  'proposal_sent',
  'negotiation',
  'closed_won',
  'closed_lost',
];

const formatStage = (s: string) =>
  s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export function PipelineVelocityChart() {
  const [data, setData] = useState<StageVelocityAverage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      // The view isn't in generated types — cast through unknown.
      const res = await (supabase as unknown as {
        from: (t: string) => {
          select: (cols: string) => Promise<{ data: StageVelocityRow[] | null; error: unknown }>;
        };
      })
        .from('stage_velocity_analytics')
        .select('deal_id, stage_name, entered_at, exited_at, days_spent');

      if (!res.data) {
        setData([]);
        setLoading(false);
        return;
      }

      const buckets = new Map<string, { total: number; count: number }>();
      for (const row of res.data) {
        if (!row.stage_name || row.days_spent == null) continue;
        const b = buckets.get(row.stage_name) ?? { total: 0, count: 0 };
        b.total += Number(row.days_spent);
        b.count += 1;
        buckets.set(row.stage_name, b);
      }

      const aggregated: StageVelocityAverage[] = Array.from(buckets.entries())
        .map(([stage_name, { total, count }]) => ({
          stage_name,
          avg_days: count > 0 ? total / count : 0,
          sample_size: count,
        }))
        .sort((a, b) => {
          const ai = STAGE_ORDER.indexOf(a.stage_name);
          const bi = STAGE_ORDER.indexOf(b.stage_name);
          if (ai === -1 && bi === -1) return a.stage_name.localeCompare(b.stage_name);
          if (ai === -1) return 1;
          if (bi === -1) return -1;
          return ai - bi;
        });

      setData(aggregated);
      setLoading(false);
    };
    load();
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Gauge className="h-5 w-5 text-primary" />
          Average Pipeline Velocity
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Average days deals spend in each pipeline stage
        </p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center h-72">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : data.length === 0 ? (
          <div className="flex items-center justify-center h-72 text-muted-foreground text-sm">
            No stage velocity data yet
          </div>
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 12, right: 16, left: 0, bottom: 32 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="stage_name"
                  tickFormatter={formatStage}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                  angle={-20}
                  textAnchor="end"
                  height={60}
                  stroke="hsl(var(--border))"
                />
                <YAxis
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                  stroke="hsl(var(--border))"
                  label={{
                    value: 'Avg Days',
                    angle: -90,
                    position: 'insideLeft',
                    style: { fill: 'hsl(var(--muted-foreground))', fontSize: 12 },
                  }}
                />
                <Tooltip
                  cursor={{ fill: 'hsl(var(--muted) / 0.4)' }}
                  contentStyle={{
                    background: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 12,
                    color: 'hsl(var(--popover-foreground))',
                  }}
                  formatter={(value: number, _name, props) => [
                    `${value.toFixed(1)} days (n=${props.payload.sample_size})`,
                    'Avg time in stage',
                  ]}
                  labelFormatter={(l: string) => formatStage(l)}
                />
                <Bar dataKey="avg_days" radius={[8, 8, 0, 0]}>
                  {data.map((entry) => (
                    <Cell
                      key={entry.stage_name}
                      fill={
                        entry.stage_name === 'closed_won'
                          ? 'hsl(var(--status-green))'
                          : entry.stage_name === 'closed_lost'
                          ? 'hsl(var(--destructive))'
                          : 'hsl(var(--primary))'
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}