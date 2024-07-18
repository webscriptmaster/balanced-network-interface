import React, { useMemo } from 'react';

import { addresses, CallData } from '@balancednetwork/balanced-js';
import BigNumber from 'bignumber.js';
import { keepPreviousData, useQuery, UseQueryResult } from '@tanstack/react-query';
import { useDispatch, useSelector } from 'react-redux';

import bnJs from 'bnJs';
import { ICON_XCALL_NETWORK_ID, NETWORK_ID } from 'constants/config';
import { MINIMUM_ICX_FOR_ACTION } from 'constants/index';
import {
  HIGH_PRICE_ASSET_DP,
  NULL_CONTRACT_ADDRESS,
  SUPPORTED_TOKENS_LIST,
  SUPPORTED_TOKENS_MAP_BY_ADDRESS,
} from 'constants/tokens';
import { useBorrowedAmounts } from 'store/loan/hooks';
import { useOraclePrice, useOraclePrices } from 'store/oracle/hooks';
import { useRatio } from 'store/ratio/hooks';
import { useAllTransactions } from 'store/transactions/hooks';
import { useCrossChainWalletBalances, useICONWalletBalances } from 'store/wallet/hooks';
import { CurrencyKey, IcxDisplayType } from 'types';
import { formatUnits, toBigNumber } from 'utils';

import { AppState } from '../index';
import {
  adjust,
  cancel,
  changeDepositedAmount,
  changeCollateralType,
  changeCollateralXChain,
  changeIcxDisplayType,
  type,
  Field,
} from './reducer';
import { Position, XChainId, XCollaterals, XPositionsRecord, XToken } from 'app/pages/trade/bridge/types';
import { DEFAULT_TOKEN_CHAIN, xTokenMap } from 'app/pages/trade/bridge/_config/xTokens';
import { useAllDerivedWallets, useAvailableWallets } from 'app/pages/trade/bridge/_hooks/useWallets';
import { Currency, CurrencyAmount, Token } from '@balancednetwork/sdk-core';
import { SUPPORTED_XCALL_CHAINS, xChainMap } from 'app/pages/trade/bridge/_config/xChains';
import { setRecipientNetwork } from 'store/loan/reducer';
import { useDestinationEvents } from 'app/pages/trade/bridge/_zustand/useXCallEventStore';
import { forEach } from 'lodash-es';

export const DEFAULT_COLLATERAL_TOKEN = 'sICX';

export function useCollateralChangeDepositedAmount(): (
  depositedAmount: BigNumber,
  token?: string,
  xChain?: XChainId,
) => void {
  const dispatch = useDispatch();

  return React.useCallback(
    (depositedAmount: BigNumber, token: string = DEFAULT_COLLATERAL_TOKEN, xChain = '0x1.icon') => {
      dispatch(changeDepositedAmount({ depositedAmount, token, xChain }));
    },
    [dispatch],
  );
}

export function useCollateralChangeCollateralType(): (collateralType: CurrencyKey) => void {
  const dispatch = useDispatch();

  return React.useCallback(
    (collateralType: CurrencyKey) => {
      dispatch(changeCollateralType({ collateralType }));
      const defaultXChainId = DEFAULT_TOKEN_CHAIN[collateralType];
      if (defaultXChainId) {
        dispatch(changeCollateralXChain({ collateralXChain: defaultXChainId }));
        dispatch(setRecipientNetwork({ recipientNetwork: defaultXChainId }));
      } else {
        dispatch(changeCollateralXChain({ collateralXChain: NETWORK_ID === 1 ? '0x1.icon' : '0x2.icon' }));
        dispatch(setRecipientNetwork({ recipientNetwork: NETWORK_ID === 1 ? '0x1.icon' : '0x2.icon' }));
      }
    },
    [dispatch],
  );
}

export function useChangeCollateralXChain(): (collateralXChain: XChainId) => void {
  const dispatch = useDispatch();

  return React.useCallback(
    (collateralXChain: XChainId) => {
      dispatch(changeCollateralXChain({ collateralXChain }));
    },
    [dispatch],
  );
}

export function useCollateralChangeIcxDisplayType(): (icxDisplayType: IcxDisplayType) => void {
  const dispatch = useDispatch();

  return React.useCallback(
    (icxDisplayType: IcxDisplayType) => {
      dispatch(changeIcxDisplayType({ icxDisplayType }));
    },
    [dispatch],
  );
}
export function useAllDepositedAmounts() {
  return useSelector((state: AppState) => state.collateral.depositedAmounts);
}

