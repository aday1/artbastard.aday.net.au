export type PanelId = 'top-left' | 'top-right' | 'bottom' | 'bottom-right';

export type LayoutMode =
  | 'single'
  | 'split-vertical'
  | 'split-horizontal'
  | 'grid-3'
  | 'grid-4';

export interface PanelComponent {
  id: string;
  type: string;
  title: string;
  props?: Record<string, unknown>;
  position?: { x: number; y: number };
}

export interface PanelState {
  components: PanelComponent[];
  size?: { width: string; height: string };
}

export interface PanelLayout {
  'top-left': PanelState;
  'top-right': PanelState;
  bottom: PanelState;
  'bottom-right': PanelState;
  layoutMode: LayoutMode;
  splitterPositions: {
    horizontal: number;
    vertical: number;
  };
}
