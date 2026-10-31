/** rp-core uses Bun's socket idle timeout switch; Bun's published fetch type omits it. */
interface RequestInit {
  timeout?: boolean;
}
