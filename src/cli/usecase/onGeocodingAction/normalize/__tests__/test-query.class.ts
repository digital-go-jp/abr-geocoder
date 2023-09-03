import { Query } from "../../query.class";

export class TestQuery {
  constructor(
    public inputValue: Query,
    public expectValue: Query,
  ) {}
}