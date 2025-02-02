import { BalancedJs } from '@balancednetwork/balanced-js';
import BigNumber from 'bignumber.js';
import bnJs from 'bnJs';
import { useIconReact } from 'packages/icon-react';
import { useEffect, useState } from 'react';
import { useAllTransactions } from 'store/transactions/hooks';

function useClaimableICX() {
  const [claimableICX, setClaimableICX] = useState(new BigNumber(0));
  const { account } = useIconReact();
  const transactions = useAllTransactions();

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    (async () => {
      if (account) {
        const result = await bnJs.Staking.getClaimableICX(account);
        setClaimableICX(BalancedJs.utils.toIcx(result));
      }
    })();
  }, [account, transactions]);

  return claimableICX;
}

export default useClaimableICX;
