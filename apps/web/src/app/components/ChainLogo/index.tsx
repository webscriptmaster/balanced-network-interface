import React from 'react';

import { XChain } from '../../pages/trade/bridge/types';

export const ChainLogo = ({ chain, size = '24px' }: { chain: XChain; size?: string }) => {
  return (
    <img
      width={size || 50}
      height={size || 50}
      src={`/icons/chains/${chain.xChainId}.svg`}
      srcSet=""
      alt={chain.name}
    />
  );
};
