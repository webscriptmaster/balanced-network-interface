import bnJs from 'bnJs';
import IconService, { Converter, BigNumber } from 'icon-sdk-js';
import { Percent, Token } from '@balancednetwork/sdk-core';

import { showMessageOnBeforeUnload } from 'utils/messages';
import { toDec } from 'utils';
import { NETWORK_ID } from 'constants/config';

import { CROSS_TRANSFER_TOKENS } from 'app/pages/trade/bridge-v2/_config/xTokens';
import { XCallEventType, XChainId } from 'app/pages/trade/bridge-v2/types';
import { BridgeInfo, Transaction, TransactionStatus, XCallEvent, XCallEventMap } from '../_zustand/types';
import { fetchTxResult } from 'app/_xcall/_icon/utils';
import { XCallService } from './types';

export const getICONEventSignature = (eventName: XCallEventType) => {
  switch (eventName) {
    case XCallEventType.CallMessage: {
      return 'CallMessage(str,str,int,int,bytes)';
    }
    case XCallEventType.CallExecuted: {
      return 'CallExecuted(int,int,str)';
    }
    case XCallEventType.CallMessageSent: {
      return 'CallMessageSent(Address,str,int)';
    }
    case XCallEventType.ResponseMessage: {
      return 'ResponseMessage(int,int,str)';
    }
    case XCallEventType.RollbackMessage: {
      return 'RollbackMessage(int)';
    }
    default:
      return 'none';
  }
};

export class IconXCallService implements XCallService {
  xChainId: XChainId;
  publicClient: IconService;
  walletClient: IconService; // reserved for future use
  changeShouldLedgerSign: any;

  constructor(xChainId: XChainId, serviceConfig: any) {
    const { publicClient, walletClient, changeShouldLedgerSign } = serviceConfig;
    this.xChainId = xChainId;
    this.publicClient = publicClient;
    this.walletClient = walletClient;
    this.changeShouldLedgerSign = changeShouldLedgerSign;
  }

  async fetchXCallFee(to: XChainId, rollback: boolean) {
    return Promise.resolve({
      rollback: 0n,
      noRollback: 0n,
    });
  }
  async fetchBlockHeight() {
    const lastBlock = await this.publicClient.getLastBlock().execute();
    return BigInt(lastBlock.height);
  }
  async getBlock(blockHeight: bigint) {
    const block = await this.publicClient.getBlockByHeight(new BigNumber(blockHeight.toString())).execute();
    return block;
  }

  async getTx(txHash: string) {
    //TODO: update to use this.publicClient
    return await fetchTxResult(txHash);
  }

  deriveTxStatus(rawTx): TransactionStatus {
    if (rawTx) {
      const status = Converter.toNumber(rawTx.status);
      if (status === 1) {
        return TransactionStatus.success;
      } else {
        return TransactionStatus.failure;
      }
    }
    return TransactionStatus.pending;
  }

  filterEventLog(eventLogs, sig, address = null) {
    const result = eventLogs.find(event => {
      return event.indexed && event.indexed[0] === sig && (!address || address === event.scoreAddress);
    });

    return result;
  }

  filterCallMessageSentEventLog(eventLogs) {
    const signature = getICONEventSignature(XCallEventType.CallMessageSent);
    return eventLogs.find(event => event.indexed.includes(signature));
  }

  filterCallMessageEventLog(eventLogs) {
    const signature = getICONEventSignature(XCallEventType.CallMessage);
    return this.filterEventLog(eventLogs, signature);
  }

  filterCallExecutedEventLog(eventLogs) {
    const signature = getICONEventSignature(XCallEventType.CallExecuted);
    return this.filterEventLog(eventLogs, signature);
  }

  parseCallMessageSentEventLog(eventLog): XCallEvent {
    const sn = parseInt(eventLog.indexed[3], 16);

    return {
      eventType: XCallEventType.CallMessageSent,
      sn: BigInt(sn),
      xChainId: this.xChainId,
      rawEventData: eventLog,
    };
  }
  parseCallMessageEventLog(eventLog): XCallEvent {
    const sn = parseInt(eventLog.indexed[3], 16);
    const reqId = parseInt(eventLog.data[0], 16);

    return {
      eventType: XCallEventType.CallMessage,
      sn: BigInt(sn),
      reqId: BigInt(reqId),
      xChainId: this.xChainId,
      rawEventData: eventLog,
    };
  }
  parseCallExecutedEventLog(eventLog): XCallEvent {
    const reqId = parseInt(eventLog.indexed[1], 16);
    // TODO: check for success?
    // const success = eventLog.data[0] === '0x1';

    return {
      eventType: XCallEventType.CallExecuted,
      sn: -1n,
      reqId: BigInt(reqId),
      xChainId: this.xChainId,
      rawEventData: eventLog,
    };
  }

