/** Runs the ChatStore contract suite against the in-memory implementation. */
import { chatStoreContract } from "../contracts/chat-store.contract";
import { memoryChatStore } from "./chat-store";

chatStoreContract("memory", (clock) => memoryChatStore(clock));
