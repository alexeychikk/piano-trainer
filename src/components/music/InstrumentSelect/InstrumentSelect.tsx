import { MenuItem, Select } from '@material-ui/core';
import clsx from 'clsx';
import { capitalize } from 'lodash-es';
import React, { useCallback } from 'react';
import type { InstrumentName } from 'soundfont-player';
import { INSTRUMENTS } from '@src/config/instruments';
import { useStyles } from './InstrumentSelect.styles';

export interface InstrumentSelectProps {
  className?: string;
  instrument: InstrumentName;
  onChange: (instrument: InstrumentName) => void;
}

const InstrumentSelectBase: React.FC<InstrumentSelectProps> = (props) => {
  const classes = useStyles();

  const handleInstrumentChange = useCallback(
    (event: React.ChangeEvent<{ value: unknown }>) => {
      props.onChange(event.target.value as InstrumentName);
    },
    [props.instrument, props.onChange],
  );

  return (
    <Select
      className={clsx(classes.instrumentSelect, props.className)}
      classes={{ select: classes.innerSelect }}
      id="instrument-select"
      variant="outlined"
      value={props.instrument}
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
