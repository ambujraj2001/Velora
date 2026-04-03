import { Check, Circle, Loader2, XCircle } from 'lucide-react';
import type { ChatJobPublic, ChatJobStep } from '../lib/chatJob';

type Props = {
  job: ChatJobPublic | null;
};

function StepIcon({ status }: { status: ChatJobStep['status'] }) {
  if (status === 'done') {
    return <Check className="h-3.5 w-3.5 text-emerald-500" strokeWidth={2.5} />;
  }
  if (status === 'error') {
    return <XCircle className="h-3.5 w-3.5 text-red-500" strokeWidth={2.5} />;
  }
  if (status === 'running') {
    return <Loader2 className="h-3.5 w-3.5 animate-spin text-[#F06543]" strokeWidth={2.5} />;
  }
  return <Circle className="h-3 w-3 text-[#444]" strokeWidth={2} />;
}

export default function ChatJobProgress({ job }: Props) {
  if (!job) return null;

  return (
    <div className="mt-4 w-full max-w-xl rounded-2xl border border-white/10 bg-[#0A0A0A]/90 px-4 py-3 text-left shadow-xl backdrop-blur-sm">
      <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#666]">Progress</p>
      <p className="mt-1 text-sm text-[#ccc]">{job.currentLabel}</p>
      {job.steps.length > 0 && (
        <ul className="mt-3 max-h-40 space-y-2 overflow-y-auto text-xs text-[#888]">
          {job.steps.map((s) => (
            <li key={s.id} className="flex items-start gap-2">
              <span className="mt-0.5 shrink-0">
                <StepIcon status={s.status} />
              </span>
              <span className={s.status === 'running' ? 'text-[#F06543]' : ''}>
                {s.label}
                {s.errorMessage ? (
                  <span className="mt-0.5 block text-[10px] text-red-400/90">{s.errorMessage}</span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
