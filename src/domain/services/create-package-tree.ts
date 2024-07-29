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