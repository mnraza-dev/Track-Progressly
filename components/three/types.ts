export type SceneKind = 'hero' | 'books' | 'code' | 'data' | 'design' | 'goal' | 'orbit';
export type SceneOptions = { kind: SceneKind; progress?: number; interactive?: boolean };
export type SceneRegistration = { element: HTMLElement; options: SceneOptions };
