import React from 'react';

import { ExecuteResult } from '@cosmjs/cosmwasm-stargate';
import { t, Trans } from '@lingui/macro';
import { useIconReact } from 'packages/icon-react';
import { Flex } from 'rebass';

import { fetchTxResult, getICONEventSignature, getXCallOriginEventDataFromICON } from 'app/_xcall/_icon/utils';
import { useArchwayContext } from 'app/_xcall/archway/ArchwayProvider';
import { ARCHWAY_CONTRACTS } from 'app/_xcall/archway/config';
import { DestinationXCallData, OriginXCallData, SupportedXCallChains, XCallEvent } from 'app/_xcall/types';
import { getOriginEvent } from 'app/_xcall/utils';
import { Typography } from 'app/theme';
import bnJs from 'bnJs';
import { useChangeShouldLedgerSign } from 'store/application/hooks';
import { ICONTxEventLog } from 'store/transactions/actions';
import { useIsICONTxPending, useTransactionAdder } from 'store/transactions/hooks';
import {
  useAddTransactionResult,
  useArchwayTransactionsState,
  useInitTransaction,
} from 'store/transactionsCrosschain/hooks';
import {
  useAddOriginEvent,
  useRemoveEvent,
  useRollBackFromOrigin,
  useSetListeningTo,
  useXCallState,
} from 'store/xCall/hooks';
import { showMessageOnBeforeUnload } from 'utils/messages';

import { Button } from '../Button';
import Spinner from '../Spinner';

type XCallExecutionHandlerProps = {
  event: DestinationXCallData;
  xCallReset: () => void;
  clearInputs?: () => void;
  msgs: {
    txMsgs: {
      [key in SupportedXCallChains]: {
        pending: string;
        summary: string;
      };
    };
    managerMsgs: {
      [key in SupportedXCallChains]: {
        awaiting: string;
        actionRequired: string;
      };
    };
  };
};

