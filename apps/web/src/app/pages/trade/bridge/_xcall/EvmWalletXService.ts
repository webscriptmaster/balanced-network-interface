import bnJs from 'bnJs';
import { Address, PublicClient, WalletClient, WriteContractParameters, bytesToHex, toHex } from 'viem';
import { Percent } from '@balancednetwork/sdk-core';

import { XChainId } from 'app/pages/trade/bridge/types';
import { xChainMap } from 'app/pages/trade/bridge/_config/xChains';
import { NATIVE_ADDRESS } from 'constants/index';
import { ICON_XCALL_NETWORK_ID } from 'constants/config';

import { getBytesFromAddress, getBytesFromNumber, getRlpEncodedMsg } from 'app/pages/trade/bridge/utils';

import { XTransactionInput } from '../_zustand/types';
import { IWalletXService } from './types';
import { assetManagerContractAbi } from './abis/assetManagerContractAbi';
import { bnUSDContractAbi } from './abis/bnUSDContractAbi';
import { EvmPublicXService } from './EvmPublicXService';
import { uintToBytes } from 'utils';

export class EvmWalletXService extends EvmPublicXService implements IWalletXService {
  walletClient: WalletClient;

  constructor(xChainId: XChainId, publicClient: PublicClient, walletClient: WalletClient, options?: any) {
    super(xChainId, publicClient);
    this.walletClient = walletClient;
  }

  async approve(token, owner, spender, currencyAmountToApprove) {}

  async executeTransfer(xTransactionInput: XTransactionInput) {
    const { direction, inputAmount, recipient: destinationAddress, account, xCallFee } = xTransactionInput;

    if (this.walletClient) {
      const tokenAddress = inputAmount.wrapped.currency.address;
      const destination = `${direction.to}/${destinationAddress}`;
      const amount = BigInt(inputAmount.quotient.toString());

      // check if the bridge asset is native
      const isNative = inputAmount.currency.wrapped.address === NATIVE_ADDRESS;
      const isBnUSD = inputAmount.currency.symbol === 'bnUSD';

      let request: WriteContractParameters;
      if (isBnUSD) {
        const res = await this.publicClient.simulateContract({
          account: account as Address,
          address: xChainMap[this.xChainId].contracts.bnUSD as Address,
          abi: bnUSDContractAbi,
          functionName: 'crossTransfer',
          args: [destination, amount, '0x'],
          value: xCallFee.rollback,
        });
        request = res.request;
      } else {
        if (!isNative) {
          const res = await this.publicClient.simulateContract({
            account: account as Address,
            address: xChainMap[this.xChainId].contracts.assetManager as Address,
            abi: assetManagerContractAbi,
            functionName: 'deposit',
            args: [tokenAddress as Address, amount, destination],
            value: xCallFee.rollback,
          });
          request = res.request;
        } else {
          const res = await this.publicClient.simulateContract({
            account: account as Address,
            address: xChainMap[this.xChainId].contracts.assetManager as Address,
            abi: assetManagerContractAbi,
            functionName: 'depositNative',
            args: [amount, destination, '0x'],
            value: xCallFee.rollback + amount,
          });
          request = res.request;
        }
      }
      const hash = await this.walletClient.writeContract(request);

      if (hash) {
        return hash;
      }
    }
  }

  async executeSwap(xTransactionInput: XTransactionInput) {
    const { direction, inputAmount, executionTrade, account, recipient, xCallFee, slippageTolerance } =
      xTransactionInput;

    if (!executionTrade || !slippageTolerance) {
      return;
    }

    const minReceived = executionTrade.minimumAmountOut(new Percent(slippageTolerance, 10_000));

    if (this.walletClient) {
      const receiver = `${direction.to}/${recipient}`;

      const tokenAddress = inputAmount.wrapped.currency.address;
      const amount = BigInt(inputAmount.quotient.toString());
      const destination = `${ICON_XCALL_NETWORK_ID}/${bnJs.Router.address}`;
      // const data = toHex(
      //   JSON.stringify({
      //     method: '_swap',
      //     params: {
      //       path: executionTrade.route.pathForSwap,
      //       receiver: receiver,
      //       minimumReceive: minReceived.quotient.toString(),
      //     },
      //   }),
      // );

      const rlpEncodedData = Buffer.from(
        getRlpEncodedMsg([
          Buffer.from('_swap', 'utf-8'),
          // @ts-ignore
          Buffer.from(receiver, 'utf-8'),
          uintToBytes(minReceived.quotient),
          ...executionTrade.route.routeActionPath.map(action => [
            getBytesFromNumber(action.type),
            getBytesFromAddress(action.address),
          ]),
        ]),
      ).toString('hex');
      console.log('rlpEncodedData', rlpEncodedData);
      // check if the bridge asset is native
      const isNative = inputAmount.currency.wrapped.address === NATIVE_ADDRESS;
      const isBnUSD = inputAmount.currency.symbol === 'bnUSD';

      let request: WriteContractParameters;
      if (isBnUSD) {
        console.log('CCC');
        const res = await this.publicClient.simulateContract({
          account: account as Address,
          address: xChainMap[this.xChainId].contracts.bnUSD as Address,
          abi: bnUSDContractAbi,
          functionName: 'crossTransfer',
          args: [destination, amount, `0x${rlpEncodedData}`],
          value: xCallFee.rollback,
        });
        request = res.request;
      } else {
        if (!isNative) {
          const res = await this.publicClient.simulateContract({
            account: account as Address,
            address: xChainMap[this.xChainId].contracts.assetManager as Address,
            abi: assetManagerContractAbi,
            functionName: 'deposit',
            args: [tokenAddress as Address, amount, destination, `0x${rlpEncodedData}`],
            value: xCallFee.rollback,
          });
          request = res.request;
        } else {
          const res = await this.publicClient.simulateContract({
            account: account as Address,
            address: xChainMap[this.xChainId].contracts.assetManager as Address,
            abi: assetManagerContractAbi,
            functionName: 'depositNative',
            args: [amount, destination, `0x${rlpEncodedData}`],
            value: xCallFee.rollback + amount,
          });
          request = res.request;
        }
      }
      const hash = await this.walletClient.writeContract(request);

      if (hash) {
        return hash;
      }
    }
  }
}
