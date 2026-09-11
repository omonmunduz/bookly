'use client';

import { formatCurrency, formatDate } from '@/lib/utils/format';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  getTransactionTypeLabel,
  getDirectionColor,
} from '@/features/courier-transactions/labels';
import type { TransactionWithCourier } from '@/lib/types/ebike';

interface TransactionListProps {
  transactions: TransactionWithCourier[];
  showCourier?: boolean;
}

export function TransactionList({ transactions, showCourier = true }: TransactionListProps) {
  if (transactions.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        Нет транзакций
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Дата</TableHead>
            {showCourier && <TableHead>Курьер</TableHead>}
            <TableHead>Тип</TableHead>
            <TableHead>Примечание</TableHead>
            <TableHead>Автор</TableHead>
            <TableHead className="text-right">Сумма</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map((transaction) => {
            const isSystemGenerated = transaction.type === 'rent_auto' || !transaction.created_by;
            const creatorDisplay = isSystemGenerated
              ? 'Система'
              : transaction.creator?.full_name || 'Неизвестно';

            return (
              <TableRow key={transaction.id}>
                <TableCell className="whitespace-nowrap">
                  {formatDate(transaction.created_at)}
                </TableCell>
                {showCourier && (
                  <TableCell>
                    <div>
                      <p className="font-medium">{transaction.courier.full_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {transaction.courier.courier_code}
                      </p>
                    </div>
                  </TableCell>
                )}
                <TableCell>
                  <Badge
                    variant={
                      transaction.direction === 'debit' ? 'destructive' : 'default'
                    }
                    className="whitespace-nowrap"
                  >
                    {getTransactionTypeLabel(transaction.type)}
                  </Badge>
                </TableCell>
                <TableCell className="max-w-md">
                  <p className="truncate text-sm">
                    {transaction.note || '—'}
                  </p>
                  {transaction.metadata?.bike_number && (
                    <p className="text-xs text-muted-foreground">
                      Велосипед: {transaction.metadata.bike_number}
                    </p>
                  )}
                </TableCell>
                <TableCell>
                  <div className="text-sm">
                    <p className={isSystemGenerated ? 'text-muted-foreground italic' : 'font-medium'}>
                      {creatorDisplay}
                    </p>
                    {!isSystemGenerated && transaction.creator?.role && (
                      <p className="text-xs text-muted-foreground">
                        {transaction.creator.role}
                      </p>
                    )}
                  </div>
                </TableCell>
                <TableCell
                  className={`text-right font-semibold ${getDirectionColor(transaction.direction)}`}
                >
                  {transaction.direction === 'debit' ? '-' : '+'}
                  {formatCurrency(transaction.amount)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
