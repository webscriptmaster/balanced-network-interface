import React, { useEffect, useState } from 'react';

import { Accordion, AccordionItem, AccordionButton, AccordionPanel } from '@reach/accordion';
import BigNumber from 'bignumber.js';
import { BalancedJs } from 'packages/BalancedJs';
import { useIconReact } from 'packages/icon-react';
import { Box } from 'rebass/styled-components';
import styled, { css } from 'styled-components';

import CurrencyLogo from 'app/components/CurrencyLogo';
import { BoxPanel } from 'app/components/Panel';
import { Typography } from 'app/theme';
import bnJs from 'bnJs';
import { CURRENCY } from 'constants/currency';
import '@reach/tabs/styles.css';
import { useRatio } from 'store/ratio/hooks';
import { useAllTransactions } from 'store/transactions/hooks';
import { useWalletBalances } from 'store/wallet/hooks';

import BALNWallet from './wallets/BALNWallet';
import ICXWallet from './wallets/ICXWallet';
import SendPanel from './wallets/SendPanel';
import SICXWallet from './wallets/SICXWallet';

const WalletUIs = {
  ICX: ICXWallet,
  sICX: SICXWallet,
  BALN: BALNWallet,
};

const WalletPanel = () => {
  const balances = useWalletBalances();
  const { account } = useIconReact();
  const ratio = useRatio();
  const transactions = useAllTransactions();
  const [claimableICX, setClaimableICX] = useState(new BigNumber(0));

  const rates = React.useMemo(
    () => ({
      ICX: ratio.ICXUSDratio,
      sICX: ratio.sICXICXratio.times(ratio.ICXUSDratio),
      bnUSD: new BigNumber(1),
      BALN: ratio.BALNbnUSDratio,
    }),
    [ratio],
  );

  useEffect(() => {
    (async () => {
      if (account) {
        const result = await bnJs.Staking.getClaimableICX(account);
        setClaimableICX(BalancedJs.utils.toIcx(result));
      }
    })();
  }, [account, transactions]);

  return (
    <BoxPanel bg="bg2">
      <Typography variant="h2" mb={5}>
        Wallet
      </Typography>

      <Wrapper>
        <DashGrid>
          <HeaderText>Asset</HeaderText>
          <HeaderText>Balance</HeaderText>
          <HeaderText>Value</HeaderText>
        </DashGrid>

        <List>
          <Accordion collapsible>
            {CURRENCY.filter(currency => {
              if (currency === 'BALN') {
                return !balances['BALN'].plus(balances['BALNstaked']).plus(balances['BALNunstaking']).dp(2).isZero();
              }
              return !balances[currency].dp(2).isZero();
            }).map((currency, index, arr) => {
              const WalletUI = WalletUIs[currency] || SendPanel;
              return (
                <AccordionItem key={currency}>
                  <StyledAccordionButton currency={currency}>
                    <ListItem border={index !== arr.length - 1}>
                      <AssetSymbol>
                        <CurrencyLogo currencyKey={currency} />
                        <Typography fontSize={16} fontWeight="bold">
                          {currency}
                        </Typography>
                      </AssetSymbol>
                      <DataText as="div">
                        {!account
                          ? '-'
                          : currency.toLowerCase() === 'baln'
                          ? balances['BALN']
                              .plus(balances['BALNstaked'])
                              .plus(balances['BALNunstaking'])
                              .dp(2)
                              .toFormat()
                          : balances[currency].dp(2).toFormat()}
                        {currency.toLowerCase() === 'baln' &&
                          (balances['BALNstaked'].isGreaterThan(new BigNumber(0)) ||
                            balances['BALNunstaking'].isGreaterThan(new BigNumber(0))) && (
                            <>
                              <Typography color="rgba(255,255,255,0.75)">
                                Available: {balances['BALN'].dp(2).toFormat()}
                              </Typography>
                            </>
                          )}
                      </DataText>

                      <StyledDataText
                        as="div"
                        hasNotification={currency.toLowerCase() === 'icx' && claimableICX.isGreaterThan(0)}
                      >
                        {!account
                          ? '-'
                          : currency.toLowerCase() === 'baln'
                          ? `$${balances['BALN']
                              .plus(balances['BALNstaked'])
                              .plus(balances['BALNunstaking'])
                              .multipliedBy(rates[currency])
                              .dp(2)
                              .toFormat()}`
                          : `$${balances[currency].multipliedBy(rates[currency]).dp(2).toFormat()}`}
                        {currency.toLowerCase() === 'baln' &&
                          (balances['BALNstaked'].isGreaterThan(new BigNumber(0)) ||
                            balances['BALNunstaking'].isGreaterThan(new BigNumber(0))) && (
                            <>
                              <Typography color="rgba(255,255,255,0.75)">
                                ${balances['BALN'].multipliedBy(rates[currency]).dp(2).toFormat()}
                              </Typography>
                            </>
                          )}
                      </StyledDataText>
                    </ListItem>
                  </StyledAccordionButton>

                  <StyledAccordionPanel hidden={false}>
                    <BoxPanel bg="bg3">
                      {currency.toLocaleLowerCase() === 'icx' ? (
                        <WalletUI currencyKey={currency} claimableICX={claimableICX} />
                      ) : (
                        <WalletUI currencyKey={currency} />
                      )}
                    </BoxPanel>
                  </StyledAccordionPanel>
                </AccordionItem>
              );
            })}
          </Accordion>
        </List>
      </Wrapper>
    </BoxPanel>
  );
};

