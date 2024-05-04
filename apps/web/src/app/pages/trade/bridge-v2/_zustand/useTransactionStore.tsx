import React, { useEffect } from 'react';
import { create } from 'zustand';
import { t } from '@lingui/macro';
import { toast } from 'react-toastify';
import { useQuery, useQueries } from '@tanstack/react-query';
import { useIconReact } from 'packages/icon-react';
import { Converter } from 'icon-sdk-js';
import { v4 as uuidv4 } from 'uuid';

import {
  NotificationPending,
  NotificationSuccess,
  NotificationError,
} from 'app/components/Notification/TransactionNotification';
import { Transaction, TransactionStatus } from './types';
import { xCallServiceActions } from './useXCallServiceStore';

//TODO: this is mock function, need to be replaced with real function
const getChainType = xChainId => {
  switch (xChainId) {
    case '0x1.icon':
      return 'icon';
    case '0x2.icon':
      return 'icon';
    default:
      return 'unknown';
  }
};

type TransactionStore = {
  transactions: Transaction[];
};

export const useTransactionStore = create<TransactionStore>()(set => ({
  transactions: [],
}));

const getTrackerLink = (xChainId, hash, type) => {
  // TODO: handle different chain types
  return `https://tracker.icon.foundation/transaction/${hash}?network=${xChainId}`;

  // archway
  // window.open(`${archway.tracker}/${tx.transactionHash}`, '_blank');
};

export const transactionActions = {
  getTransaction: (xChainId, id) => {
    return useTransactionStore.getState().transactions.find(item => item.id === id && item.xChainId === xChainId);
  },

  add: (xChainId, transaction): Transaction => {
    const id = uuidv4().toString();
    const newItem = { ...transaction, status: TransactionStatus.pending, xChainId, id };
    useTransactionStore.setState(state => {
      return { transactions: [...state.transactions, newItem] };
    });

    const { hash } = transaction;
    if (hash) {
      const link = getTrackerLink(xChainId, hash, 'transaction');
      const toastProps = {
        onClick: () => window.open(link, '_blank'),
      };

      toast(<NotificationPending summary={transaction.pendingMessage || t`Processing transaction...`} />, {
        ...toastProps,
        toastId: id,
      });
    } else {
      toast(<NotificationPending summary={transaction.pendingMessage || t`Processing transaction...`} />, {
        toastId: id,
      });
    }

    return newItem;
  },

  updateTx: (xChainId, id, transaction) => {
    const { hash, rawTx } = transaction;
    const status = xCallServiceActions.getXCallService(xChainId).deriveTxStatus(rawTx);

    useTransactionStore.setState(state => {
      return {
        transactions: state.transactions.map(item => {
          if (item.id === id && item.xChainId === xChainId) {
            if (hash) {
              return { ...item, rawTx, status, hash };
            } else {
              return { ...item, rawTx, status };
            }
          }
          return item;
        }),
      };
    });

    const transactions = useTransactionStore.getState().transactions;
    const _transaction = transactions.find(item => item.id === id && item.xChainId === xChainId);
    if (_transaction) {
      if (status === TransactionStatus.success) {
        const toastProps = {
          onClick: () => window.open(getTrackerLink(xChainId, _transaction.hash, 'transaction'), '_blank'),
        };
        toast.update(_transaction.id, {
          ...toastProps,
          render: (
            <NotificationSuccess
              summary={_transaction?.successMessage}
              redirectOnSuccess={_transaction?.redirectOnSuccess}
            />
          ),
          autoClose: 5000,
        });
      }
      if (status === TransactionStatus.failure) {
        const toastProps = {
          onClick: () => window.open(getTrackerLink(xChainId, _transaction.hash, 'transaction'), '_blank'),
        };
        toast.update(_transaction.id, {
          ...toastProps,
          render: <NotificationError failureReason={_transaction.errorMessage} />, // TODO: handle error message
          autoClose: 5000,
        });
      }
    }
  },

  // remove: (xChainId, id) => {
  //   useTransactionStore.setState(state => {
  //     return {
  //       transactions: state.transactions.filter(item => !(item.id === id && item.xChainId === xChainId)),
  //     };
  //   });
  // },
  // removeAll: xChainId => {
  //   useTransactionStore.setState(state => {
  //     return {
  //       transactions: state.transactions.filter(item => item.xChainId !== xChainId),
  //     };
  //   });
  // },

  // getTransactionsByChainType: chainType => {
  //   return useTransactionStore.getState().transactions.filter(item => getChainType(item.xChainId) === chainType);
  // },
};

export const useFetchTransaction = transaction => {
  const { xChainId, hash, status } = transaction || {};
  const { data: rawTx, isLoading } = useQuery({
    queryKey: ['transaction', xChainId, hash],
    queryFn: async () => {
      const xCallService = xCallServiceActions.getXCallService(xChainId);
      try {
        const rawTx = await xCallService.getTx(hash);
        return rawTx;
      } catch (err: any) {
        console.error(`failed to check transaction hash: ${hash}`, err);
        throw new Error(err?.message);
      }
    },
    refetchInterval: 2000,
    enabled: status === TransactionStatus.pending && !!hash,
  });

  return { rawTx, isLoading };
};

export const TransactionUpdater = ({ transaction }) => {
  const { rawTx } = useFetchTransaction(transaction);
  const { xChainId, id } = transaction;

  useEffect(() => {
    if (rawTx) {
      transactionActions.updateTx(xChainId, id, { rawTx });
    }
  }, [xChainId, id, rawTx]);

  return null;
};

export const AllTransactionsUpdater = () => {
  const { transactions } = useTransactionStore();

  return transactions
    .filter(({ status, hash }) => status === TransactionStatus.pending && !!hash)
    .map(transaction => <TransactionUpdater key={transaction.id} transaction={transaction} />);
};
