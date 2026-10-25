/** The one image size limit is 10 MB, however it is spelled. */
import { expect, test } from "bun:test";
import { IMAGE_MAX_BYTES, imageLimitLabel } from "./image-limit";

test("images are limited to 10 MB, said the same way everywhere", () => {
  expect(IMAGE_MAX_BYTES).toBe(10 * 1024 * 1024);
  expect(imageLimitLabel()).toBe("10 MB");
});
