import { useEffect, useState } from "react";
import { ShieldCheck, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type HealthResponse = {
  hydradb: "connected" | "failed";
  lovable: "connected" | "failed";
  elevenlabs: "connected" | "failed";
  elevenlabs_voice_id: "valid" | "invalid";
};

function HealthRow({ label, value }: { label: string; value: string }) {
  const ok = value === "connected" || value === "valid";
  return (
    <div className="flex items-center justify-between rounded-[20px] border border-[#EEF2F7] px-5 py-4">
      <div className="flex items-center gap-3">
        {ok ? <ShieldCheck className="h-5 w-5 text-[#16A34A]" /> : <ShieldAlert className="h-5 w-5 text-[#DC2626]" />}
        <span className="text-sm font-medium text-slate-900">{label}</span>
      </div>
      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${ok ? "bg-[#ECFDF3] text-[#16A34A]" : "bg-[#FEF2F2] text-[#DC2626]"}`}>
        {value} {ok ? "✓" : "✗"}
      </span>
    </div>
  );
}

export default function Settings() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      try {
        const { data } = await supabase.functions.invoke("test-keys", { body: {} });
        setHealth(data as HealthResponse);
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, []);

  return (
    <div className="space-y-8">
      <section className="dashboard-card p-8">
        <h1 className="text-2xl font-bold tracking-[-0.04em] text-slate-900">System Health</h1>
        <p className="mt-2 text-sm text-slate-500">Hidden backend connectivity checks for memory, AI, and voice services.</p>
      </section>

      <section className="dashboard-card p-8">
        {loading ? (
          <p className="text-sm text-slate-500">Checking services...</p>
        ) : health ? (
          <div className="space-y-4">
            <HealthRow label="HydraDB Memory" value={health.hydradb} />
            <HealthRow label="Lovable AI Engine" value={health.lovable} />
            <HealthRow label="ElevenLabs TTS" value={health.elevenlabs} />
            <HealthRow label="ElevenLabs Voice ID" value={health.elevenlabs_voice_id} />
          </div>
        ) : (
          <p className="text-sm text-slate-500">Unable to load system health.</p>
        )}
      </section>
    </div>
  );
}
