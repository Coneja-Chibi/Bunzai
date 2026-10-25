/** Library-facing compatibility exports; parser and ranking authority lives in Node-compatible Core. */
export {
  isFilteredEmpty,
  matchesByKind,
  parseQuery,
  resultLine,
  searchPieces,
  unknownHint,
  SEARCH_FIELD_HELP,
} from "../../../core/search/query";
export type {
  ParsedQuery,
  SearchField,
  SearchHit,
  SearchTerm,
  SearchablePiece,
} from "../../../core/search/query";
