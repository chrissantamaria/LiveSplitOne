declare module "css-animation-sync" {
  export default function sync(animationNameOrNames: string | string[]): {
    getElements: () => EventTarget[];
    free: () => void;
    start: () => void;
    stop: () => void;
    pause: () => void;
  };
}
