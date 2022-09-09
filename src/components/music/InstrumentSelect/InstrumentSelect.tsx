import { MenuItem, Select } from '@material-ui/core';
import clsx from 'clsx';
import { capitalize } from 'lodash-es';
import React, { useCallback, useMemo } from 'react';
import type { InstrumentName } from 'soundfont-player';
import { INSTRUMENTS } from '@src/config/instruments';
import { useStyles } from './InstrumentSelect.styles';

export interface InstrumentSelectProps {
  className?: string;
  value: InstrumentName;
  onChange: (instrument: InstrumentName) => void;
}

const InstrumentSelectBase: React.FC<InstrumentSelectProps> = (props) => {
  const classes = useStyles();
  const selectClasses = useMemo(
    () => ({ select: classes.innerSelect }),
    [classes],
  );

  const handleInstrumentChange = useCallback(
    (event: React.ChangeEvent<{ value: unknown }>) => {
      props.onChange(event.target.value as InstrumentName);
    },
    [props.value, props.onChange],
  );

  return (
    <Select
      className={clsx(classes.instrumentSelect, props.className)}
      classes={selectClasses}
      id="instrument-select"
      variant="outlined"
      value={props.value}
      onChange={handleInstrumentChange}
    >
      {INSTRUMENTS.map((instrument) => (
        <MenuItem key={instrument} value={instrument}>
          {capitalize(instrument.replace(/_/g, ' '))}
        </MenuItem>
      ))}
    </Select>
  );
};

export const InstrumentSelect = React.memo(InstrumentSelectBase);
