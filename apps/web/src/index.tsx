// import 'react-app-polyfill/ie11';
// import 'react-app-polyfill/stable';

import React from 'react';
import ReactDOM from 'react-dom/client';

import BigNumber from 'bignumber.js';
import { IconReactProvider } from 'packages/icon-react';
import { HelmetProvider } from 'react-helmet-async';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';

import * as serviceWorker from 'serviceWorker';

// Use consistent styling
import 'sanitize.css/sanitize.css';

// Import root app
import { App } from 'app';
import { ArchwayProvider } from 'packages/archway/ArchwayProvider';
import store from 'store';

// Initialize languages
import { LanguageProvider } from './i18n';

import { WagmiProvider } from 'wagmi';
import { wagmiConfig } from './config/wagmi';
import { HavahProvider } from 'packages/havah/HavahProvider';

BigInt.prototype['toJSON'] = function () {
  return 'BIGINT::' + this.toString();
};

const queryClient = new QueryClient();
// Set the global formatting options
const fmt = {
  prefix: '',
  decimalSeparator: '.',
  groupSeparator: ',',
  groupSize: 3,
  secondaryGroupSize: 0,
  fractionGroupSeparator: ' ',
  fractionGroupSize: 0,
  suffix: '',
};

BigNumber.config({ FORMAT: fmt, ROUNDING_MODE: BigNumber.ROUND_DOWN });
BigNumber.set({ ROUNDING_MODE: BigNumber.ROUND_DOWN }); // equivalent

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <HelmetProvider>
          <WagmiProvider config={wagmiConfig}>
            <QueryClientProvider client={queryClient}>
              <IconReactProvider>
                <ArchwayProvider>
                  <HavahProvider>
                    <LanguageProvider>
                      <App />
                    </LanguageProvider>
                  </HavahProvider>
                </ArchwayProvider>
              </IconReactProvider>
            </QueryClientProvider>
          </WagmiProvider>
        </HelmetProvider>
      </BrowserRouter>
    </Provider>
  </React.StrictMode>,
);

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
serviceWorker.unregister();
