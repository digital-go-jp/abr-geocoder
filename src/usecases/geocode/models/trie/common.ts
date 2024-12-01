import { CharNode } from "./char-node";

export class TrieFinderResult<T> {
  public readonly info: T | undefined;
  public readonly unmatched: CharNode | undefined;
  public readonly depth: number;
  public readonly ambiguousCnt: number;

  constructor(params: {
    info: T | undefined;
    unmatched: CharNode | undefined;
    depth: number;
    ambiguousCnt: number;
  }) {
    this.info = params.info;
    this.unmatched = params.unmatched;
    this.depth = params.depth;
    this.ambiguousCnt = params.ambiguousCnt;
    Object.freeze(this);
  }
}
