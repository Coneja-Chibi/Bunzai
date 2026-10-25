/** protect(): one element in the protected layer that keeps its own class and names its control. */
import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { protect } from "./protected-control";

test("protect() puts one element in the layer and keeps its own class", () => {
  expect(renderToStaticMarkup(<button type="button" {...protect("take-delete", "act x")}>x</button>)).toBe('<button type="button" class="host-protected act x" data-protected="take-delete">x</button>');
  expect(protect("take-delete").className).toBe("host-protected");
});
