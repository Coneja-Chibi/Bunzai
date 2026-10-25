/**
 * MEASUREMENT ARTIFACT ONLY. Never imported by the app; injected by driver.ts into every capture page (themes and both controls).
 * It forces one font family, size and line-height on all text and makes the glyphs invisible, so the edge maps see boxes,
 * borders, backgrounds, frames, images and layout but not lettering. Fonts then cannot fake a layout difference.
 */
const TEXT = "*,*::before,*::after";
export const NEUTRALIZE = [
  `${TEXT}{font-family:Arial,Helvetica,sans-serif!important;font-size:14px!important;line-height:20px!important;font-weight:400!important;font-style:normal!important;font-stretch:100%!important;letter-spacing:normal!important;word-spacing:normal!important;text-transform:none!important;font-variant:normal!important;`,
  `color:transparent!important;-webkit-text-fill-color:transparent!important;-webkit-text-stroke:0!important;text-shadow:none!important;caret-color:transparent!important;text-decoration-color:transparent!important}`,
  `::placeholder{color:transparent!important;-webkit-text-fill-color:transparent!important}`,
  `svg text,svg tspan{fill:transparent!important;stroke:none!important}`,
].join("");
