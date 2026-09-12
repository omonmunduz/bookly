'use client';

import { useRouter } from 'next/navigation';
import { TransactionList } from './transaction-list';
import { toggleTransactionPaidStatusAction } from '@/app/actions/courier-transactions';
import type { TransactionWithCourier, PaidStatus } from '@/lib/types/ebike';

interface TransactionListWithActionsProps {
  transactions: TransactionWithCourier[];
  showCourier?: boolean;
}

export function TransactionListWithActions({
  transactions,
  showCourier = true
}: TransactionListWithActionsProps) {
  const router = useRouter();

  const handleTogglePaid = async (transactionId: string, currentStatus: PaidStatus) => {
    const result = await toggleTransactionPaidStatusAction(transactionId, currentStatus);

    if (result.success) {
      router.refresh();
    }
  };

  return (
    <TransactionList
      transactions={transactions}
      showCourier={showCourier}
      onTogglePaid={handleTogglePaid}
    />
  );
}
