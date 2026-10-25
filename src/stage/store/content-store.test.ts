/** Runs the ContentStore contract suite against the in-memory backend. */
import { contentStoreContract } from "../contracts/content-store.contract";
import { memoryDocumentBackend } from "./memory/document-backend";

contentStoreContract("memory backend", memoryDocumentBackend);
