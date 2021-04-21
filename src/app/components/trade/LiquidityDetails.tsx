import React from 'react';

import BigNumber from 'bignumber.js';
import { BalancedJs } from 'packages/BalancedJs';
import { useIconReact } from 'packages/icon-react';
import Nouislider from 'packages/nouislider-react';
import ClickAwayListener from 'react-click-away-listener';
import { useMedia } from 'react-use';
import { Flex, Box } from 'rebass/styled-components';
import styled from 'styled-components';

import { Button, TextButton } from 'app/components/Button';
import CurrencyInputPanel from 'app/components/CurrencyInputPanel';
import { UnderlineTextWithArrow } from 'app/components/DropdownText';
import Modal from 'app/components/Modal';
import { BoxPanel } from 'app/components/Panel';
import { DropdownPopper } from 'app/components/Popover';
import { Typography } from 'app/theme';
import { ReactComponent as ICXIcon } from 'assets/logos/icx.svg';
import { ReactComponent as SICXIcon } from 'assets/logos/sicx.svg';
import bnJs from 'bnJs';
import { CURRENCY_LIST, BASE_SUPPORTED_PAIRS } from 'constants/currency';
import { ONE, ZERO } from 'constants/index';
import { Field } from 'store/mint/actions';
import { useBalance, usePool, usePoolData, useAvailableBalances } from 'store/pool/hooks';
import { useTransactionAdder } from 'store/transactions/hooks';
import { useWalletBalances } from 'store/wallet/hooks';
import { formatBigNumber } from 'utils';

import { withdrawMessage } from './utils';

export default function LiquidityDetails() {
  const below800 = useMedia('(max-width: 800px)');
  const balances = useAvailableBalances();

  const balance1 = useBalance(BalancedJs.utils.POOL_IDS.sICXICX);

  const isHidden = !balance1 || (balance1.balance.isZero() && (balance1.balance1 || ZERO).isZero());

  if (isHidden && Object.keys(balances).length === 0) return null;

  return (
    <BoxPanel bg="bg2" mb={10}>
      <Typography variant="h2" mb={5}>
        Liquidity details
      </Typography>

      <TableWrapper>
        <DashGrid>
          <HeaderText>Pool</HeaderText>
          <HeaderText>Your supply</HeaderText>
          {!below800 && <HeaderText>Pool share</HeaderText>}
          {!below800 && <HeaderText>Daily rewards</HeaderText>}
          <HeaderText></HeaderText>
        </DashGrid>

        {!isHidden && <PoolRecord1 border={Object.keys(balances).length !== 0} />}

        {Object.keys(balances).map((poolId, index, arr) => (
          <PoolRecord key={poolId} poolId={parseInt(poolId)} border={index !== arr.length - 1} />
        ))}
      </TableWrapper>
    </BoxPanel>
  );
}

const TableWrapper = styled.div``;

const DashGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 1fr 1fr;
  grid-template-areas: 'name supply share rewards action';
  align-items: center;

  & > * {
    justify-content: flex-end;
    text-align: right;

    &:first-child {
      justify-content: flex-start;
      text-align: left;
    }
  }

  ${({ theme }) => theme.mediaWidth.upToSmall`
    grid-template-columns: 4fr 5fr 3fr;
    grid-template-areas: 'name supply action';
  `}
`;

const HeaderText = styled(Typography)`
  font-size: 14px;
  text-transform: uppercase;
  letter-spacing: 3px;
`;

const DataText = styled(Box)`
  font-size: 16px;
`;

const ListItem = styled(DashGrid)<{ border?: boolean }>`
  padding: 20px 0;
  color: #ffffff;
  border-bottom: ${({ border = true }) => (border ? '1px solid rgba(255, 255, 255, 0.15)' : 'none')};
