import { AbrgApiServer } from "@interface/abrg-api-server"
import { CliServer } from ".";
import { Request, Response } from "hyper-express";

export interface extras  {
  apiServer: AbrgApiServer;
  cliServer: CliServer;
  request: Request;
  response: Response;
}