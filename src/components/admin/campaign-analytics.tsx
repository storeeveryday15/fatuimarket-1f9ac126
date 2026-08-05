import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";

type Recipient = {
  token: string;
  announcement_id: string | null;
  email: string;
  status: string;
  created_at: string;
};

type EmailEvent = {
  recipient_token: string | null;
  announcement_id: string | null;
  email: string | null;
  event: string;
  url: string | null;
  device: string | null;
  client: string | null;
  country: string | null;
  created_at: string;
};

type Campaign = { id: string; title: string; created_at: string };

const PIE_COLORS = ["#b13bff", "#e455ff", "#6b5cff", "#38bdf8", "#f59e0b", "#64748b"];

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="surface-card p-3">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-bold">{value}</div>
      {hint && <div className="mt-0.5 text-[10px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

function Unavailable({ label }: { label: string }) {
  return (
    <div className="surface-card p-3 opacity-60">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-semibold text-muted-foreground">Unavailable</div>
      <div className="mt-0.5 text-[10px] text-muted-foreground">Not reported by the sending provider</div>
    </div>
  );
}

function Chart({ title, children, empty }: { title: string; children: React.ReactElement; empty: boolean }) {
  return (
    <div className="surface-card p-4">
      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{title}</h4>
      <div className="mt-3 h-56">
        {empty ? (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">No data yet</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

export function CampaignAnalytics() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignId, setCampaignId] = useState<string>("all");
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [events, setEvents] = useState<EmailEvent[]>([]);
  const [search, setSearch] = useState("");

  const load = async () => {
    const [{ data: ann }, { data: recs }, { data: evs }] = await Promise.all([
      supabase.from("announcements").select("id,title,created_at").order("created_at", { ascending: false }).limit(50),
      supabase.from("email_recipients").select("token,announcement_id,email,status,created_at").order("created_at", { ascending: false }).limit(5000),
      supabase.from("email_events").select("recipient_token,announcement_id,email,event,url,device,client,country,created_at").order("created_at", { ascending: false }).limit(5000),
    ]);
    setCampaigns((ann ?? []) as Campaign[]);
    setRecipients((recs ?? []) as Recipient[]);
    setEvents((evs ?? []) as EmailEvent[]);
  };

  useEffect(() => {
    void load();
    const ch = supabase
      .channel("admin-email-analytics")
      .on("postgres_changes", { event: "*", schema: "public", table: "email_events" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "email_recipients" }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, []);

  const scopedRecipients = useMemo(
    () => (campaignId === "all" ? recipients : recipients.filter((r) => r.announcement_id === campaignId)),
    [recipients, campaignId],
  );
  const scopedEvents = useMemo(
    () => (campaignId === "all" ? events : events.filter((e) => e.announcement_id === campaignId)),
    [events, campaignId],
  );

  const sent = scopedRecipients.filter((r) => r.status === "sent").length;
  const opens = scopedEvents.filter((e) => e.event === "open");
  const clicks = scopedEvents.filter((e) => e.event === "click");
  const uniqueOpens = new Set(opens.map((e) => e.recipient_token)).size;
  const uniqueClicks = new Set(clicks.map((e) => e.recipient_token)).size;
  const bounced = scopedEvents.filter((e) => e.event === "bounce").length;
  const complaints = scopedEvents.filter((e) => e.event === "complaint").length;
  const unsubscribed = scopedEvents.filter((e) => e.event === "unsubscribe").length;
  const pct = (n: number) => (sent ? `${((n / sent) * 100).toFixed(1)}%` : "0%");

  const byDay = (list: EmailEvent[]) => {
    const m = new Map<string, number>();
    for (const e of list) {
      const day = new Date(e.created_at).toISOString().slice(0, 10);
      m.set(day, (m.get(day) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([day, count]) => ({ day: day.slice(5), count }));
  };

  const countBy = (list: EmailEvent[], key: (e: EmailEvent) => string | null) => {
    const m = new Map<string, number>();
    for (const e of list) {
      const k = key(e) || "Unknown";
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));
  };

  const opensSeries = byDay(opens);
  const clicksSeries = byDay(clicks);
  const topLinks = countBy(clicks, (e) => (e.url ? e.url.replace(/^https?:\/\//, "").slice(0, 34) : null)).slice(0, 6);
  const devices = countBy([...opens, ...clicks], (e) => e.device);
  const clients = countBy([...opens, ...clicks], (e) => e.client);
  const countries = countBy([...opens, ...clicks], (e) => e.country).slice(0, 8);

  const timeline = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = scopedRecipients.filter((r) => !q || r.email.toLowerCase().includes(q)).slice(0, 100);
    return rows.map((r) => {
      const evs = scopedEvents.filter((e) => e.recipient_token === r.token);
      const first = (name: string) => evs.filter((e) => e.event === name).sort((a, b) => a.created_at.localeCompare(b.created_at))[0]?.created_at ?? null;
      return {
        ...r,
        opened: first("open"),
        clicked: first("click"),
        bounced: first("bounce"),
        unsubscribed: first("unsubscribe"),
      };
    });
  }, [scopedRecipients, scopedEvents, search]);

  const fmt = (v: string | null) => (v ? new Date(v).toLocaleString() : "—");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={campaignId}
          onChange={(e) => setCampaignId(e.target.value)}
          className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="all">All campaigns</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>{c.title}</option>
          ))}
        </select>
        <p className="text-[11px] text-muted-foreground">
          Opens are best-effort — recipients who block images are not counted.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        <Stat label="Sent" value={String(sent)} />
        <Unavailable label="Delivered" />
        <Unavailable label="Inbox placement" />
        <Unavailable label="Promotions" />
        <Stat label="Opened" value={String(uniqueOpens)} hint={`${opens.length} total opens`} />
        <Stat label="Open rate" value={pct(uniqueOpens)} />
        <Stat label="Link clicks" value={String(clicks.length)} hint={`${uniqueClicks} unique`} />
        <Stat label="CTR" value={pct(uniqueClicks)} />
        <Stat label="Bounced" value={String(bounced)} />
        <Stat label="Unsubscribed" value={String(unsubscribed)} />
        <Stat label="Spam complaints" value={String(complaints)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Chart title="Opens over time" empty={!opensSeries.length}>
          <LineChart data={opensSeries}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
            <XAxis dataKey="day" fontSize={11} />
            <YAxis fontSize={11} allowDecimals={false} />
            <Tooltip />
            <Line type="monotone" dataKey="count" stroke="#b13bff" strokeWidth={2} dot={false} />
          </LineChart>
        </Chart>
        <Chart title="Clicks over time" empty={!clicksSeries.length}>
          <LineChart data={clicksSeries}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
            <XAxis dataKey="day" fontSize={11} />
            <YAxis fontSize={11} allowDecimals={false} />
            <Tooltip />
            <Line type="monotone" dataKey="count" stroke="#38bdf8" strokeWidth={2} dot={false} />
          </LineChart>
        </Chart>
        <Chart title="Top clicked links" empty={!topLinks.length}>
          <BarChart data={topLinks} layout="vertical" margin={{ left: 20 }}>
            <XAxis type="number" fontSize={11} allowDecimals={false} />
            <YAxis type="category" dataKey="name" width={150} fontSize={10} />
            <Tooltip />
            <Bar dataKey="value" fill="#e455ff" radius={4} />
          </BarChart>
        </Chart>
        <Chart title="Device split" empty={!devices.length}>
          <PieChart>
            <Pie data={devices} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} label>
              {devices.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
            </Pie>
            <Tooltip />
          </PieChart>
        </Chart>
        <Chart title="Email client" empty={!clients.length}>
          <PieChart>
            <Pie data={clients} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} label>
              {clients.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
            </Pie>
            <Tooltip />
          </PieChart>
        </Chart>
        <Chart title="Country" empty={!countries.length}>
          <BarChart data={countries}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
            <XAxis dataKey="name" fontSize={11} />
            <YAxis fontSize={11} allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="value" fill="#6b5cff" radius={4} />
          </BarChart>
        </Chart>
      </div>

      <div className="surface-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Customer timeline</h4>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search email"
            className="rounded-lg border border-input bg-background px-3 py-1.5 text-xs"
          />
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-muted-foreground">
              <tr>
                <th className="py-2 pr-3">Recipient</th>
                <th className="py-2 pr-3">Sent</th>
                <th className="py-2 pr-3">Opened</th>
                <th className="py-2 pr-3">Clicked</th>
                <th className="py-2 pr-3">Bounced</th>
                <th className="py-2 pr-3">Unsubscribed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {timeline.map((r) => (
                <tr key={r.token}>
                  <td className="py-2 pr-3 font-medium">{r.email}</td>
                  <td className="py-2 pr-3 text-muted-foreground">{fmt(r.created_at)}</td>
                  <td className="py-2 pr-3 text-muted-foreground">{fmt(r.opened)}</td>
                  <td className="py-2 pr-3 text-muted-foreground">{fmt(r.clicked)}</td>
                  <td className="py-2 pr-3 text-muted-foreground">{fmt(r.bounced)}</td>
                  <td className="py-2 pr-3 text-muted-foreground">{fmt(r.unsubscribed)}</td>
                </tr>
              ))}
              {!timeline.length && (
                <tr><td colSpan={6} className="py-4 text-muted-foreground">No sends recorded yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