`;

const PoolRecord = ({ poolId, border }: { poolId: number; border: boolean }) => {
  const pair = BASE_SUPPORTED_PAIRS.find(pair => pair.poolId === poolId) || BASE_SUPPORTED_PAIRS[0];
  const poolData = usePoolData(pair.poolId);
  const below800 = useMedia('(max-width: 800px)');

  return (
    <ListItem border={border}>
      <DataText>{pair.pair}</DataText>
      <DataText>
        {`${formatBigNumber(poolData?.suppliedBase, 'currency')} ${pair.baseCurrencyKey}`}
        <br />
        {`${formatBigNumber(poolData?.suppliedQuote, 'currency')} ${pair.quoteCurrencyKey}`}
      </DataText>
      {!below800 && <DataText>{`${formatBigNumber(poolData?.poolShare.times(100), 'currency')}%`}</DataText>}
      {!below800 && <DataText>{`~ ${formatBigNumber(poolData?.suppliedReward, 'currency')} BALN`}</DataText>}
      <DataText>
        <WithdrawText poolId={pair.poolId} />
      </DataText>
    </ListItem>
  );
};

const WithdrawText = ({ poolId }: { poolId: number }) => {
  const [anchor, setAnchor] = React.useState<HTMLElement | null>(null);

  const arrowRef = React.useRef(null);

  const toggle = () => {
    setAnchor(anchor ? null : arrowRef.current);
  };

  const close = () => {
    setAnchor(null);
  };

  return (
    <ClickAwayListener onClickAway={close}>
      <div>
        <UnderlineTextWithArrow onClick={toggle} text="Withdraw" arrowRef={arrowRef} />
        <DropdownPopper show={Boolean(anchor)} anchorEl={anchor}>
          {poolId === BalancedJs.utils.POOL_IDS.sICXICX ? (
            <WithdrawModal1 onClose={close} />
          ) : (
            <WithdrawModal poolId={poolId} onClose={close} />
          )}
        </DropdownPopper>
      </div>
    </ClickAwayListener>
  );
};

const PoolRecord1 = ({ border }: { border: boolean }) => {
  const pair = BASE_SUPPORTED_PAIRS[2];
  const poolData = usePoolData(pair.poolId);
  const below800 = useMedia('(max-width: 800px)');

  return (
    <ListItem border={border}>
      <DataText>{pair.pair}</DataText>
      <DataText>{`${formatBigNumber(poolData?.suppliedBase, 'currency')} ${pair.baseCurrencyKey}`}</DataText>
      {!below800 && <DataText>{`${formatBigNumber(poolData?.poolShare.times(100), 'currency')}%`}</DataText>}
      {!below800 && <DataText>{`~ ${formatBigNumber(poolData?.suppliedReward, 'currency')} BALN`}</DataText>}
      <DataText>
        <WithdrawText poolId={pair.poolId} />
      </DataText>
    </ListItem>
  );
};

const WithdrawModal1 = ({ onClose }: { onClose: () => void }) => {
  const { account } = useIconReact();
  const pair = BASE_SUPPORTED_PAIRS[2];
  const addTransaction = useTransactionAdder();
  const balance1 = useBalance(BalancedJs.utils.POOL_IDS.sICXICX);

  const handleCancelOrder = () => {
    bnJs
      .inject({ account })
      .Dex.cancelSicxIcxOrder()
      .then(res => {
        addTransaction(
          { hash: res.result },
          {
            pending: withdrawMessage(balance1?.balance?.dp(2).toFormat() || '', 'ICX', '', 'sICX').pendingMessage,
            summary: withdrawMessage(balance1?.balance?.dp(2).toFormat() || '', 'ICX', '', 'sICX').successMessage,
          },
        );
        toggleOpen1();
      })
      .catch(e => {
        console.error('error', e);
      });
  };

  const handleWithdrawEarnings = () => {
    bnJs
      .inject({ account })
      .Dex.withdrawSicxEarnings()
      .then(res => {
        addTransaction(
          { hash: res.result },
          {
            pending: 'Withdrawing sICX',
            summary: `${balance1?.balance1?.dp(2).toFormat()} sICX added to your wallet.`,
          },
        );
        toggleOpen2();
      })
      .catch(e => {
        console.error('error', e);
      });
  };

  const [open1, setOpen1] = React.useState(false);
  const toggleOpen1 = () => {
    setOpen1(!open1);
  };
  const handleOption1 = () => {
    toggleOpen1();
    onClose();
  };

  const [open2, setOpen2] = React.useState(false);
  const toggleOpen2 = () => {
    setOpen2(!open2);
  };
  const handleOption2 = () => {
    toggleOpen2();
    onClose();
  };

  return (
    <>
      <Flex padding={5} bg="bg4" maxWidth={320} flexDirection="column">
        <Typography variant="h3" mb={3}>
          Withdraw:&nbsp;
          <Typography as="span">{pair.pair}</Typography>
        </Typography>

        <Flex alignItems="center" justifyContent="space-between">
          <OptionButton disabled={balance1?.balance.isZero()} onClick={handleOption1} mr={2}>
            <ICXIcon width="35" height="35" />
            <Typography>{balance1?.balance.dp(2).toFormat()} ICX</Typography>
          </OptionButton>

          <OptionButton disabled={balance1?.balance1?.isZero()} onClick={handleOption2}>
            <SICXIcon width="35" height="35" />
            <Typography>{balance1?.balance1?.dp(2).toFormat()} sICX</Typography>
          </OptionButton>
        </Flex>
      </Flex>

      <Modal isOpen={open1} onDismiss={toggleOpen1}>
        <Flex flexDirection="column" alignItems="stretch" m={5} width="100%">
          <Typography textAlign="center" mb={3} as="h3" fontWeight="normal">
            Withdraw liquidity?
          </Typography>

          <Typography variant="p" fontWeight="bold" textAlign="center">
            {formatBigNumber(balance1?.balance, 'currency')} {pair.baseCurrencyKey}
          </Typography>

          <Flex justifyContent="center" mt={4} pt={4} className="border-top">
            <TextButton onClick={toggleOpen1}>Cancel</TextButton>
            <Button onClick={handleCancelOrder}>Withdraw</Button>
          </Flex>
        </Flex>
      </Modal>

      <Modal isOpen={open2} onDismiss={toggleOpen2}>
        <Flex flexDirection="column" alignItems="stretch" m={5} width="100%">
          <Typography textAlign="center" mb={3} as="h3" fontWeight="normal">
            Withdraw sICX?
          </Typography>

          <Typography variant="p" fontWeight="bold" textAlign="center">
            {formatBigNumber(balance1?.balance1, 'currency')} {pair.quoteCurrencyKey}
          </Typography>

          <Flex justifyContent="center" mt={4} pt={4} className="border-top">
            <TextButton onClick={toggleOpen2}>Cancel</TextButton>
            <Button onClick={handleWithdrawEarnings}>Withdraw</Button>
          </Flex>
        </Flex>
      </Modal>
    </>
  );
};

const OptionButton = styled(Box)`
  width: 96px;
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  border-radius: 10px;
  text-decoration: none;
  color: white;
  user-select: none;
  text-align: center;
  background-color: ${({ theme }) => theme.colors.bg3};
  border: 2px solid #144a68;
  transition: border 0.3s ease;
  padding: 10px;
  transition: border 0.3s ease;

  &[disabled] {
    background: #27264a;
    cursor: default;
    pointer-events: none;
  }

  :hover {
    border: 2px solid ${({ theme }) => theme.colors.primary};
    transition: border 0.2s ease;
  }

  > svg {
    margin-bottom: 10px;
  }
