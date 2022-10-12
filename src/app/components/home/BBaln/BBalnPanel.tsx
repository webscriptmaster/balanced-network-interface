import React, { useCallback, useMemo, useRef, useState } from 'react';

import { addresses } from '@balancednetwork/balanced-js';
import { t, Trans } from '@lingui/macro';
import BigNumber from 'bignumber.js';
import { useIconReact } from 'packages/icon-react';
import Nouislider from 'packages/nouislider-react';
import ClickAwayListener from 'react-click-away-listener';
import { useMedia } from 'react-use';
import { Box, Flex } from 'rebass/styled-components';
import styled, { css } from 'styled-components';

import { Button, TextButton } from 'app/components/Button';
import CurrencyBalanceErrorMessage from 'app/components/CurrencyBalanceErrorMessage';
import { UnderlineTextWithArrow } from 'app/components/DropdownText';
import { inputRegex } from 'app/components/Form';
import LedgerConfirmMessage from 'app/components/LedgerConfirmMessage';
import { MenuItem, MenuList } from 'app/components/Menu';
import Modal from 'app/components/Modal';
import Spinner from 'app/components/Spinner';
import { Typography } from 'app/theme';
import { ReactComponent as QuestionIcon } from 'assets/icons/question.svg';
import bnJs from 'bnJs';
import { NETWORK_ID } from 'constants/config';
import { useChangeShouldLedgerSign, useShouldLedgerSign } from 'store/application/hooks';
import {
  useBBalnAmount,
  useLockedBaln,
  useBBalnSliderState,
  useBBalnSliderActionHandlers,
  useLockedUntil,
  useHasLockExpired,
  useBoostData,
  useTotalSuply,
  Source,
} from 'store/bbaln/hooks';
import { useTransactionAdder } from 'store/transactions/hooks';
import { useBALNDetails, useHasEnoughICX } from 'store/wallet/hooks';
import { escapeRegExp, parseUnits } from 'utils'; // match escaped "." characters via in a non-capturing group
import { showMessageOnBeforeUnload } from 'utils/messages';

import { BoxPanel } from '../../Panel';
import { DropdownPopper } from '../../Popover';
import QuestionHelper from '../../QuestionHelper';
import { MetaData } from '../PositionDetailPanel';
import { LockedPeriod } from './types';
import {
  WEEK_IN_MS,
  lockingPeriods,
  formatDate,
  getClosestUnixWeekStart,
  getWeekOffsetTimestamp,
  getBbalnAmount,
  EXA,
  WEIGHT,
} from './utils';

const ButtonsWrap = styled(Flex)`
  margin-left: auto;
  flex-direction: row;
  @media screen and (max-width: 400px) {
    flex-direction: column;
  }
`;

const SliderWrap = styled(Box)`
  margin: 25px 0;
  .noUi-horizontal .noUi-connects {
    background: #144a68;
    border-radius: 5px;
  }
  .lockup-notice {
    /* transition: all ease 0.2s; */
    opacity: 0;
    transform: translate3d(0, -5px, 0);
    &.show {
      opacity: 1;
      transform: translate3d(0, 0, 0);
    }
  }
`;

const BoostedInfo = styled(Flex)`
  margin-top: 15px;
  padding-top: 15px;
  border-top: 1px solid rgba(255, 255, 255, 0.15);
  width: 100%;
  position: relative;
  flex-wrap: wrap;
`;

const BoostedBox = styled(Flex)`
  border-right: 1px solid rgba(255, 255, 255, 0.15);
  flex-flow: column;
  justify-content: center;
  align-items: center;
  padding: 0 10px;
  width: 33.333%;
  &.no-border {
    border-right: 0;
  }
  @media screen and (max-width: 600px) {
    width: 100%;
    border-right: 0;
    margin-bottom: 20px;
    &.no-border {
      border-right: 0;
      margin-bottom: 0;
    }
  }
`;

const StyledTypography = styled(Typography)`
  position: relative;
  padding: 0 20px;
  margin: 0 -20px;
  svg {
    position: absolute;
    right: 0;
    top: 3px;
    cursor: help;
  }
`;

