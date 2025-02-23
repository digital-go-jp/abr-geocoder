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
import { FileGroupKey } from "@domain/types/download/file-group";
import { parsePackageId } from "./parse-package-id";

export const createPackageTree = (packageIDs: string[]): Map<string, Map<FileGroupKey, string>> => {

  // 各lgCodeが何のdatasetType を持っているのかをツリー構造にする
  // lgcode -> dataset -> packageId
  const lgCodePackages = new Map<string, Map<FileGroupKey, string>>();
  packageIDs.forEach(packageId => {
    const packageInfo = parsePackageId(packageId);
    if (!packageInfo) {
      return;
    }

    const packages = lgCodePackages.get(packageInfo.lgCode) || new Map();
    packages.set(packageInfo.dataset, packageId);
    lgCodePackages.set(packageInfo.lgCode, packages);
  });

  return lgCodePackages;
};