export function useCollateralType() {
  return useSelector((state: AppState) => state.collateral.collateralType);
}

export function useCollateralXChain() {
  return useSelector((state: AppState) => state.collateral.collateralXChain);
}

export function useIcxDisplayType() {
  return useSelector((state: AppState) => state.collateral.icxDisplayType);
}

export function useCollateralAvailableAmount() {
  const icxAddress = bnJs.ICX.address;
  const balances = useICONWalletBalances();
  const ICXAmountCA = balances[icxAddress];
  const ICXAmount = toBigNumber(ICXAmountCA);

  return React.useMemo(() => {
    return BigNumber.max(ICXAmount.minus(MINIMUM_ICX_FOR_ACTION), new BigNumber(0));
  }, [ICXAmount]);
}

export function useCollateralAvailableAmountinSICX() {
  const sicxAddress = bnJs.sICX.address;
  const balances = useICONWalletBalances();
  const sICXAmountCA = balances[sicxAddress];
  const sICXAmount = toBigNumber(sICXAmountCA);

  return sICXAmount;
}

export function useCollateralAmounts(chainId?: XChainId): { [key in string]: BigNumber } {
  const collateralXChain = useCollateralXChain();
  return useSelector((state: AppState) => state.collateral.depositedAmounts[chainId || collateralXChain] || {});
}

export function useAllCollateralData(): UseQueryResult<XCollaterals[]> {
  const { data: totalCollateralData } = useTotalCollateralData();

  return useQuery({
    queryKey: ['getCollateralSelectorData', totalCollateralData],
    queryFn: () => {
      if (!totalCollateralData) return;
      return Object.keys(totalCollateralData).map(symbol => {
        const baseToken = SUPPORTED_TOKENS_LIST.find(token => token.symbol === symbol);
        const chains = SUPPORTED_XCALL_CHAINS.reduce(
          (acc, chainId) => {
            const xToken = xTokenMap[chainId].find(t => t.symbol === symbol);
            if (xToken || chainId === ICON_XCALL_NETWORK_ID) {
              acc[chainId] = {};
            }
            return acc;
          },
          {} as Partial<{ [key in XChainId]: {} }>,
        );
        return {
          baseToken,
          chains,
          isCollateralSingleChain: Object.keys(chains).length === 1,
          total: totalCollateralData[symbol],
        };
      });
    },
    enabled: !!totalCollateralData,
    placeholderData: keepPreviousData,
  });
}

export function useTotalCollateralData(): UseQueryResult<{ [key in string]: Position }> {
  const { data: supportedTokens } = useSupportedCollateralTokens();

  return useQuery({
    queryKey: ['totalCollateralData', supportedTokens],
    queryFn: async () => {
      if (!supportedTokens) return;
      try {
        const totalData = await Promise.all(
          Object.entries(supportedTokens).map(async ([symbol, address]) => {
            const baseToken = SUPPORTED_TOKENS_LIST.find(token => token.symbol === symbol);
            if (!baseToken) return;

            const cds: CallData[] = [
              {
                target: address,
                method: 'balanceOf',
                params: [addresses[NETWORK_ID].loans],
              },
              {
                target: addresses[NETWORK_ID].loans,
                method: 'getTotalCollateralDebt',
                params: [symbol, 'bnUSD'],
              },
            ];

            const data = await bnJs.Multicall.getAggregateData(cds);

            return {
              collateral: CurrencyAmount.fromRawAmount(baseToken, data[0]),
              loan: new BigNumber(data[1]).div(10 ** 18),
            } as Position;
          }),
        );
        return totalData
          .filter((item: any): item is Position => {
            return typeof item === 'object' && 'collateral' in item && 'loan' in item;
          })
          .reduce((acc, { collateral, loan }) => {
            if (!collateral || !loan) return acc;
            acc[collateral.currency.symbol] = { collateral, loan };
            return acc;
          }, {});
      } catch (e) {
        console.error(e);
        return;
      }
    },
    enabled: !!useSupportedCollateralTokens,
    placeholderData: keepPreviousData,
  });
}

