import React from 'react';

import { Currency, Percent, Token, TradeType } from '@balancednetwork/sdk-core';
import { Trade } from '@balancednetwork/v1-sdk';
import { ExecuteResult } from '@cosmjs/cosmwasm-stargate';
import { Trans } from '@lingui/macro';
import BigNumber from 'bignumber.js';
import { useIconReact } from 'packages/icon-react';
import { Box, Flex } from 'rebass';
import styled from 'styled-components';

import { ICON_XCALL_NETWORK_ID } from 'app/_xcall/_icon/config';
import { fetchTxResult, getICONEventSignature, getXCallOriginEventDataFromICON } from 'app/_xcall/_icon/utils';
import { useArchwayContext } from 'app/_xcall/archway/ArchwayProvider';
import { getXCallOriginEventDataFromArchway } from 'app/_xcall/archway/ArchwayTest/helpers';
import { ARCHWAY_CONTRACTS } from 'app/_xcall/archway/config';
import { useArchwayTxManager } from 'app/_xcall/archway/txManager';
import { SupportedXCallChains, XCallEvent } from 'app/_xcall/types';
import { getBytesFromString } from 'app/_xcall/utils';
import { Typography } from 'app/theme';
import bnJs from 'bnJs';
import { NETWORK_ID } from 'constants/config';
import { ARCHWAY_SUPPORTED_TOKENS_LIST } from 'constants/tokens';
import { useChangeShouldLedgerSign, useShouldLedgerSign, useSwapSlippageTolerance } from 'store/application/hooks';
import { Field } from 'store/swap/actions';
import { useTransactionAdder } from 'store/transactions/hooks';
import { useAddOriginEvent, useStopListening } from 'store/xCall/hooks';
import { formatBigNumber, toDec } from 'utils';
import { showMessageOnBeforeUnload } from 'utils/messages';

import { Button, TextButton } from '../Button';
import Modal from '../Modal';
import { ModalContentWrapper } from '../ModalContent';
import Spinner from '../Spinner';
import { swapMessage } from './utils';
import XCallEventManager from './XCallEventManager';

type XCallSwapModalProps = {
  isOpen: boolean;
  currencies: { [field in Field]?: Currency };
  executionTrade?: Trade<Currency, Currency, TradeType>;
  clearInputs: () => void;
  originChain: SupportedXCallChains;
  destinationChain: SupportedXCallChains;
  destinationAddress?: string;
  onClose: () => void;
};

const StyledButton = styled(Button)`
  position: relative;

  :after,
  :before {
    content: '';
    position: absolute;
    width: 0;
    height: 2px;
    left: 0;
    border-radius: 5px;
    background: ${({ theme }) => theme.colors.primaryBright};
  }

  &:after {
    bottom: 0;
  }

  :before {
    top: 0;
  }

  @keyframes expand {
    0% {
      width: 0;
      left: 50%;
      opacity: 0;
    }
    50% {
      width: 28%;
      left: 36%;
      opacity: 1;
    }
    100% {
      width: 100%;
      left: 0%;
      opacity: 0;
    }
  }

  &:disabled {
    :after {
      animation: expand 2s infinite;
    }
  }
`;

