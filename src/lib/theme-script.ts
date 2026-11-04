/** Where the chosen theme is remembered (per device). Dark unless "light" is saved. */
export const THEME_KEY = "dcm-theme"

/**
 * Runs in <head> before the first paint: the page is rendered dark, and switches
 * to light right away when light was chosen — no flash of the wrong theme.
 */
export const THEME_SCRIPT = `try{if(localStorage.getItem(${JSON.stringify(THEME_KEY)})==="light"){var r=document.documentElement;r.classList.remove("dark");r.style.colorScheme="light"}}catch(e){}`
