export type SceneKind =
  | "focus"
  | "lessons"
  | "practice"
  | "streak"
  | "hero"
  | "books"
  | "code"
  | "data"
  | "design"
  | "goal"
  | "orbit"
  | "timeline"
  | "rings"
  | "trophy";
export type SceneOptions = {
  kind: SceneKind;
  progress?: number;
  interactive?: boolean;
  values?: number[];
  selected?: number;
};
export type SceneRegistration = { element: HTMLElement; options: SceneOptions };
