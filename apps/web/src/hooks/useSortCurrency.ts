import { Currency } from '@balancednetwork/sdk-core';
import { SUPPORTED_XCALL_CHAINS } from 'app/pages/trade/bridge/_config/xChains';
import { useSignedInWallets } from 'app/pages/trade/bridge/_hooks/useWallets';
import { XChainId } from 'app/pages/trade/bridge/types';
import { isXToken, getXTokenAddress } from 'app/pages/trade/bridge/utils';
import BigNumber from 'bignumber.js';
import { useEffect, useState } from 'react';
import { useCrossChainWalletBalances } from 'store/wallet/hooks';
import { WalletState } from 'store/wallet/reducer';

type SortingType = {
  key: string;
  order?: 'ASC' | 'DESC';
};

const getXCurrencyBalance = (
  xBalances: WalletState,
  currency: Currency,
  selectedChainId: XChainId | undefined,
): BigNumber | undefined => {
  if (!xBalances) return;

  if (selectedChainId) {
    return new BigNumber(xBalances[selectedChainId]?.[currency.wrapped.address]?.toFixed() || 0);
  } else {
    if (isXToken(currency)) {
      return SUPPORTED_XCALL_CHAINS.reduce((sum, xChainId) => {
        if (xBalances[xChainId]) {
          const tokenAddress = getXTokenAddress(xChainId, currency.wrapped.symbol);
          const balance = new BigNumber(xBalances[xChainId]?.[tokenAddress ?? -1]?.toFixed() || 0);
          sum = sum.plus(balance);
        }
        return sum;
      }, new BigNumber(0));
    } else {
      return new BigNumber(xBalances['0x1.icon']?.[currency.wrapped.address]?.toFixed() || 0);
    }
  }
};

export default function useSortCurrency(initialState: SortingType, selectedChainId: XChainId | undefined) {
  const xBalances = useCrossChainWalletBalances();
  const signedInWallets = useSignedInWallets();

  const [sortBy, setSortBy] = useState<SortingType>(initialState);

  useEffect(() => {
    if (signedInWallets.length > 0) {
      setSortBy({ key: 'value', order: 'DESC' });
    } else {
      setSortBy({ key: 'symbol', order: 'ASC' });
    }
  }, [signedInWallets.length]);

  const handleSortSelect = (clickedSortBy: SortingType) => {
    if (clickedSortBy.key === sortBy.key) {
      sortBy.order === 'DESC' ? (clickedSortBy.order = 'ASC') : (clickedSortBy.order = 'DESC');
    } else {
      clickedSortBy.order = 'DESC';
    }
    setSortBy(clickedSortBy);
  };

  const sortData = (data: Currency[], rateFracs: {}) => {
    const dataToSort = [...data];
    const direction = sortBy.order === 'ASC' ? -1 : 1;

    if (sortBy.key === 'symbol') {
      dataToSort.sort((a, b) => {
        return a.symbol.toUpperCase() > b.symbol.toUpperCase() ? -1 * direction : 1 * direction;
      });
    }

    if (signedInWallets.length > 0 && sortBy.key === 'value') {
      dataToSort.sort((a, b) => {
        const aBalance = getXCurrencyBalance(xBalances, a, selectedChainId) || new BigNumber(0);
        const bBalance = getXCurrencyBalance(xBalances, b, selectedChainId) || new BigNumber(0);
        const aValue = aBalance.times(new BigNumber(rateFracs[a.symbol]?.toFixed(8) || '0'));
        const bValue = bBalance.times(new BigNumber(rateFracs[b.symbol]?.toFixed(8) || '0'));
        return aValue.isGreaterThan(bValue) ? -1 * direction : 1 * direction;
      });
    }

    if (signedInWallets.length === 0 && sortBy.key === 'price') {
      dataToSort.sort((a, b) => {
        if (!rateFracs[a.symbol] || !rateFracs[b.symbol]) return 0;
        return rateFracs[a.symbol].greaterThan(rateFracs[b.symbol]) ? -1 * direction : 1 * direction;
      });
    }

    return dataToSort;
  };

  return { sortBy, handleSortSelect, sortData };
}