const XCallExecutionHandlerICON = ({ event, msgs, clearInputs, xCallReset }: XCallExecutionHandlerProps) => {
  const xCallState = useXCallState();
  const { account } = useIconReact();
  const { signingClient, address: accountArch } = useArchwayContext();
  const addTransaction = useTransactionAdder();
  // const shouldLedgerSign = useShouldLedgerSign();
  const changeShouldLedgerSign = useChangeShouldLedgerSign();
  const removeEvent = useRemoveEvent();
  const addOriginEvent = useAddOriginEvent();
  const rollBackFromOrigin = useRollBackFromOrigin();
  const setListeningTo = useSetListeningTo();
  const isICONTxPending = useIsICONTxPending();
  const originEvent = React.useMemo(() => getOriginEvent(event.sn, xCallState), [event.sn, xCallState]);
  const addTransactionResult = useAddTransactionResult();
  const initTransaction = useInitTransaction();
  const { isTxPending } = useArchwayTransactionsState();

  const handleArchwayRollbackXCall = async (data: OriginXCallData) => {
    if (signingClient && accountArch) {
      const msg = {
        execute_rollback: {
          sequence_no: `${data.sn}`,
        },
      };

      try {
        initTransaction('archway', 'Executing rollback...');
        const res: ExecuteResult = await signingClient.execute(accountArch, ARCHWAY_CONTRACTS.xcall, msg, {
          amount: [{ amount: '1', denom: 'aconst' }],
          gas: '600000',
        });

        console.log('xCall debug - Archway rollbackCall complete', res);
        const rollbackExecuted = res.events.some(e => e.type === 'wasm-RollbackExecuted');

        if (rollbackExecuted) {
          removeEvent(data.sn, true);
          console.log('xCall debug - Archway rollbackCall - success');
          addTransactionResult('archway', res, 'Rollback executed');
          xCallReset();
        } else {
          console.log('xCall debug - Archway rollbackCall - fail');
          addTransactionResult('archway', res || null, t`Rollback failed.`);
        }
      } catch (e) {
        console.error(e);
        addTransactionResult('archway', null, t`Execution failed`);
      }
    }
  };

  const xCallSwapSuccessPredicate = (eventLogs: ICONTxEventLog[]) => {
    const callExecutedEvent = eventLogs.find(log =>
      log.indexed.includes(getICONEventSignature(XCallEvent.CallExecuted)),
    );
    return callExecutedEvent ? callExecutedEvent.data[0] === '0x1' : false;
  };

  const handleICONExecuteXCall = async (data: DestinationXCallData) => {
    if (account) {
      window.addEventListener('beforeunload', showMessageOnBeforeUnload);

      if (bnJs.contractSettings.ledgerSettings.actived) {
        changeShouldLedgerSign(true);
      }

      bnJs.inject({ account });
      const { result: hash } = await bnJs.XCall.executeCall(`0x${data.reqId.toString(16)}`, data.data);
      addTransaction(
        { hash },
        {
          pending: msgs.txMsgs.icon.pending,
          summary: msgs.txMsgs.icon.summary,
          isTxSuccessfulBasedOnEvents: xCallSwapSuccessPredicate,
        },
      );
      const txResult = await fetchTxResult(hash);
      if (txResult?.status === 1 && txResult.eventLogs.length) {
        // looking for CallExecuted event
        // then set listener to ResponseMessage / RollbackMessage
        const callExecutedEvent = txResult.eventLogs.find(event =>
          event.indexed.includes(getICONEventSignature(XCallEvent.CallExecuted)),
        );
        console.log('xCall debug - ICON executeCall tx result: ', txResult);

        if (callExecutedEvent?.data[0] === '0x1') {
          console.log('xCall debug - xCall executed successfully');
          const sn = xCallState.events['icon'].destination.find(event => event.reqId === data.reqId)?.sn;
          sn && removeEvent(sn, true);

          clearInputs && clearInputs();
          //has xCall emitted CallMessageSent event?
          const callMessageSentEvent = txResult.eventLogs.find(event =>
            event.indexed.includes(getICONEventSignature(XCallEvent.CallMessageSent)),
          );

          if (callMessageSentEvent) {
            console.log('xCall debug - CallMessageSent event detected', callMessageSentEvent);
            const originEventData = getXCallOriginEventDataFromICON(
              callMessageSentEvent,
              'todo event manager',
              'todo event manager',
            );
            originEventData && addOriginEvent('icon', originEventData);
          } else {
            xCallReset();
          }
        }

        if (callExecutedEvent?.data[0] === '0x0') {
          console.log('xCall debug - xCall executed with error');
          if (callExecutedEvent?.data[1].toLocaleLowerCase().includes('revert')) {
            rollBackFromOrigin(data.origin, data.sn);
            console.log('xCall debug - xCALL rollback needed');
            setListeningTo('archway', XCallEvent.RollbackMessage);
          }
        }
      }
      window.removeEventListener('beforeunload', showMessageOnBeforeUnload);
      changeShouldLedgerSign(false);
    }
  };

  if (originEvent && !originEvent.rollbackRequired) {
    return (
      <>
        <Typography mb={4}>
          <Trans>{msgs.managerMsgs.icon.actionRequired}</Trans>
        </Typography>
        <Flex alignItems="center" key={event.reqId}>
          <Button onClick={() => handleICONExecuteXCall(event)} disabled={isICONTxPending}>
            {isICONTxPending ? <Trans>Confirming...</Trans> : <Trans>Confirm</Trans>}
          </Button>
        </Flex>
      </>
    );
  }

  if (originEvent && originEvent.rollbackRequired && !originEvent.rollbackReady) {
    return (
      <>
        <Typography mb={4}>
          <Trans>Transaction failed, awaiting rollback activation.</Trans>
        </Typography>
        <Flex alignItems="center">
          <Spinner />
        </Flex>
      </>
    );
  }

  if (originEvent && originEvent.rollbackRequired && originEvent.rollbackReady) {
    return (
      <>
        <Typography mb={4}>
          <Trans>Execute rollback</Trans>
        </Typography>
        <Flex alignItems="center">
          <Button onClick={() => handleArchwayRollbackXCall(originEvent)} disabled={false}>
            {isTxPending ? <Trans>Executing...</Trans> : <Trans>Execute</Trans>}
          </Button>
        </Flex>
      </>
    );
  }

  return null;
};

export default XCallExecutionHandlerICON;