  async fetchSourceEvents(sourceTransaction: Transaction): Promise<XCallEventMap> {
    const rawTx = sourceTransaction.rawTx;

    const callMessageSentLog = this.filterCallMessageSentEventLog(rawTx?.eventLogs || []);
    if (callMessageSentLog) {
      return {
        [XCallEventType.CallMessageSent]: this.parseCallMessageSentEventLog(callMessageSentLog),
      };
    }

    return {};
  }

  async fetchDestinationEventsByBlock(blockHeight: bigint) {
    const events: any = [];

    const block = await this.getBlock(blockHeight);

    if (block && block.confirmedTransactionList && block.confirmedTransactionList.length > 0) {
      for (const tx of block.confirmedTransactionList) {
        const txResult = await this.getTx(tx.txHash);

        const callMessageEventLog = this.filterCallMessageEventLog(txResult?.eventLogs || []);
        const callExecutedEventLog = this.filterCallExecutedEventLog(txResult?.eventLogs || []);

        if (callMessageEventLog) {
          events.push(this.parseCallMessageEventLog(callMessageEventLog));
        }
        if (callExecutedEventLog) {
          events.push(this.parseCallExecutedEventLog(callExecutedEventLog));
        }
      }
    } else {
      return null;
    }
    return events;
  }

  async approve(token, owner, spender, currencyAmountToApprove) {}

  async executeTransfer(bridgeInfo: BridgeInfo) {
    const {
      bridgeDirection,
      currencyAmountToBridge,
      recipient: destinationAddress,
      account,
      xCallFee,
      isLiquidFinanceEnabled,
    } = bridgeInfo;

    if (account && xCallFee) {
      window.addEventListener('beforeunload', showMessageOnBeforeUnload);

      if (bnJs.contractSettings.ledgerSettings.actived && this.changeShouldLedgerSign) {
        this.changeShouldLedgerSign(true);
      }

      const tokenAddress = currencyAmountToBridge.wrapped.currency.address;
      const destination = `${bridgeDirection.to}/${destinationAddress}`;

      let txResult;
      if (CROSS_TRANSFER_TOKENS.includes(currencyAmountToBridge.currency.symbol)) {
        const cx = bnJs.inject({ account }).getContract(tokenAddress);
        txResult = await cx.crossTransfer(
          destination,
          `${currencyAmountToBridge.quotient}`,
          xCallFee.rollback.toString(),
        );
      } else {
        txResult = await bnJs
          .inject({ account })
          .AssetManager[isLiquidFinanceEnabled ? 'withdrawNativeTo' : 'withdrawTo'](
            `${currencyAmountToBridge.quotient}`,
            tokenAddress,
            destination,
            xCallFee.rollback.toString(),
          );
      }

      const { result: hash } = txResult || {};

      if (hash) {
        return hash;
      }
    }
  }

  async executeSwap(swapInfo: any) {
    const { executionTrade, account, receivingNetworkAddress, slippageTolerance } = swapInfo;
    const minReceived = executionTrade.minimumAmountOut(new Percent(slippageTolerance, 10_000));

    window.addEventListener('beforeunload', showMessageOnBeforeUnload);
    if (bnJs.contractSettings.ledgerSettings.actived && this.changeShouldLedgerSign) {
      this.changeShouldLedgerSign(true);
    }

    let txResult;
    if (executionTrade.inputAmount.currency.symbol === 'ICX') {
      txResult = await bnJs
        .inject({ account })
        .Router.swapICX(
          toDec(executionTrade.inputAmount),
          executionTrade.route.pathForSwap,
          NETWORK_ID === 1 ? toDec(minReceived) : '0x0',
          receivingNetworkAddress,
        );
    } else {
      const token = executionTrade.inputAmount.currency as Token;
      const outputToken = executionTrade.outputAmount.currency as Token;

      const cx = bnJs.inject({ account }).getContract(token.address);

      txResult = await cx.swapUsingRoute(
        toDec(executionTrade.inputAmount),
        outputToken.address,
        toDec(minReceived),
        executionTrade.route.pathForSwap,
        receivingNetworkAddress,
      );
    }

    const { result: hash } = txResult || {};
    if (hash) {
      return hash;
    }
  }
}
