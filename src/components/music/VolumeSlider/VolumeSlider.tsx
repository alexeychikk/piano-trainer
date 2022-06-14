import type { Mark } from '@material-ui/core';
import { IconButton, Tooltip } from '@material-ui/core';
import { Slider } from '@material-ui/core';
import {
  VolumeDown as VolumeDownIcon,
  VolumeMute as VolumeMuteIcon,
  VolumeUp as VolumeUpIcon,
} from '@material-ui/icons';
import clsx from 'clsx';
import React, { useCallback } from 'react';
import { usePrevious } from 'react-use';
import { useStyles } from './VolumeSlider.styles';

export interface VolumeSliderProps {
  className?: string;
  value: number;
  onChange: (volume: number) => void;
}

const VOLUME_MARKS: Mark[] = [{ value: 0 }, { value: 1 }, { value: 10 }];

const VolumeSliderBase: React.FC<VolumeSliderProps> = (props) => {
  const classes = useStyles();
  const previousValue = usePrevious(props.value);

  const handleVolumeChange = useCallback(
    (
      _: React.ChangeEvent<Record<string, never>>,
      newValue: number | number[],
    ) => {
      props.onChange(newValue as number);
    },
    [props.value, props.onChange],
  );

  const handleVolumeClick = useCallback(() => {
    props.onChange(props.value === 0 ? previousValue || 1 : 0);
  }, [props.value, props.onChange]);

  return (
    <div className={clsx(classes.volumeSlider, props.className)}>
      <Tooltip title={props.value > 0 ? 'Mute' : 'Unmute'}>
        <IconButton
          className={classes.icon}
          size="small"
          onClick={handleVolumeClick}
        >
          {props.value === 0 && <VolumeMuteIcon />}
          {props.value > 0 && props.value <= 1 && <VolumeDownIcon />}
          {props.value > 1 && <VolumeUpIcon />}
        </IconButton>
      </Tooltip>

      <Slider
        className={classes.slider}
        marks={VOLUME_MARKS}
        step={0.1}
        min={0}
        max={10}
        valueLabelDisplay="auto"
        value={props.value}
        onChange={handleVolumeChange}
      />
    </div>
  );
};

export const VolumeSlider = React.memo(VolumeSliderBase);
