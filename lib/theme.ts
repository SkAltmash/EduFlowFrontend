export type Theme = "system" | "light" | "dark";

export const THEME_STORAGE_KEY = "eduflow-theme";

/** Runs in <head> before first paint so a saved theme never flashes the wrong colours. */
export const themeScript = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;
