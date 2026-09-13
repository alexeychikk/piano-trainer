import { useMemo, useState } from 'react';
import { useToggle } from 'react-use';

export function useUniqueValue<T>(getValue: () => T): [T, () => void] {
  const [valueSwitcher, toggle] = useToggle(false);
  const [prevValue, setPrevValue] = useState<T | undefined>(undefined);

  const newValue = useMemo(() => {
    let value: T;
    let i = 0;
    do {
      value = getValue();
      i++;
    } while (value === prevValue && i <= 10);
    setPrevValue(value);
    return value;
  }, [valueSwitcher]);

  return [newValue, toggle];
}
