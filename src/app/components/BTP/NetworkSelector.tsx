import React, { useState } from 'react';

import { motion, AnimatePresence } from 'framer-motion';
import ClickAwayListener from 'react-click-away-listener';
import { Box, Flex } from 'rebass/styled-components';
import styled, { css } from 'styled-components';

import { Typography } from 'app/theme';
import { ReactComponent as ArrowDown } from 'assets/icons/arrow-down.svg';

interface NetworkSelectorProps {
  label?: string;
  data: string[];
}

export const Label = styled(Typography)`
  margin-bottom: 10px;
`;

const Select = styled(Flex)`
  position: relative;
`;

const StyledArrowDown = styled(ArrowDown)`
  width: 10px;
  margin-left: 6px;
  margin-top: 5px;
`;

const Selected = styled(Flex)`
  line-height: 18px;
  font-weight: 700;
  color: #ffffff;
  padding: 3px 20px;
  height: 40px;
  align-items: center;
  border-radius: 10px;
  cursor: pointer;
  transition: all ease 0.3s;
  width: 100%;
  font-size: 14px;

  ${({ theme }) => css`
    background: ${theme.colors.bg5};
    border: 2px solid ${theme.colors.bg5};

    &:hover {
      border: 2px solid ${theme.colors.primary};
    }
  `};
`;

const SelectItems = styled(motion(Flex))`
  width: 100%;
  position: absolute;
  top: 100%;
  left: 0;
  width: 100%;
  border-radius: 10px;
  flex-direction: column;
  margin-top: 5px;
  z-index: 5;

  ${({ theme }) => css`
    background-color: ${theme.colors.bg2};
    border: 2px solid ${theme.colors.primary};

    &:after {
      content: '';
      width: 0;
      height: 0;
      border-left: 9px solid transparent;
      border-right: 9px solid transparent;
      border-bottom: 9px solid ${theme.colors.primary};
      display: inline-block;
      position: absolute;
      bottom: 100%;
      right: 20px;
    }
  `};
`;

const SelectItem = styled(Box)`
  cursor: pointer;
  padding: 10px 15px;
  font-size: 14px;
  color: #ffffff;
  transition: all ease 0.3s;

  ${({ theme }) => css`
    &:hover {
      background-color: ${theme.colors.primary};
    }
  `}

  &:first-of-type {
    border-radius: 5px 5px 0 0;
  }

  &:last-of-type {
    border-radius: 0 0 5px 5px;
  }
`;

const NetworkSelector = ({ label, data }: NetworkSelectorProps) => {
  const [showItems, setShowItems] = useState(false);
  const [selectNetwork, setSelectNetwork] = useState(data[0]);
  const toggleDropdown = () => {
    setShowItems(prevState => !prevState);
  };

  const closeDropdown = item => {
    setShowItems(false);
  };

  const onSelect = select => {
    setSelectNetwork(select);
    toggleDropdown();
  };
  return (
    <>
      {label && <Label>{label}</Label>}
      {data && (
        <ClickAwayListener onClickAway={closeDropdown}>
          <Select>
            <Selected onClick={toggleDropdown}>
              {selectNetwork}
              <StyledArrowDown />
            </Selected>
            <AnimatePresence>
              {showItems && (
                <SelectItems
                  key={'select-items'}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                >
                  {data.map((network, index) => {
                    console.log(network);

                    return (
                      <SelectItem key={index} onClick={() => onSelect(network)}>
                        {network}
                      </SelectItem>
                    );
                  })}
                  {/* <SelectItem>Ethereum</SelectItem> */}
                  {/* <SelectItem>Moonbeam</SelectItem>
                  <SelectItem>Icon</SelectItem>
                  <SelectItem>Binance</SelectItem> */}
                </SelectItems>
              )}
            </AnimatePresence>
          </Select>
        </ClickAwayListener>
      )}
    </>
  );
};

export default NetworkSelector;
