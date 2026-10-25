/** Every editor.frame and editor.fields variant's stylesheet (variants/<surface>/<variant>.ts), mounted once by the Workbench room. */
import cards from "./variants/editor.fields/cards";
import formOnPaper from "./variants/editor.fields/form-on-paper";
import labeledRows from "./variants/editor.fields/labeled-rows";
import statSheet from "./variants/editor.fields/stat-sheet";
import cardStack from "./variants/editor.frame/card-stack";
import longForm from "./variants/editor.frame/long-form";
import tabbedMenu from "./variants/editor.frame/tabbed-menu";
import twoPane from "./variants/editor.frame/two-pane";

export const EDITOR_VARIANTS_STYLE = [twoPane, tabbedMenu, cardStack, longForm, labeledRows, statSheet, cards, formOnPaper].join("\n");
