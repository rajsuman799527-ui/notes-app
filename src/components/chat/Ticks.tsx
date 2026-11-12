import { Check, CheckCheck, Clock } from 'lucide-react';

export default function Ticks({ status, className = '' }: { status: string; className?: string }) {
  if (status === 'sending') return <Clock className={`h-3 w-3 ${className}`} strokeWidth={2} />;
  if (status === 'sent') return <Check className={`h-3.5 w-3.5 text-[#8A9AB5] ${className}`} strokeWidth={2.25} />;
  if (status === 'delivered') return <CheckCheck className={`h-3.5 w-3.5 text-[#8A9AB5] ${className}`} strokeWidth={2.25} />;
  if (status === 'seen') return <CheckCheck className={`h-3.5 w-3.5 text-[#1E6BFF] ${className}`} strokeWidth={2.25} />;
  return null;
}
