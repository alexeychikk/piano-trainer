declare module 'react-piano' {
  export interface KeyboardShortcut {
    key: string;
    midiNumber: number;
  }

  export interface PianoProps {
    noteRange: { first: number; last: number };
    activeNotes?: number[];
    playNote: (midiNumber: number) => void;
    stopNote: (midiNumber: number) => void;
    onPlayNoteInput?: (
      midiNumber: number,
      params: { prevActiveNotes: number[] },
    ) => void;
    onStopNoteInput?: (
      midiNumber: number,
      params: { prevActiveNotes: number[] },
    ) => void;
    renderNoteLabel?: (params: {
      keyboardShortcut: KeyboardShortcut;
      midiNumber: number;
      isActive: boolean;
      isAccidental: boolean;
    }) => React.ReactNode;
    className?: string;
    disabled?: boolean;
    width?: number;
    keyWidthToHeight?: number;
    keyboardShortcuts?: KeyboardShortcut[];
  }

  declare const Piano: React.FC<PianoProps>;
}