export function useCollateralFetchInfo(account?: string | null) {
  const changeDepositedAmount = useCollateralChangeDepositedAmount();
  const transactions = useAllTransactions();
  const pendingXCalls = useDestinationEvents(ICON_XCALL_NETWORK_ID);
  const { data: supportedCollateralTokens } = useSupportedCollateralTokens();

  const allDerivedWallets = useAllDerivedWallets();

  function isSupported(symbol: string) {
    return (
      symbol === 'sICX' ||
      (supportedCollateralTokens &&
        Object.keys(supportedCollateralTokens).includes(symbol) &&
        supportedCollateralTokens[symbol])
    );
  }

  const fetchCollateralInfo = React.useCallback(
    async (wallet: {
      address: string;
      xChainId: XChainId | undefined;
    }) => {
      const address =
        wallet.xChainId === '0x1.icon' || wallet.xChainId === '0x2.icon'
          ? wallet.address
          : `${wallet.xChainId}/${wallet.address}`;
      bnJs.Loans.getAccountPositions(address)
        .then(res => {
          supportedCollateralTokens &&
            res.holdings &&
            Object.keys(res.holdings).forEach(async symbol => {
              if (isSupported(symbol)) {
                const decimals: string = await bnJs.getContract(supportedCollateralTokens[symbol]).decimals();
                const depositedAmount = new BigNumber(
                  formatUnits(res.holdings[symbol][symbol] || 0, Number(decimals), 18),
                );
                changeDepositedAmount(depositedAmount, symbol, wallet.xChainId);
              }
            });
        })
        .catch(e => {
          if (e.toString().indexOf('does not have a position')) {
            supportedCollateralTokens &&
              Object.keys(supportedCollateralTokens).forEach(symbol => {
                if (isSupported(symbol)) {
                  changeDepositedAmount(new BigNumber(0), symbol, wallet.xChainId);
                }
              });
          }
        });
    },
    [changeDepositedAmount, supportedCollateralTokens],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  React.useEffect(() => {
    const fetchData = async () => {
      try {
        await Promise.all(allDerivedWallets.map(fetchCollateralInfo));
      } catch (e) {
        console.error(e);
      }
    };
    fetchData();
  }, [fetchCollateralInfo, transactions, allDerivedWallets, pendingXCalls.length]);
}

export function useCollateralState() {
  return useSelector((state: AppState) => state.collateral.state);
}

export function useCollateralActionHandlers() {
  const dispatch = useDispatch();

  const onFieldAInput = React.useCallback(
    (value: string) => {
      dispatch(type({ independentField: Field.LEFT, typedValue: value, inputType: 'text' }));
    },
    [dispatch],
  );

  const onFieldBInput = React.useCallback(
    (value: string) => {
      dispatch(type({ independentField: Field.RIGHT, typedValue: value, inputType: 'text' }));
    },
    [dispatch],
  );

  const onSlide = React.useCallback(
    (values: string[], handle: number) => {
      const value = values[handle];
      dispatch(type({ independentField: Field.LEFT, typedValue: value, inputType: 'slider' }));
    },
    [dispatch],
  );

  const onAdjust = React.useCallback(
    isAdjust => {
      if (isAdjust) {
        dispatch(adjust());
      } else {
        dispatch(cancel());
      }
    },
    [dispatch],
  );

  return {
    onFieldAInput,
    onFieldBInput,
    onSlide,
    onAdjust,
  };
}

export function useCollateralDepositedAmount() {
  const depositedAmounts = useCollateralAmounts();
  const collateralType = useCollateralType();
  return depositedAmounts[collateralType] || new BigNumber(0);
}

export function useCollateralDepositedAmountInICX() {
  const sICXAmount = useCollateralDepositedAmount();

  const ratio = useRatio();

  return React.useMemo(() => {
    return sICXAmount.multipliedBy(ratio.sICXICXratio);
  }, [sICXAmount, ratio.sICXICXratio]);
}

export function useCollateralTotalICXAmount() {
  const ICXAmount = useCollateralAvailableAmount();

  const stakedICXAmount = useCollateralDepositedAmountInICX();

  return React.useMemo(() => {
    const totalICXAmount = stakedICXAmount.plus(ICXAmount);
    return totalICXAmount;
  }, [stakedICXAmount, ICXAmount]);
}

export function useCollateralTotalAmount() {
  const sICXAmount = useCollateralAvailableAmountinSICX();

  const collateralSICXAmount = useCollateralDepositedAmount();

  return React.useMemo(() => {
    const totalSICXAmount = sICXAmount.plus(collateralSICXAmount);
    return totalSICXAmount;
  }, [sICXAmount, collateralSICXAmount]);
}

export function useCollateralInputAmount() {
  const { independentField, typedValue } = useCollateralState();
  const { collateralTotal } = useDerivedCollateralInfo();
  const dependentField: Field = independentField === Field.LEFT ? Field.RIGHT : Field.LEFT;
  const collateralDecimalPlaces = useCollateralDecimalPlaces();

  const roundedTypedValue =
    Math.round(new BigNumber(typedValue || '0').times(10 ** collateralDecimalPlaces).toNumber()) /
    10 ** collateralDecimalPlaces;

  const currentAmount = collateralTotal.minus(new BigNumber(roundedTypedValue));

  //  calculate dependentField value
  const parsedAmount = {
    [independentField]: new BigNumber(roundedTypedValue),
    [dependentField]: currentAmount,
  };

  return parsedAmount[Field.LEFT];
}

export function useCollateralInputAmountAbsolute() {
  const collateralInputAmount = useCollateralInputAmount();
  const isHandlingICX = useIsHandlingICX();
  const ratio = useRatio();

  return useMemo(() => {
    if (ratio) {
      return isHandlingICX ? collateralInputAmount.div(ratio.sICXICXratio) : collateralInputAmount;
    }
  }, [ratio, isHandlingICX, collateralInputAmount]);
}

export function useCollateralInputAmountInSICX() {
  const { independentField, typedValue } = useCollateralState();
  const dependentField: Field = independentField === Field.LEFT ? Field.RIGHT : Field.LEFT;

  const totalSICXAmount = useCollateralTotalAmount();

  //  calculate dependentField value
  const parsedAmount = {
    [independentField]: new BigNumber(typedValue || '0'),
    [dependentField]: totalSICXAmount.minus(new BigNumber(typedValue || '0')),
  };

  return parsedAmount[Field.LEFT];
}

export function useCollateralInputAmountInUSD() {
  const collateralInputAmount = useCollateralInputAmountAbsolute();
  const oraclePrice = useOraclePrice();

  return React.useMemo(() => {
    if (oraclePrice && collateralInputAmount) return collateralInputAmount.multipliedBy(oraclePrice);
  }, [collateralInputAmount, oraclePrice]);
}

type CollateralInfo = {
  symbol: string;
  name: string;
  displayName?: string;
  collateralDeposit: BigNumber;
  collateralAvailable: BigNumber;
};

export function useSupportedCollateralTokens(): UseQueryResult<{ [key in string]: string }> {
  return useQuery({
    queryKey: ['getCollateralTokens'],
    queryFn: async () => {
      const data = await bnJs.Loans.getCollateralTokens();

      const cds: CallData[] = Object.keys(data).map(symbol => ({
        target: addresses[NETWORK_ID].loans,
        method: 'getDebtCeiling',
        params: [symbol],
      }));

      const debtCeilingsData = await bnJs.Multicall.getAggregateData(cds);

      const debtCeilings = debtCeilingsData.map(ceiling => (ceiling === null ? 1 : parseInt(formatUnits(ceiling))));

      const supportedTokens = {};
      Object.keys(data).forEach((symbol, index) => {
        //temporarily allow BTCB with 0 debt ceiling
        if (debtCeilings[index] > 0 || symbol === 'BTCB') {
          supportedTokens[symbol] = data[symbol];
        }
      });

      return supportedTokens;
    },
  });
}

export function useDepositedCollateral() {
  const collateralType = useCollateralType();
  const icxDisplayType = useIcxDisplayType();
  const collateralAmounts = useCollateralAmounts();
  const ratio = useRatio();

  return useMemo(() => {
    if (collateralAmounts[collateralType]) {
      if (collateralType !== 'sICX') {
        return collateralAmounts[collateralType];
      } else {
        return icxDisplayType === 'sICX'
          ? collateralAmounts[collateralType]
          : collateralAmounts[collateralType] && ratio && collateralAmounts[collateralType].times(ratio.sICXICXratio);
      }
    } else {
      return new BigNumber(0);
    }
  }, [collateralType, collateralAmounts, ratio, icxDisplayType]);
}

export function useAvailableCollateral() {
  const sourceChain = useCollateralXChain();
  const signedInWallets = useAvailableWallets();
  const crossChainWallet = useCrossChainWalletBalances();
  const account = signedInWallets.find(
    w => xChainMap[w.xChainId].xWalletType === xChainMap[sourceChain].xWalletType,
  )?.address;
  const collateralType = useCollateralType();

  const collateralCurrency = React.useMemo(() => {
    const xToken = xTokenMap[sourceChain].find(t => t.symbol === collateralType);
    return xToken || SUPPORTED_TOKENS_LIST.find(t => t.symbol === collateralType);
  }, [collateralType, sourceChain]);

  const icxDisplayType = useIcxDisplayType();
  const shouldGetIcx =
    collateralType === 'sICX' && icxDisplayType === 'ICX' && (sourceChain === '0x1.icon' || sourceChain === '0x2.icon');
  const icxAddress = bnJs.ICX.address;

  const amount: BigNumber = React.useMemo(() => {
    return toBigNumber(
      shouldGetIcx
        ? crossChainWallet[sourceChain]?.[icxAddress]
        : collateralCurrency && crossChainWallet[sourceChain]?.[collateralCurrency?.wrapped.address],
    );
  }, [collateralCurrency, crossChainWallet, sourceChain, icxAddress, shouldGetIcx]);

  return useMemo(() => {
    return shouldGetIcx ? BigNumber.max(amount.minus(MINIMUM_ICX_FOR_ACTION), new BigNumber(0)) : amount;
  }, [shouldGetIcx, amount]);
}

export function useIsHandlingICX() {
  const collateralType = useCollateralType();
  const icxDisplayType = useIcxDisplayType();

  return collateralType === 'sICX' && icxDisplayType === 'ICX';
}

export function useCollateralDecimalPlaces() {
  const { data: supportedCollateralTokens } = useSupportedCollateralTokens();
  const collateralType = useCollateralType();

  return supportedCollateralTokens && HIGH_PRICE_ASSET_DP[supportedCollateralTokens[collateralType]]
    ? HIGH_PRICE_ASSET_DP[supportedCollateralTokens[collateralType]]
    : 2;
}

export function useDerivedCollateralInfo(): {
  account: string | undefined;
  availableCollateralAmount: CurrencyAmount<XToken | Currency> | undefined;
  sourceChain: XChainId;
  collateralType: string;
  collateralDeposit: BigNumber;
  collateralTotal: BigNumber;
  collateralDecimalPlaces: number;
  differenceAmount: BigNumber;
  xTokenAmount: CurrencyAmount<XToken> | undefined;
  formattedAmounts: {
    [x: string]: string;
  };
  parsedAmount: {
    [x: string]: BigNumber;
    [x: number]: BigNumber;
  };
} {
  const sourceChain = useCollateralXChain();
  const signedInWallets = useAvailableWallets();
  const crossChainWallet = useCrossChainWalletBalances();
  const account = signedInWallets.find(
    w => xChainMap[w.xChainId].xWalletType === xChainMap[sourceChain].xWalletType,
  )?.address;
  const collateralType = useCollateralType();

  const collateralCurrency = React.useMemo(() => {
    const xToken = xTokenMap[sourceChain].find(t => t.symbol === collateralType);
    return xToken || SUPPORTED_TOKENS_LIST.find(t => t.symbol === collateralType);
  }, [collateralType, sourceChain]);

  const availableCollateralAmount: CurrencyAmount<XToken | Currency> | undefined = React.useMemo(() => {
    return collateralCurrency ? crossChainWallet[sourceChain]?.[collateralCurrency?.wrapped.address] : undefined;
  }, [collateralCurrency, crossChainWallet, sourceChain]);

  const collateralDecimalPlaces = useCollateralDecimalPlaces();
  const availableCollateral = useAvailableCollateral();
  const collateralDeposit = useDepositedCollateral();

  const collateralTotal = useMemo(() => {
    return availableCollateral.plus(collateralDeposit);
  }, [availableCollateral, collateralDeposit]);

  const { independentField, typedValue } = useCollateralState();
  const dependentField: Field = independentField === Field.LEFT ? Field.RIGHT : Field.LEFT;

  //  calculate dependentField value
  const parsedAmount = React.useMemo(() => {
    return {
      [independentField]: new BigNumber(typedValue || '0'),
      [dependentField]: collateralTotal.minus(new BigNumber(typedValue || '0')),
    };
  }, [independentField, dependentField, typedValue, collateralTotal]);

  const formattedAmounts = React.useMemo(() => {
    return {
      [independentField]: typedValue,
      [dependentField]: parsedAmount[dependentField].isZero()
        ? '0'
        : parsedAmount[dependentField].toFixed(collateralDecimalPlaces),
    };
  }, [independentField, dependentField, typedValue, parsedAmount, collateralDecimalPlaces]);

  const differenceAmount = parsedAmount[Field.LEFT].minus(collateralDeposit);

  const xToken = xTokenMap[sourceChain].find(t => t.symbol === collateralType);
  const xTokenAmount =
    xToken && differenceAmount
      ? CurrencyAmount.fromRawAmount(xToken, differenceAmount.times(10 ** xToken.decimals).toFixed(0))
      : undefined;

  return {
    account,
    sourceChain,
    collateralType,
    availableCollateralAmount,
    collateralDeposit,
    collateralTotal,
    formattedAmounts,
    parsedAmount,
    collateralDecimalPlaces,
    differenceAmount,
    xTokenAmount,
  };
}

export function useXCollateralDataByToken(): UseQueryResult<XPositionsRecord[]> {
  const depositedAmounts = useAllDepositedAmounts();
  const borrowedAmounts = useBorrowedAmounts();
  const allWallets = useAllDerivedWallets();
  const xWallet = useCrossChainWalletBalances();

  return useQuery({
    queryKey: ['xPositionsData', allWallets],
    queryFn: async () => {
      return Object.entries(
        Object.entries(depositedAmounts).reduce(
          (acc, [chainId, chainDeposits]) => {
            if (chainDeposits) {
              forEach(chainDeposits, (deposit, symbol) => {
                const xToken = xTokenMap[chainId].find(token => token.symbol === symbol);
                const account = allWallets.find(wallet => wallet.xChainId === chainId)?.address;
                if (!account) return;

                //cross-chain compatible positions
                if (xToken) {
                  const depositAmount = CurrencyAmount.fromRawAmount(
                    xToken,
                    deposit.times(10 ** xToken.decimals).toFixed(0),
                  );
                  const loanAmount =
                    account &&
                    borrowedAmounts[symbol]?.[chainId === ICON_XCALL_NETWORK_ID ? account : `${chainId}/${account}`];

                  if (depositAmount && depositAmount.greaterThan(0)) {
                    acc[symbol] = {
                      ...acc[symbol],
                      [chainId]: { collateral: depositAmount, loan: loanAmount },
                    };
                  } else {
                    //show available collateral balance
                    const availableAmount = xWallet[chainId]?.[xToken.address];
                    if (availableAmount?.greaterThan(0)) {
                      acc[symbol] = {
                        ...acc[symbol],
                        [chainId]: { collateral: availableAmount, loan: new BigNumber(0), isPotential: true },
                      };
                    }
                  }
                } else {
                  //icon only positions
                  const token = SUPPORTED_TOKENS_LIST.find(token => token.symbol === symbol);
                  if (chainId === ICON_XCALL_NETWORK_ID && token) {
                    const depositAmount = CurrencyAmount.fromRawAmount(
                      token,
                      deposit.times(10 ** token.decimals).toFixed(0),
                    );
                    const loanAmount = account && borrowedAmounts[symbol]?.[account];

                    if (depositAmount && depositAmount.greaterThan(0)) {
                      acc[symbol] = {
                        ...acc[symbol],
                        [chainId]: { collateral: depositAmount, loan: loanAmount },
                      };
                    } else {
                      //show available collateral balance
                      const availableAmount = xWallet[chainId]?.[token.address];
                      if (availableAmount?.greaterThan(0)) {
                        acc[symbol] = {
                          ...acc[symbol],
                          [chainId]: { collateral: availableAmount, loan: new BigNumber(0), isPotential: true },
                        };
                      }
                    }
                  }
                }
              });
            }
            return acc;
          },
          {} as { [AssetSymbol in string]: Partial<{ [key in XChainId]: Position }> },
        ),
      )
        .map(([symbol, positions]) => {
          const baseToken = SUPPORTED_TOKENS_LIST.find(token => token.symbol === symbol);

          if (baseToken === undefined) return;

          return {
            baseToken,
            positions,
            isPositionSingleChain: Object.keys(positions).length === 1,
          };
        })
        .filter((item): item is XPositionsRecord => Boolean(item));
    },
    enabled: allWallets?.length > 0,
    placeholderData: keepPreviousData,
    refetchInterval: 4000,
  });
}