const PoolItem = styled(Flex)`
  min-width: 120px;
  width: 100%;
  max-width: 25%;
  padding: 15px 15px 0 15px;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  @media screen and (max-width: 600px) {
    max-width: 33.333%;
  }
  @media screen and (max-width: 500px) {
    max-width: 50%;
  }
  @media screen and (max-width: 360px) {
    max-width: 100%;
  }
`;

const BalnPreviewInput = styled.input`
  background: ${({ theme }) => theme.colors.bg5};
  padding: 3px 10px;
  border-radius: 10px;
  border: 2px solid ${({ theme }) => theme.colors.bg5};
  color: #d5d7db;
  font-size: 14px;
  text-align: right;
  width: 80px;
  outline: none;
  margin-right: 4px;
  transition: all ease 0.2s;
  &:focus,
  &:hover {
    border: 2px solid ${({ theme }) => theme.colors.primary};
  }
  &[disabled] {
    background: transparent;
  }
`;

const Threshold = styled(Box)<{ position: number }>`
  left: ${({ position }) => position + '%'};
  position: absolute;
  width: 1px;
  height: 25px;
  margin-top: -15px;
  background: #fff;
  ::after {
    position: absolute;
    content: '';
    top: 0;
    width: 10px;
    height: 1px;
    margin-left: -10px;
    transition: height 0.3s ease;
    background: #fff;
  }
  ${MetaData} {
    width: 60px;
    margin-left: -75px;
    dd {
      color: rgba(255, 255, 255, 1);
    }
  }
`;

const LiquidityDetailsWrap = styled(Box)<{ show?: boolean }>`
  position: absolute;
  right: 0;
  top: 100%;
  margin-top: 20px;
  width: 100%;
  text-align: right;
  opacity: 0;
  z-index: -1;
  pointer-events: none;
  transition: all ease 0.2s;
  ${({ show }) =>
    show &&
    css`
      opacity: 1;
      z-index: 1;
      pointer-events: all;
    `}
  &:before {
    content: '';
    width: 0;
    height: 0;
    border-left: 12px solid transparent;
    border-right: 12px solid transparent;
    border-bottom: 12px solid ${({ theme }) => theme.colors.primary};
    position: absolute;
    bottom: 100%;
    margin-bottom: -2px;
    right: calc(16.666% - 13px);
    @media screen and (max-width: 600px) {
      right: calc(50% - 12px);
    }
  }
`;

const LiquidityDetails = styled(Flex)`
  flex-wrap: wrap;
  display: inline-flex;
  padding: 0 15px 15px 15px;
  background: ${({ theme }) => theme.colors.bg2};
  border: 2px solid ${({ theme }) => theme.colors.primary};
  border-radius: 10px;
  width: auto;
`;

const MaxRewardsReachedNotice = styled(Box)<{ show?: boolean }>`
  opacity: 0;
  pointer-events: none;
  transition: opacity ease 0.2s;
  ${({ theme, show }) =>
    css`
      background: ${theme.colors.bg2};
      border: 2px solid ${theme.colors.primary};
      ${show && 'opacity: 1;'}
      ${show && 'pointer-events: all;'}
    `}
  border-radius: 10px;
  padding: 15px;
  font-size: 14px;
  color: #fff;
  position: absolute;
  bottom: 100%;
  margin-bottom: -2px;
  &:before {
    content: '';
    width: 0;
    height: 0;
    border-left: 12px solid transparent;
    border-right: 12px solid transparent;
    border-top: 12px solid ${({ theme }) => theme.colors.primary};
    position: absolute;
    top: 100%;
    right: calc(50% - 12px);
  }
  @media screen and (max-width: 600px) {
    ${({ show }) =>
      css`
        ${show && 'position: relative;'}
      `}
    transition: none;
    top: 0;
    transform: translate3d(0, -13px, 0);
  }
`;

