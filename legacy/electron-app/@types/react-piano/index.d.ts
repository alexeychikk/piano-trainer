declare module 'react-piano' {
  export interface KeyboardShortcut {
    key: string;
    midiNumber: number;
  }

  export type NoteInputEvent = (
    midiNumber: number,
    params: { prevActiveNotes: number[] },
  ) => void;

  export interface NoteLabelProps {
    keyboardShortcut: KeyboardShortcut;
    midiNumber: number;
    isActive: boolean;
    isAccidental: boolean;
  }

  export interface PianoProps {
    noteRange: { first: number; last: number };
    activeNotes?: number[];
    playNote: (midiNumber: number) => void;
    stopNote: (midiNumber: number) => void;
    onPlayNoteInput?: NoteInputEvent;
    onStopNoteInput?: NoteInputEvent;
    renderNoteLabel?: (params: NoteLabelProps) => React.ReactNode;
    className?: string;
    disabled?: boolean;
    width?: number;
    keyWidthToHeight?: number;
    keyboardShortcuts?: KeyboardShortcut[];
  }

  declare const Piano: React.FC<PianoProps>;
}