`;

const WithdrawModal = ({ poolId, onClose }: { poolId: number; onClose: () => void }) => {
  const pair = BASE_SUPPORTED_PAIRS.find(pair => pair.poolId === poolId) || BASE_SUPPORTED_PAIRS[0];
  const balances = useWalletBalances();
  const lpBalance = useBalance(poolId);
  const pool = usePool(pair.poolId);

  const [{ typedValue, independentField, inputType }, setState] = React.useState<{
    typedValue: string;
    independentField: Field;
    inputType: 'slider' | 'text';
  }>({
    typedValue: '',
    independentField: Field.CURRENCY_A,
    inputType: 'text',
  });
  const dependentField = independentField === Field.CURRENCY_A ? Field.CURRENCY_B : Field.CURRENCY_A;
  const price = independentField === Field.CURRENCY_A ? pool?.rate || ONE : pool?.inverseRate || ONE;
  //  calculate dependentField value
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const parsedAmount = {
    [independentField]: new BigNumber(typedValue || '0'),
    [dependentField]: new BigNumber(typedValue || '0').times(price),
  };

  const formattedAmounts = {
    [independentField]: typedValue,
    [dependentField]: parsedAmount[dependentField].isZero()
      ? '0'
      : formatBigNumber(parsedAmount[dependentField], 'input').toString(),
  };

  const handleFieldAInput = (value: string) => {
    setState({ independentField: Field.CURRENCY_A, typedValue: value, inputType: 'text' });
  };

  const handleFieldBInput = (value: string) => {
    setState({ independentField: Field.CURRENCY_B, typedValue: value, inputType: 'text' });
  };

  const rate1 = pool ? pool.base.div(pool.total) : ONE;
  const rate2 = pool ? pool.quote.div(pool.total) : ONE;

  const handleSlide = (values: string[], handle: number) => {
    let t = new BigNumber(values[handle]).times(rate1);
    if (t.isLessThanOrEqualTo(new BigNumber(0.01))) {
      t = lpBalance?.balance.times(rate1) || new BigNumber(0);
    }
    setState({ independentField: Field.CURRENCY_A, typedValue: formatBigNumber(t, 'input'), inputType: 'slider' });
  };

  const sliderInstance = React.useRef<any>(null);

  React.useEffect(() => {
    if (inputType === 'text') {
      const t = parsedAmount[Field.CURRENCY_A].div(rate1);
      sliderInstance.current.noUiSlider.set(formatBigNumber(t, 'input'));
    }
  }, [parsedAmount, rate1, sliderInstance, inputType]);

  const [open, setOpen] = React.useState(false);

  const toggleOpen = () => {
    setOpen(!open);
  };

  const { account } = useIconReact();
  const addTransaction = useTransactionAdder();

  const handleWithdraw = () => {
    if (!account) return;

    let t = new BigNumber(0);
    if (
      parsedAmount[Field.CURRENCY_A].isLessThanOrEqualTo(new BigNumber(0.01)) ||
      parsedAmount[Field.CURRENCY_B].isLessThanOrEqualTo(new BigNumber(0.01))
    ) {
      t = lpBalance?.balance || new BigNumber(0);
    } else {
      t = BigNumber.min(parsedAmount[Field.CURRENCY_A].div(rate1), lpBalance?.balance || ZERO);
    }

    const baseT = t.times(rate1);
    const quoteT = t.times(rate2);

    bnJs
      .inject({ account: account })
      .Dex.remove(pair.poolId, BalancedJs.utils.toLoop(t))
      .then(result => {
        addTransaction(
          { hash: result.result },
          {
            pending: withdrawMessage(
              formatBigNumber(baseT, 'currency'),
              pair.baseCurrencyKey,
              formatBigNumber(quoteT, 'currency'),
              pair.quoteCurrencyKey,
            ).pendingMessage,
            summary: withdrawMessage(
              formatBigNumber(baseT, 'currency'),
              pair.baseCurrencyKey,
              formatBigNumber(quoteT, 'currency'),
              pair.quoteCurrencyKey,
            ).successMessage,
          },
        );
        toggleOpen();
      })
      .catch(e => {
        console.error('error', e);
      });
  };

  const handleShowConfirm = () => {
    toggleOpen();
    onClose();
  };

  return (
    <>
      <Flex padding={5} bg="bg4" maxWidth={320} flexDirection="column">
        <Typography variant="h3" mb={3}>
          Withdraw:&nbsp;
          <Typography as="span">{pair.pair}</Typography>
        </Typography>
        <Box mb={3}>
          <CurrencyInputPanel
            value={formattedAmounts[Field.CURRENCY_A]}
            showMaxButton={false}
            currency={CURRENCY_LIST[pair.baseCurrencyKey.toLowerCase()]}
            onUserInput={handleFieldAInput}
            id="withdraw-liquidity-input"
            bg="bg5"
          />
        </Box>
        <Box mb={3}>
          <CurrencyInputPanel
            value={formattedAmounts[Field.CURRENCY_B]}
            showMaxButton={false}
            currency={CURRENCY_LIST[pair.quoteCurrencyKey.toLowerCase()]}
            onUserInput={handleFieldBInput}
            id="withdraw-liquidity-input"
            bg="bg5"
          />
        </Box>
        <Typography mb={5} textAlign="right">
          {`Wallet: ${formatBigNumber(balances[pair.baseCurrencyKey], 'currency')} ${pair.baseCurrencyKey}
          / ${formatBigNumber(balances[pair.quoteCurrencyKey], 'currency')} ${pair.quoteCurrencyKey}`}
        </Typography>
        <Box mb={5}>
          <Nouislider
            id="slider-supply"
            start={[0]}
            padding={[0]}
            connect={[true, false]}
            range={{
              min: [0],
              max: [parseFloat(formatBigNumber(lpBalance?.balance, 'input'))],
            }}
            onSlide={handleSlide}
            instanceRef={instance => {
              if (instance && !sliderInstance.current) {
                sliderInstance.current = instance;
              }
            }}
          />
        </Box>
        <Flex alignItems="center" justifyContent="center">
          <Button onClick={handleShowConfirm}>Withdraw liquidity</Button>
        </Flex>
      </Flex>

      <Modal isOpen={open} onDismiss={toggleOpen}>
        <Flex flexDirection="column" alignItems="stretch" m={5} width="100%">
          <Typography textAlign="center" mb={3} as="h3" fontWeight="normal">
            Withdraw liquidity?
          </Typography>

          <Typography variant="p" fontWeight="bold" textAlign="center">
            {formatBigNumber(parsedAmount[Field.CURRENCY_A], 'currency')} {pair.baseCurrencyKey}
          </Typography>

          <Typography variant="p" fontWeight="bold" textAlign="center">
            {formatBigNumber(parsedAmount[Field.CURRENCY_B], 'currency')} {pair.quoteCurrencyKey}
          </Typography>

          <Flex justifyContent="center" mt={4} pt={4} className="border-top">
            <TextButton onClick={toggleOpen}>Cancel</TextButton>
            <Button onClick={handleWithdraw}>Withdraw</Button>
          </Flex>
        </Flex>
      </Modal>
    </>
  );
};