export default function BBalnPanel() {
  const { account } = useIconReact();
  const bBalnAmount = useBBalnAmount();
  const lockedBalnAmount = useLockedBaln();
  const lockedUntil = useLockedUntil();
  const totalSupplyBBaln = useTotalSuply();
  const { data: boostData } = useBoostData();
  const { data: hasLockExpired } = useHasLockExpired();
  const { typedValue, isAdjusting, inputType } = useBBalnSliderState();
  const { onFieldAInput, onSlide, onAdjust: adjust } = useBBalnSliderActionHandlers();
  const sliderInstance = React.useRef<any>(null);
  const [showLiquidityTooltip, setShowLiquidityTooltip] = useState(false);
  const arrowRef = React.useRef(null);
  const changeShouldLedgerSign = useChangeShouldLedgerSign();
  const shouldLedgerSign = useShouldLedgerSign();
  const [periodDropdownAnchor, setPeriodDropdownAnchor] = useState<HTMLElement | null>(null);
  const [selectedLockedPeriod, setSelectedLockedPeriod] = useState<LockedPeriod>(lockingPeriods[0]);
  const periodArrowRef = useRef(null);
  const balnDetails = useBALNDetails();
  const hasEnoughICX = useHasEnoughICX();
  const isSmallScreen = useMedia('(max-width: 540px)');
  const isSuperSmallScreen = useMedia('(max-width: 400px)');

  const addTransaction = useTransactionAdder();

  const balnBalanceAvailable =
    balnDetails && balnDetails['Available balance'] ? balnDetails['Available balance']! : new BigNumber(0);

  const handleEnableAdjusting = () => {
    adjust(true);
  };

  const handleWithdraw = async () => {
    window.addEventListener('beforeunload', showMessageOnBeforeUnload);
    if (bnJs.contractSettings.ledgerSettings.actived) {
      changeShouldLedgerSign(true);
    }

    try {
      const { result: hash } = await bnJs.inject({ account }).BBALN.withdraw();

      addTransaction(
        { hash },
        {
          pending: t`Withdrawing BALN...`,
          summary: t`${lockedBalnAmount?.toFixed(2, { groupSeparator: ',' })} BALN withdrawn`,
        },
      );
    } catch (e) {
      console.error(e);
    } finally {
      changeShouldLedgerSign(false);
      window.removeEventListener('beforeunload', showMessageOnBeforeUnload);
    }
    setWithdrawModalOpen(false);
  };

  const handleCancelAdjusting = () => {
    adjust(false);
    setPeriodDropdownAnchor(null);
    setShowLiquidityTooltip(false);
    changeShouldLedgerSign(false);
  };

  const showLPTooltip = () => {
    setShowLiquidityTooltip(true);
  };

  const hideLPTooltip = () => {
    setShowLiquidityTooltip(false || isAdjusting);
  };

  const handleBoostUpdate = async () => {
    window.addEventListener('beforeunload', showMessageOnBeforeUnload);
    if (bnJs.contractSettings.ledgerSettings.actived) {
      changeShouldLedgerSign(true);
    }

    const lockTimestamp = selectedLockedPeriod.weeks * WEEK_IN_MS + new Date().getTime();

    try {
      if (shouldBoost) {
        if (bBalnAmount && bBalnAmount.isGreaterThan(0)) {
          if (differenceBalnAmount.isEqualTo(0)) {
            const { result: hash } = await bnJs.inject({ account }).BBALN.increaseUnlockTime(lockTimestamp);

            addTransaction(
              { hash },
              {
                pending: t`Increasing lock duration...`,
                summary: t`Lock duration increased`,
              },
            );
          } else {
            const { result: hash } = await bnJs
              .inject({ account })
              .BALN.increaseAmount(
                addresses[NETWORK_ID].bbaln,
                parseUnits(differenceBalnAmount.toFixed()),
                isPeriodChanged ? lockTimestamp : 0,
              );

            addTransaction(
              { hash },
              {
                pending: t`Locking BALN...`,
                summary: t`${differenceBalnAmount.toFixed()} BALN locked.`,
              },
            );
          }
        } else {
          const { result: hash } = await bnJs
            .inject({ account })
            .BALN.createLock(addresses[NETWORK_ID].bbaln, parseUnits(differenceBalnAmount.toFixed()), lockTimestamp);

          addTransaction(
            { hash },
            {
              pending: t`Locking BALN...`,
              summary: t`${differenceBalnAmount.toFixed()} BALN locked.`,
            },
          );
        }
      } else {
        const { result: hash } = await bnJs.inject({ account }).BBALN.withdrawEarly();

        addTransaction(
          { hash },
          {
            pending: t`Withdrawing BALN...`,
            summary: t`${lockedBalnAmount?.divide(2).toFixed(0, { groupSeparator: ',' })} BALN withdrawn.`,
          },
        );
      }
      adjust(false);
    } catch (error) {
      console.error('creating lock: ', error);
    } finally {
      changeShouldLedgerSign(false);
      window.removeEventListener('beforeunload', showMessageOnBeforeUnload);
    }
    setConfirmationModalOpen(false);
  };

  const [confirmationModalOpen, setConfirmationModalOpen] = React.useState(false);
  const [withdrawModalOpen, setWithdrawModalOpen] = React.useState(false);

  const toggleConfirmationModalOpen = () => {
    if (shouldLedgerSign) return;
    setConfirmationModalOpen(!confirmationModalOpen);
  };

  const toggleWithdrawModalOpen = () => {
    if (shouldLedgerSign) return;
    setWithdrawModalOpen(!withdrawModalOpen);
  };

  const balnSliderAmount = useMemo(() => new BigNumber(typedValue), [typedValue]);
  const buttonText = hasLockExpired
    ? lockedBalnAmount?.greaterThan(0)
      ? t`Withdraw BALN`
      : t`Boost`
    : bBalnAmount?.isZero()
    ? t`Boost`
    : t`Adjust`;
  const beforeBalnAmount = new BigNumber(lockedBalnAmount?.toFixed(0) || 0);
  const differenceBalnAmount = balnSliderAmount.minus(beforeBalnAmount || new BigNumber(0));
  const shouldBoost = differenceBalnAmount.isPositive();

  const isPeriodChanged = useMemo(() => {
    const lockTimestamp = getWeekOffsetTimestamp(selectedLockedPeriod.weeks);
    return getClosestUnixWeekStart(lockTimestamp).getTime() !== lockedUntil?.getTime();
  }, [lockedUntil, selectedLockedPeriod]);

  const availablePeriods = useMemo(() => {
    if (lockedUntil) {
      const availablePeriods = lockingPeriods.filter(period => {
        return lockedUntil ? lockedUntil < new Date(new Date().setDate(new Date().getDate() + period.weeks * 7)) : true;
      });
      return availablePeriods.length ? availablePeriods : [lockingPeriods[lockingPeriods.length - 1]];
    } else {
      return lockingPeriods;
    }
  }, [lockedUntil]);

  // reset loan ui state if cancel adjusting
  React.useEffect(() => {
    if (!isAdjusting) {
      onFieldAInput(
        lockedBalnAmount !== undefined ? (lockedBalnAmount.greaterThan(0) ? lockedBalnAmount?.toFixed(0) : '0') : '0',
      );
      setSelectedLockedPeriod(availablePeriods[0]);
    }
  }, [onFieldAInput, lockedBalnAmount, isAdjusting, availablePeriods]);

  // optimize slider performance
  // change slider value if only a user types
  React.useEffect(() => {
    if (inputType === 'text') {
      sliderInstance.current?.noUiSlider.set(balnSliderAmount.toNumber());
    }
  }, [balnSliderAmount, inputType]);

  const shouldShowLock = lockedBalnAmount && lockedBalnAmount.greaterThan(0);
  const lockbarPercentPosition = lockedBalnAmount
    ? new BigNumber(lockedBalnAmount.toFixed(0)).times(100).div(balnBalanceAvailable).toNumber()
    : 0;

  const handleLockingPeriodChange = period => {
    setSelectedLockedPeriod(period);
  };

  const handlePeriodDropdownToggle = (e: React.MouseEvent<HTMLElement>) => {
    setPeriodDropdownAnchor(periodDropdownAnchor ? null : periodArrowRef.current);
  };

  const closeDropdown = () => {
    setPeriodDropdownAnchor(null);
  };

  const handleBBalnInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextUserInput = event.target.value.replace(/,/g, '.');

    if (nextUserInput === '' || inputRegex.test(escapeRegExp(nextUserInput))) {
      let nextInput = nextUserInput;
      const value = new BigNumber(nextUserInput || '0');

      if (value.isGreaterThan(balnBalanceAvailable)) {
        nextInput = balnBalanceAvailable.dp(2).toFixed();
      } else if (value.isLessThan(0)) {
        nextInput = '0';
      }

      onFieldAInput(nextInput);
    }
  };

  const dynamicBBalnAmount = useMemo(() => getBbalnAmount(balnSliderAmount, selectedLockedPeriod), [
    balnSliderAmount,
    selectedLockedPeriod,
  ]);

  const isMaxRewardReached = (bBaln: BigNumber, source: string): boolean => {
    if (totalSupplyBBaln && boostData) {
      return bBaln.isGreaterThanOrEqualTo(
        boostData[source].balance.times(totalSupplyBBaln).dividedBy(boostData[source].supply),
      );
    }
    return false;
  };

  const boostedLPs = useMemo(() => {
    if (boostData) {
      return Object.keys(boostData).reduce((LPs, sourceName) => {
        if (sourceName !== 'Loans' && boostData[sourceName].balance.isGreaterThan(0)) {
          LPs[sourceName] = { ...boostData[sourceName] };
        }
        return LPs;
      }, {} as { [key in string]: Source });
    }
  }, [boostData]);

  const getWorkingBalance = useCallback(
    (balance: BigNumber, supply: BigNumber): BigNumber => {
      if (totalSupplyBBaln) {
        const limit = balance.times(EXA).dividedBy(WEIGHT);
        const workingBalance = balance.plus(
          supply.times(dynamicBBalnAmount).times(EXA.minus(WEIGHT)).dividedBy(totalSupplyBBaln).dividedBy(WEIGHT),
        );
        return BigNumber.min(limit, workingBalance);
      }

      return new BigNumber(0);
    },
    [totalSupplyBBaln, dynamicBBalnAmount],
  );

  const boostedLPNumbers = useMemo(() => {
    if (isAdjusting) {
      return (
        boostedLPs &&
        Object.values(boostedLPs).map(boostedLP =>
          getWorkingBalance(boostedLP.balance, boostedLP.supply).dividedBy(boostedLP.balance).dp(2).toNumber(),
        )
      );
    } else {
      return (
        boostedLPs &&
        Object.values(boostedLPs).map(boostedLP =>
          boostedLP.workingBalance.dividedBy(boostedLP.balance).dp(2).toNumber(),
        )
      );
    }
  }, [isAdjusting, boostedLPs, getWorkingBalance]);

  console.log(boostedLPNumbers);

  const differenceBBalnAmount = useMemo(() => {
    if (isAdjusting) {
      return getBbalnAmount(differenceBalnAmount.abs(), selectedLockedPeriod);
    } else {
      return new BigNumber(0);
    }
  }, [isAdjusting, differenceBalnAmount, selectedLockedPeriod]);

  return (
    <BoxPanel bg="bg2" flex={1}>
      {balnBalanceAvailable.isGreaterThan(0) ? (
        <>
          <Flex alignItems={isSmallScreen ? 'flex-start' : 'flex-end'}>
            <Flex
              flexDirection={isSmallScreen ? 'column' : 'row'}
              alignItems={isSmallScreen ? 'flex-start' : 'flex-end'}
            >
              <Typography variant="h3" paddingRight={'10px'} paddingBottom={isSmallScreen ? '5px' : '0'}>
                Boost rewards{' '}
              </Typography>
              <Typography padding="0 3px 2px 0">
                {isAdjusting ? dynamicBBalnAmount.dp(2).toFormat() : bBalnAmount.dp(2).toFormat()} bBALN
                <QuestionHelper text="Lock BALN to boost your earning potential. The longer you lock it, the more bBALN (boosted BALN) you'll receive, which determines your earning and voting power." />
              </Typography>
            </Flex>

            <ButtonsWrap>
              {isAdjusting ? (
                <>
                  <TextButton onClick={handleCancelAdjusting} marginBottom={isSuperSmallScreen ? '5px' : 0}>
                    Cancel
                  </TextButton>
                  <Button
                    disabled={
                      bBalnAmount.isGreaterThan(0)
                        ? differenceBalnAmount.isZero() && !isPeriodChanged
                        : differenceBalnAmount.isZero()
                    }
                    onClick={toggleConfirmationModalOpen}
                    fontSize={14}
                  >
                    Confirm
                  </Button>
                </>
              ) : (
                <Button
                  onClick={
                    hasLockExpired && lockedBalnAmount?.greaterThan(0) ? toggleWithdrawModalOpen : handleEnableAdjusting
                  }
                  fontSize={14}
                >
                  {buttonText}
                </Button>
              )}
            </ButtonsWrap>
          </Flex>
          <SliderWrap>
            <Typography className={`lockup-notice${isAdjusting ? '' : ' show'}`}>
              Lock up BALN to boost your earning potential.
            </Typography>

            {shouldShowLock && isAdjusting && (
              <Box style={{ position: 'relative' }}>
                <Threshold position={lockbarPercentPosition}>
                  <MetaData as="dl" style={{ textAlign: 'right' }}>
                    <dd>Locked</dd>
                  </MetaData>
                </Threshold>
              </Box>
            )}

            <Box margin="10px 0">
              <Nouislider
                disabled={!isAdjusting}
                id="slider-bbaln"
                start={[Number(lockedBalnAmount?.toFixed(0) || 0)]}
                connect={[true, false]}
                step={1}
                range={{
                  min: [0],
                  max: [balnBalanceAvailable.dp(0).toNumber()], //baln balance - max SLIDER_RANGE_MAX_BOTTOM_THRESHOLD, boostableAmount
                }}
                instanceRef={instance => {
                  if (instance) {
                    sliderInstance.current = instance;
                  }
                }}
                onSlide={onSlide}
              />
            </Box>

            <Flex justifyContent="space-between" flexWrap={'wrap'}>
              <Flex alignItems="center">
                {isAdjusting ? (
                  <BalnPreviewInput
                    type="text"
                    disabled={!isAdjusting}
                    value={balnSliderAmount.toNumber()}
                    onChange={handleBBalnInputChange}
                  />
                ) : (
                  <Typography paddingRight={'5px'}>{balnSliderAmount.toFormat()}</Typography>
                )}

                <Typography paddingRight={'15px'}>
                  {' '}
                  / {balnBalanceAvailable.toFormat(0, BigNumber.ROUND_DOWN)} BALN
                </Typography>
              </Flex>

              {(bBalnAmount?.isGreaterThan(0) || isAdjusting) && (
                <Typography paddingTop={isAdjusting ? '6px' : '0'}>
                  {hasLockExpired && !isAdjusting ? (
                    t`Unlocked on ${formatDate(lockedUntil)}`
                  ) : shouldBoost ? (
                    <>
                      {t`Locked until`}{' '}
                      {isAdjusting ? (
                        <>
                          <ClickAwayListener onClickAway={closeDropdown}>
                            <UnderlineTextWithArrow
                              onClick={handlePeriodDropdownToggle}
                              text={formatDate(
                                getClosestUnixWeekStart(
                                  new Date(
                                    new Date().setDate(new Date().getDate() + (selectedLockedPeriod.weeks * 7 - 7)),
                                  ).getTime(),
                                ),
                              )}
                              arrowRef={periodArrowRef}
                            />
                          </ClickAwayListener>
                          <DropdownPopper
                            show={Boolean(periodDropdownAnchor)}
                            anchorEl={periodDropdownAnchor}
                            placement="bottom-end"
                          >
                            <MenuList>
                              {availablePeriods.map(period => (
                                <MenuItem key={period.weeks} onClick={() => handleLockingPeriodChange(period)}>
                                  {period.name}
                                </MenuItem>
                              ))}
                            </MenuList>
                          </DropdownPopper>
                        </>
                      ) : (
                        formatDate(lockedUntil)
                      )}
                    </>
                  ) : (
                    isAdjusting && (
                      <Typography fontSize={14} color="#fb6a6a">
                        <Trans>You'll need to pay a 50% fee to unlock BALN early.</Trans>
                      </Typography>
                    )
                  )}
                </Typography>
              )}
            </Flex>
          </SliderWrap>
          {balnSliderAmount.isGreaterThan(0) && (
            <BoostedInfo>
              <BoostedBox>
                <Typography fontSize={16} color="#FFF">
                  {totalSupplyBBaln
                    ? isAdjusting
                      ? differenceBalnAmount.isGreaterThanOrEqualTo(0)
                        ? `${bBalnAmount
                            .plus(differenceBBalnAmount)
                            .dividedBy(totalSupplyBBaln.plus(differenceBBalnAmount))
                            .times(100)
                            .toFixed(2)} %`
                        : `${bBalnAmount
                            .minus(differenceBBalnAmount)
                            .dividedBy(totalSupplyBBaln.minus(differenceBBalnAmount))
                            .times(100)
                            .toFixed(2)} %`
                      : `${bBalnAmount.dividedBy(totalSupplyBBaln).times(100).toFixed(2)} %`
                    : '-'}
                </Typography>
                <Typography>Network fees</Typography>
              </BoostedBox>
              <BoostedBox>
                <MaxRewardsReachedNotice show={isAdjusting && isMaxRewardReached(dynamicBBalnAmount, 'Loans')}>
                  Max rewards
                </MaxRewardsReachedNotice>
                <Typography fontSize={16} color="#FFF">
                  {isAdjusting
                    ? boostData && totalSupplyBBaln
                      ? `${getWorkingBalance(boostData.Loans.balance, boostData.Loans.supply)
                          .dividedBy(boostData.Loans.balance)
                          .toFixed(2)} x`
                      : '-'
                    : boostData
                    ? `${boostData.Loans.workingBalance.dividedBy(boostData.Loans.balance).toFixed(2)} x`
                    : '-'}
                </Typography>
                <Typography>Loan rewards</Typography>
              </BoostedBox>
              <BoostedBox className="no-border">
                <Typography fontSize={16} color="#FFF">
                  {boostedLPNumbers !== undefined && boostedLPNumbers?.length !== 0
                    ? boostedLPNumbers.length === 1
                      ? `${boostedLPNumbers[0]} x`
                      : `${Math.min(...boostedLPNumbers)} x - ${Math.max(...boostedLPNumbers)} x`
                    : '-'}
                </Typography>
                <StyledTypography ref={arrowRef}>
                  Liquidity rewards{' '}
                  <QuestionIcon width={14} onMouseEnter={showLPTooltip} onMouseLeave={hideLPTooltip} />
                </StyledTypography>
              </BoostedBox>
              <LiquidityDetailsWrap show={showLiquidityTooltip || isAdjusting}>
                <LiquidityDetails>
                  {boostedLPNumbers !== undefined && boostedLPNumbers?.length !== 0 ? (
                    boostedLPs &&
                    Object.keys(boostedLPs).map(boostedLP => {
                      return (
                        <PoolItem key={boostedLP}>
                          <Typography fontSize={16} color="#FFF">
                            {`${
                              isAdjusting
                                ? getWorkingBalance(boostedLPs[boostedLP].balance, boostedLPs[boostedLP].supply)
                                    .dividedBy(boostedLPs[boostedLP].balance)
                                    .toFixed(2)
                                : boostedLPs[boostedLP].workingBalance
                                    .dividedBy(boostedLPs[boostedLP].balance)
                                    .toFixed(2)
                            } x`}
                          </Typography>
                          <Typography fontSize={14}>{boostedLP}</Typography>
                        </PoolItem>
                      );
                    })
                  ) : (
                    <Typography paddingTop="10px" marginBottom="-5px" maxWidth={250} textAlign="left">
                      <Trans>You must have supplied liquidity in any of BALN incentivised pools.</Trans>
                    </Typography>
                  )}
                </LiquidityDetails>
              </LiquidityDetailsWrap>
            </BoostedInfo>
          )}
        </>
      ) : (
        <>
          <Typography variant="h3" marginBottom={6}>
            Boost rewards
          </Typography>
          <Typography fontSize={14} opacity={0.75}>
            Earn or buy BALN, then lock it up here to boost your earning potential and voting power.
          </Typography>
        </>
      )}

      {/* Adjust Modal */}
      <Modal isOpen={confirmationModalOpen} onDismiss={toggleConfirmationModalOpen}>
        <Flex flexDirection="column" alignItems="stretch" m={5} width="100%">
          <Typography textAlign="center" mb="5px">
            {shouldBoost ? 'Lock up Balance Tokens?' : 'Unlock Balance Tokens?'}
          </Typography>

          <Typography variant="p" fontWeight="bold" textAlign="center" fontSize={20}>
            {differenceBalnAmount.abs().toFormat(2)} BALN
          </Typography>
          {!shouldBoost && (
            <Typography textAlign="center" fontSize={14} color="#fb6a6a">
              Minus 50% fee: {differenceBalnAmount.div(2).abs().toFormat(2)} BALN
            </Typography>
          )}

          <Flex my={5}>
            <Box width={1 / 2} className="border-right">
              <Typography textAlign="center">Before</Typography>
              <Typography variant="p" textAlign="center">
                {balnBalanceAvailable.minus(bBalnAmount).toFormat(2)} BALN
              </Typography>
            </Box>

            <Box width={1 / 2}>
              <Typography textAlign="center">After</Typography>
              <Typography variant="p" textAlign="center">
                {balnBalanceAvailable
                  .minus(bBalnAmount)
                  .minus(shouldBoost ? differenceBalnAmount : differenceBalnAmount.div(2))
                  .toFormat(2)}{' '}
                BALN
              </Typography>
            </Box>
          </Flex>

          {shouldBoost && (
            <Typography textAlign="center">
              Your BALN will be locked until{' '}
              <strong>{formatDate(getClosestUnixWeekStart(getWeekOffsetTimestamp(selectedLockedPeriod.weeks)))}</strong>
            </Typography>
          )}

          <Flex justifyContent="center" mt={4} pt={4} className="border-top" flexWrap={'wrap'}>
            {shouldLedgerSign && <Spinner></Spinner>}
            {!shouldLedgerSign && (
              <>
                <TextButton onClick={toggleConfirmationModalOpen} fontSize={14}>
                  Cancel
                </TextButton>
                <Button disabled={!hasEnoughICX} onClick={handleBoostUpdate} fontSize={14} warning={!shouldBoost}>
                  {shouldBoost ? 'Lock up BALN' : 'Unlock BALN for a 50% fee'}
                </Button>
              </>
            )}
          </Flex>

          <LedgerConfirmMessage />

          {!hasEnoughICX && <CurrencyBalanceErrorMessage mt={3} />}
        </Flex>
      </Modal>

      {/* Withdraw Modal */}
      <Modal isOpen={withdrawModalOpen} onDismiss={toggleWithdrawModalOpen}>
        <Flex flexDirection="column" alignItems="stretch" m={5} width="100%">
          <Typography textAlign="center" mb="5px">
            <Trans>Withdraw</Trans>
          </Typography>

          <Typography variant="p" fontWeight="bold" textAlign="center" fontSize={20} mb={2}>
            {lockedBalnAmount?.toFixed(0)} BALN
          </Typography>
          <Typography textAlign="center" fontSize={14} mb={1}>
            <Trans>You must withdraw to be able to lock BALN again.</Trans>
          </Typography>

          {shouldBoost && (
            <Typography textAlign="center">
              <Trans>Your BALN was unlocked on</Trans> <strong>{formatDate(lockedUntil)}</strong>.
            </Typography>
          )}

          <Flex justifyContent="center" mt={4} pt={4} className="border-top" flexWrap={'wrap'}>
            {shouldLedgerSign && <Spinner></Spinner>}
            {!shouldLedgerSign && (
              <>
                <TextButton onClick={toggleWithdrawModalOpen} fontSize={14}>
                  Cancel
                </TextButton>
                <Button disabled={!hasEnoughICX} onClick={handleWithdraw} fontSize={14}>
                  {t`Withdraw BALN`}
                </Button>
              </>
            )}
          </Flex>

          <LedgerConfirmMessage />

          {!hasEnoughICX && <CurrencyBalanceErrorMessage mt={3} />}
        </Flex>
      </Modal>
    </BoxPanel>
  );
}