export default WalletPanel;

const AssetSymbol = styled.div`
  display: grid;
  grid-column-gap: 12px;
  grid-template-columns: auto 1fr;
  align-items: center;
`;

const DashGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  grid-template-areas: 'asset balance value';
  align-items: center;

  & > * {
    justify-content: flex-end;
    text-align: right;

    &:first-child {
      justify-content: flex-start;
      text-align: left;
    }
  }
`;

const HeaderText = styled(Typography)`
  font-size: 14px;
  text-transform: uppercase;
  letter-spacing: 3px;

  &:last-of-type {
    padding-right: 25px;
  }
`;

const DataText = styled(Typography)`
  font-size: 16px;
`;

export const notificationCSS = css`
  position: relative;

  @keyframes pulse {
    0% {
      opacity: 1;
      transform: scale(1);
    }
    100% {
      opacity: 0;
      transform: scale(1.8);
    }
  }

  &:before,
  &:after {
    content: '';
    position: absolute;
    display: inline-block;
    transition: all ease 0.2s;
    top: 7px;
  }

  &:before {
    width: 10px;
    height: 10px;
    background: ${({ theme }) => theme.colors.primary};
    border-radius: 50%;
    right: 1px;
  }

  &:after {
    width: 10px;
    height: 10px;
    background: ${({ theme }) => theme.colors.primary};
    border-radius: 50%;
    right: 1px;
    animation: pulse 1s ease 1s infinite;
  }
`;

const StyledDataText = styled(DataText)<{ hasNotification?: boolean }>`
  padding-right: 25px;
  position: relative;

  &:before,
  &:after {
    content: '';
    width: 2px;
    height: 10px;
    background: #d5d7db;
    display: inline-block;
    position: absolute;
    top: 7px;
    transition: all ease 0.2s;
  }

  &:before {
    transform: rotate(45deg);
    right: 2px;
  }

  &:after {
    transform: rotate(-45deg);
    right: 8px;
  }

  ${({ hasNotification }) => hasNotification && notificationCSS}
`;

const ListItem = styled(DashGrid)<{ border?: boolean }>`
  padding: 20px 0;
  cursor: pointer;
  color: #ffffff;
  border-bottom: ${({ border = true }) => (border ? '1px solid rgba(255, 255, 255, 0.15)' : 'none')};

  & > div {
    transition: color 0.2s ease;
  }

  :hover {
    & > div {
      color: ${({ theme }) => theme.colors.primary};

      &:before,
      &:after {
        background: ${({ theme }) => theme.colors.primary};
      }
    }
  }
`;

const List = styled(Box)`
  -webkit-overflow-scrolling: touch;
`;

const StyledAccordionButton = styled(AccordionButton)<{ currency?: string }>`
  width: 100%;
  appearance: none;
  background: 0;
  border: 0;
  box-shadow: none;
  padding: 0;
  position: relative;

  &:before {
    content: '';
    width: 0;
    height: 0;
    border-left: 12px solid transparent;
    border-right: 12px solid transparent;
    border-bottom: 12px solid #144a68;
    position: absolute;
    transition: all ease-in-out 200ms;
    transition-delay: 200ms;
    transform: translate3d(0, 20px, 0);
    opacity: 0;
    pointer-events: none;
    bottom: 0;
    ${({ currency = 'ICX' }) =>
      currency === 'ICX'
        ? 'left: 37px'
        : currency === 'sICX'
        ? 'left: 42px'
        : currency === 'bnUSD'
        ? 'left: 47px'
        : currency === 'BALN'
        ? 'left: 43px'
        : 'left: 40px'}
  }

  &[aria-expanded='false'] {
    & > ${ListItem} {
      transition: border-bottom ease-out 50ms 480ms;
    }
  }

  &[aria-expanded='true'] {
    &:before {
      transform: translate3d(0, 0, 0);
      opacity: 1;
    }
    & > ${ListItem} {
      border-bottom: 1px solid transparent;

      & > div {
        color: ${({ theme }) => theme.colors.primary};

        &:before,
        &:after {
          background: ${({ theme }) => theme.colors.primary};
          width: 2px;
          height: 10px;
          border-radius: 0;
          animation: none;
        }

        &:before {
          transform: rotate(135deg);
        }

        &:after {
          transform: rotate(-135deg);
          right: 8px;
        }
      }
    }
  }
`;

const StyledAccordionPanel = styled(AccordionPanel)`
  overflow: hidden;
  max-height: 0;
  transition: all ease-in-out 0.5s;
  &[data-state='open'] {
    max-height: 400px;
  }
`;

const Wrapper = styled.div``;
