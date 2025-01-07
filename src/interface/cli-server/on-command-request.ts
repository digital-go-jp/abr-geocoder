/*!
 * MIT License
 *
 * Copyright (c) 2024 デジタル庁
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
import { EnvProvider } from "@domain/models/env-provider";
import { OutputFormat } from "@domain/types/output-format";
import { SearchTarget } from "@domain/types/search-target";
import { AbrgApiServer } from "@interface/abrg-api-server";
import { FormatterProvider } from "@interface/format/formatter-provider";
import { AbrGeocoder } from "@usecases/geocode/abr-geocoder";
import { StatusCodes } from "http-status-codes";
import { Request, Response } from "hyper-express";
import { CliServer } from ".";
import yargs from "yargs";
import ShutdownCommand from "./commands/shutdown";
import { extras } from "./extras";

export class OnCommandRequest {

  constructor(
    private readonly apiServer: AbrgApiServer,
    private readonly cliServer: CliServer,
  ) {  }

  async run(request: Request, response: Response) {
    response.setDefaultEncoding('utf-8');
    const command = await request.text();
    console.debug('received: ', command);

    // yargsに分析させる
    yargs(command.split(' '))
      .middleware((argv: yargs.ArgumentsCamelCase<{}>) => {
        (argv as yargs.ArgumentsCamelCase<extras>).apiServer = this.apiServer;
        (argv as yargs.ArgumentsCamelCase<extras>).cliServer = this.cliServer;
        (argv as yargs.ArgumentsCamelCase<extras>).request = request;
        (argv as yargs.ArgumentsCamelCase<extras>).response = response;
      })
      .command(ShutdownCommand)
      .demandCommand(1)
      .argv;
  }
}
