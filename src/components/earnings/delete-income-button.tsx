'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { deleteIncomeAction } from '@/app/actions/earnings';

interface DeleteIncomeButtonProps {
  incomeId: string;
}

export function DeleteIncomeButton({ incomeId }: DeleteIncomeButtonProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    if (!confirm('Are you sure you want to delete this income entry?')) {
      return;
    }

    startTransition(async () => {
      const result = await deleteIncomeAction(incomeId);

      if (result.success) {
        toast({
          title: 'Success',
          description: 'Income entry deleted',
        });
        router.refresh();
      } else {
        toast({
          title: 'Error',
          description: result.error,
          variant: 'destructive',
        });
      }
    });
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleDelete}
      disabled={isPending}
      title="Delete income entry"
    >
      {isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Trash2 className="h-4 w-4" />
      )}
    </Button>
  );
}
