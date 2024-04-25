import React from 'react';

import { Fraction } from '@balancednetwork/sdk-core';
import { t } from '@lingui/macro';
import BigNumber from 'bignumber.js';

import {
  useAddTransactionResult,
  useArchwayTransactionsState,
  useInitTransaction,
} from 'store/transactionsCrosschain/hooks';

import { useArchwayContext } from '../ArchwayProvider';
import { archway } from '../config1';
import { ARCHWAY_SUPPORTED_TOKENS_MAP_BY_ADDRESS } from '../tokens';
import { getFeeParam } from '../utils';

const useAllowanceHandler = (
  tokenAddress: string,
  amountNeeded: string,
  spenderAddress: string = archway.contracts.assetManager,
  callback?: (success: boolean) => void,
) => {
  const { address, signingClient } = useArchwayContext();
  const addTransactionResult = useAddTransactionResult();
  const initTransaction = useInitTransaction();
  const { transactions } = useArchwayTransactionsState();
  const [allowance, setAllowance] = React.useState<string>('0');
  const [allowanceIncreased, setAllowanceIncreased] = React.useState<boolean>(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  React.useEffect(() => {
    if (address && tokenAddress && tokenAddress.includes('archway-1') && signingClient) {
      signingClient
        .queryContractSmart(tokenAddress, {
          allowance: { owner: address, spender: spenderAddress },
        })
        .then(res => {
          setAllowance(res.allowance);
        });
    }
  }, [address, signingClient, spenderAddress, tokenAddress, transactions.length]);

  React.useEffect(() => {
    if (Number(allowance) < Number(amountNeeded)) {
      setAllowanceIncreased(false);
    }
  }, [allowance, amountNeeded]);

  const actualIncreaseNeeded = React.useMemo(() => {
    return `${new Fraction(amountNeeded).subtract(new Fraction(allowance)).quotient}`;
  }, [allowance, amountNeeded]);

  const isIncreaseNeeded = React.useMemo(() => {
    return tokenAddress !== archway.contracts.bnUSD && new BigNumber(actualIncreaseNeeded).gt(0);
  }, [tokenAddress, actualIncreaseNeeded]);

  const increaseAllowance = async () => {
    if (signingClient && address && tokenAddress) {
      const msg = {
        increase_allowance: {
          spender: spenderAddress,
          amount: actualIncreaseNeeded,
        },
      };
      try {
        initTransaction(
          'archway-1',
          t`Approving ${ARCHWAY_SUPPORTED_TOKENS_MAP_BY_ADDRESS[tokenAddress].symbol} for cross-chain transfer...`,
        );

        const res = await signingClient.execute(address, tokenAddress, msg, getFeeParam(400000));
        setAllowanceIncreased(true);
        addTransactionResult(
          'archway-1',
          res,
          t`${ARCHWAY_SUPPORTED_TOKENS_MAP_BY_ADDRESS[tokenAddress].symbol} approved for cross-chain transfer.`,
        );

        callback && callback(true);
      } catch (e) {
        console.error(e);
        addTransactionResult(
          'archway-1',
          null,
          t`${ARCHWAY_SUPPORTED_TOKENS_MAP_BY_ADDRESS[tokenAddress].symbol} transfer approval failed.`,
        );
      }
    }
  };

  if (!tokenAddress || amountNeeded === '0') {
    return {
      allowance: '0',
      isIncreaseNeeded: false,
      increaseAllowance: () => {},
    };
  }

  return {
    allowance,
    allowanceIncreased,
    isIncreaseNeeded,
    increaseAllowance,
  };
};

export default useAllowanceHandler;
