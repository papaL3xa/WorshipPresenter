export let globalDisplayWindow: Window | null = null;
export let globalIsDisplayOpen: boolean = false;

export const setGlobalDisplayWindow = (win: Window | null) => {
  globalDisplayWindow = win;
};

export const setGlobalIsDisplayOpen = (isOpen: boolean) => {
  globalIsDisplayOpen = isOpen;
};
