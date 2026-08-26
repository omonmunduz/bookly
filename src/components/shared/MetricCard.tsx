import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface MetricCardProps {
  label: string;
  value: string;
  detail?: string;
  icon: LucideIcon;
  tone?: 'default' | 'positive' | 'warning' | 'destructive';
  href?: string;
}

const toneClasses = {
  default: 'text-foreground',
  positive: 'text-green-600',
  warning: 'text-amber-600',
  destructive: 'text-red-600',
};

export function MetricCard({ label, value, detail, icon: Icon, tone = 'default', href }: MetricCardProps) {
  const content = (
    <Card className={href ? 'transition-colors hover:bg-accent/50 cursor-pointer' : ''}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between space-y-0 pb-2">
          <h3 className="text-sm font-medium text-muted-foreground">{label}</h3>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <p className={`text-2xl font-bold ${toneClasses[tone]}`}>{value}</p>
          {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
        </div>
      </CardContent>
    </Card>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}