const XCallSwapModal = ({
  isOpen,
  currencies,
  executionTrade,
  originChain,
  destinationChain,
  destinationAddress,
  clearInputs,
  onClose,
}: XCallSwapModalProps) => {
  const { account } = useIconReact();
  const { address: accountArch, signingCosmWasmClient } = useArchwayContext();
  const shouldLedgerSign = useShouldLedgerSign();
  const changeShouldLedgerSign = useChangeShouldLedgerSign();
  const [modalClosable, setModalClosable] = React.useState(true);
  const [xCallInProgress, setXCallInProgress] = React.useState(false);
  const slippageTolerance = useSwapSlippageTolerance();
  const addTransaction = useTransactionAdder();
  // const iconDestinationEvents = useXCallDestinationEvents('icon');
  // const archwayOriginEvents = useXCallOriginEvents('archway');
  const addOriginEvent = useAddOriginEvent();
  // const listeningTo = useXCallListeningTo();
  const stopListening = useStopListening();
  const archTxManager = useArchwayTxManager();

  const xCallReset = React.useCallback(() => {
    stopListening();
    setXCallInProgress(false);
    setModalClosable(true);
    onClose();
  }, [onClose, stopListening]);

  const controlledClose = React.useCallback(() => {
    if (modalClosable && !xCallInProgress) {
      xCallReset();
    }
  }, [modalClosable, xCallInProgress, xCallReset]);

  const receivingNetworkAddress: string | undefined = React.useMemo(() => {
    if (destinationAddress) {
      if (destinationChain === 'icon') {
        return `${ICON_XCALL_NETWORK_ID}/${destinationAddress}`;
      }
      if (destinationChain === 'archway') {
        return `archway/${destinationAddress}`;
      }
    }
  }, [destinationChain, destinationAddress]);

  const getArchwayToken = (symbol?: string) => {
    if (symbol) {
      return ARCHWAY_SUPPORTED_TOKENS_LIST.find(token => token.symbol === symbol);
    }
  };

  const cleanupSwap = () => {
    clearInputs();
    window.removeEventListener('beforeunload', showMessageOnBeforeUnload);
    changeShouldLedgerSign(false);
  };

  const eventManagerMessages = React.useMemo(() => {
    const messages = {
      icon: {
        awaiting: '',
        actionRequired: '',
      },
      archway: {
        awaiting: '',
        actionRequired: '',
      },
    };

    return messages;
  }, []);

  const handleICONTxResult = async (hash: string) => {
    const txResult = await fetchTxResult(hash);
    console.log('ICON tx - ', txResult);
    if (txResult?.status === 1 && txResult.eventLogs.length) {
      const callMessageSentEvent = txResult.eventLogs.find(event =>
        event.indexed.includes(getICONEventSignature(XCallEvent.CallMessageSent)),
      );

      if (callMessageSentEvent) {
        console.log('CallMessageSent event detected');
        console.log(callMessageSentEvent);
        const originEventData = getXCallOriginEventDataFromICON(callMessageSentEvent);
        originEventData && addOriginEvent('icon', originEventData);
      }
    }
  };

  const handleXCallSwap = async () => {
    if (!executionTrade) {
      return;
    }

    window.addEventListener('beforeunload', showMessageOnBeforeUnload);

    const swapMessages = swapMessage(
      executionTrade.inputAmount.toFixed(2),
      executionTrade.inputAmount.currency.symbol || 'IN',
      executionTrade.outputAmount.toFixed(2),
      executionTrade.outputAmount.currency.symbol || 'OUT',
    );

    const minReceived = executionTrade.minimumAmountOut(new Percent(slippageTolerance, 10_000));

    if (originChain === 'icon') {
      if (bnJs.contractSettings.ledgerSettings.actived) {
        changeShouldLedgerSign(true);
      }
      if (executionTrade.inputAmount.currency.symbol === 'ICX') {
        const { result: hash } = await bnJs
          .inject({ account })
          .Router.swapICX(
            toDec(executionTrade.inputAmount),
            executionTrade.route.pathForSwap,
            NETWORK_ID === 1 ? toDec(minReceived) : '0x0',
            receivingNetworkAddress,
          );
        if (hash) {
          setXCallInProgress(true);
          addTransaction(
            { hash },
            {
              pending: swapMessages.pendingMessage,
              summary: swapMessages.successMessage,
            },
          );
          await handleICONTxResult(hash);
        }
        cleanupSwap();
      } else {
        const token = executionTrade.inputAmount.currency as Token;
        const outputToken = executionTrade.outputAmount.currency as Token;

        const cx = bnJs.inject({ account }).getContract(token.address);

        const { result: hash } = await cx.swapUsingRoute(
          toDec(executionTrade.inputAmount),
          outputToken.address,
          toDec(minReceived),
          executionTrade.route.pathForSwap,
          receivingNetworkAddress,
        );

        if (hash) {
          addTransaction(
            { hash },
            {
              pending: swapMessages.pendingMessage,
              summary: swapMessages.successMessage,
            },
          );
          await handleICONTxResult(hash);
        }
        cleanupSwap();
      }
    } else if (originChain === 'archway') {
      const archToken = getArchwayToken(executionTrade.inputAmount.currency.symbol);
      if (!archToken || !(signingCosmWasmClient && accountArch)) {
        return;
      }
      // const allowanceRes = await handleAllowance();
      const swapParams = {
        path: executionTrade.route.pathForSwap,
        ...(receivingNetworkAddress && { receiver: receivingNetworkAddress }),
      };

      archTxManager.initTransaction('Sending swap request to ICON network.');
      setXCallInProgress(true);
      //handle icon native tokens vs spoke assets
      if (['bnUSD'].includes(archToken.symbol!)) {
        const msg = {
          cross_transfer: {
            amount: executionTrade.inputAmount.quotient.toString(),
            to: `${ICON_XCALL_NETWORK_ID}/${bnJs.Router.address}`,
            data: getBytesFromString(
              JSON.stringify({
                method: '_swap',
                params: swapParams,
              }),
            ),
          },
        };

        const fee = await signingCosmWasmClient.queryContractSmart(ARCHWAY_CONTRACTS.xcall, {
          get_fee: { nid: `${ICON_XCALL_NETWORK_ID}`, rollback: true },
        });

        try {
          const res: ExecuteResult = await signingCosmWasmClient.execute(
            accountArch,
            ARCHWAY_CONTRACTS.bnusd,
            msg,
            'auto',
            undefined,
            [{ amount: fee, denom: 'aconst' }],
          );
          console.log(res);

          const originEventData = getXCallOriginEventDataFromArchway(res.events);
          archTxManager.addTransactionResult(res, 'Swap request sent');
          originEventData && addOriginEvent('archway', originEventData);
        } catch (e) {
          console.error(e);
          archTxManager.addTransactionResult(null, 'Swap request failed');
          setXCallInProgress(false);
        }
      } else {
        const msg = {
          deposit: {
            token_address: archToken.address,
            amount: executionTrade.inputAmount.quotient.toString(),
            to: `${ICON_XCALL_NETWORK_ID}/${bnJs.Router.address}`,
            data: getBytesFromString(
              JSON.stringify({
                method: '_swap',
                params: swapParams,
              }),
            ),
          },
        };

        const fee = await signingCosmWasmClient.queryContractSmart(ARCHWAY_CONTRACTS.xcall, {
          get_fee: { nid: `${ICON_XCALL_NETWORK_ID}`, rollback: true },
        });

        try {
          const res: ExecuteResult = await signingCosmWasmClient.execute(
            accountArch,
            ARCHWAY_CONTRACTS.assetManager,
            msg,
            'auto',
            undefined,
            [{ amount: fee, denom: 'aconst' }],
          );
          console.log(res);
          archTxManager.addTransactionResult(res, 'Swap request sent');
          setXCallInProgress(true);
          const originEventData = getXCallOriginEventDataFromArchway(res.events);
          originEventData && addOriginEvent('archway', originEventData);
        } catch (e) {
          console.error(e);
          archTxManager.addTransactionResult(null, 'Swap request failed');
          setXCallInProgress(false);
        }
      }
    }
  };

  return (
    <Modal isOpen={isOpen} onDismiss={controlledClose}>
      <ModalContentWrapper>
        <Typography textAlign="center" mb="5px" as="h3" fontWeight="normal">
          <Trans>
            xCall Swap {currencies[Field.INPUT]?.symbol} for {currencies[Field.OUTPUT]?.symbol}?
          </Trans>
        </Typography>

        <Typography variant="p" fontWeight="bold" textAlign="center">
          <Trans>
            {`${formatBigNumber(new BigNumber(executionTrade?.executionPrice.toFixed() || 0), 'ratio')} ${
              executionTrade?.executionPrice.quoteCurrency.symbol
            } 
              per ${executionTrade?.executionPrice.baseCurrency.symbol}`}
          </Trans>
        </Typography>

        <Flex my={4}>
          <Box width={1 / 2} className="border-right">
            <Typography textAlign="center">
              <Trans>Pay</Trans>
            </Typography>
            <Typography variant="p" textAlign="center">
              {formatBigNumber(new BigNumber(executionTrade?.inputAmount.toFixed() || 0), 'currency')}{' '}
              {currencies[Field.INPUT]?.symbol}
            </Typography>
          </Box>

          <Box width={1 / 2}>
            <Typography textAlign="center">
              <Trans>Receive</Trans>
            </Typography>
            <Typography variant="p" textAlign="center">
              {formatBigNumber(new BigNumber(executionTrade?.outputAmount.toFixed() || 0), 'currency')}{' '}
              {currencies[Field.OUTPUT]?.symbol}
            </Typography>
          </Box>
        </Flex>

        <Typography
          textAlign="center"
          hidden={currencies[Field.INPUT]?.symbol === 'ICX' && currencies[Field.OUTPUT]?.symbol === 'sICX'}
        >
          <Trans>
            Includes a fee of {formatBigNumber(new BigNumber(executionTrade?.fee.toFixed() || 0), 'currency')}{' '}
            {currencies[Field.INPUT]?.symbol}.
          </Trans>
        </Typography>

        <XCallEventManager xCallReset={xCallReset} executionTrade={executionTrade} msgs={eventManagerMessages} />

        <Flex justifyContent="center" mt={4} pt={4} className="border-top">
          {shouldLedgerSign && <Spinner></Spinner>}
          {!shouldLedgerSign && (
            <>
              <TextButton
                onClick={() => {
                  stopListening();
                  setXCallInProgress(false);
                  onClose();
                }}
              >
                <Trans>Cancel</Trans>
              </TextButton>
              <StyledButton onClick={handleXCallSwap} disabled={xCallInProgress}>
                {!xCallInProgress ? <Trans>Swap</Trans> : <Trans>xCall in progress</Trans>}
              </StyledButton>
            </>
          )}
        </Flex>
      </ModalContentWrapper>
    </Modal>
  );
};

export default XCallSwapModal;
