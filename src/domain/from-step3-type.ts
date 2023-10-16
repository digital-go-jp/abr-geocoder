import { TransformCallback } from "node:stream";
import { Query } from "./query";

export type FromStep3Type = {
  query: Query;

  // move to step 4
  callback: TransformCallback;
};